/*
    This module implements a queue listener which can be used to implement a job worker. Every job needs
    to have the following base structure:

    {
      "messageType":"<<JOBType>>",
      "messageData": {<<JOBData>>}
    }
 */

// get the azure queue class
var AzureQueue  = require('./azure-queue.js');
var util        = require('util');
var q           = require('q');

function AzureQueueListener() {
    var self = this;

    // some handlers
    var _messageHandler = null;
    var _queueConfig = {qName: null, qStorageAccountKey: null, qStorageAccountSecret: null, qPolling: 0};
    var _logger = null;

    // the log message helper
    function logMessage() {
        // read the arguments
        var logLevel = arguments[0];
        var logFormat = arguments[1];
        var logParameters = Array.prototype.slice.call(arguments, 2);

        // generate the parameter for the format function
        var formatParameters = [];

        if (_logger === null) {
            formatParameters.push('[%s] ' + logFormat);
            formatParameters.push(logLevel);
        } else {
            formatParameters.push(logFormat);
        }

        // add all other parameters
        logParameters.forEach(function (param) {
            formatParameters.push(param);
        });

        // build the log string
        var logString = util.format.apply(this, formatParameters);

        // send to the logger
        if (_logger != null) {
            _logger(logLevel, logString);
        } else {
            console.log(logString);
        }
    }

    function scheduleListenerForNewJobs(processedMessage) {

        // take the default polling
        var polling = _queueConfig.qPolling * 1000;

        // when we processed a message we should ask directly for new jobs
        // and post a nice message
        if (processedMessage) {

            // reduce the polling to 0
            polling = 0;

            // show the nice message
            logMessage("Info", "");
            logMessage("Info", "Waiting for new jobs from message bus...");
        }

        setTimeout(startCheckingQueuePeriodically, polling);
    }

    function startCheckingQueuePeriodically() {

        // try to get a message from our queue
        var azureQueue = new AzureQueue(_queueConfig.qName, _queueConfig.qStorageAccountKey, _queueConfig.qStorageAccountSecret);
        azureQueue.getMessage().then(function (message) {

            // we got a message check our message handler
            if (!_messageHandler || _messageHandler === undefined) {
                logMessage("Info", "No message handler configured");
                return;
            }

            // ensure we have also a metainformation object
            if (!message.messageMetaInformation) { message.messageMetaInformation = {}; }

            // set the current state to running
            self.setMetaInformation(message, self.runtimeDataKeys.state, 'running');

            // now call the message handler and check what the result is
            _messageHandler(message).then(function () {
                scheduleListenerForNewJobs(true);
            }).catch(function (error) {
                logMessage("Error", "Message raised error for last message: " + error);
                scheduleListenerForNewJobs(true);
            })
        }).catch(function (error) {
            if (error) {
                logMessage("Error", error);
            }

            // no message found
            scheduleListenerForNewJobs(false);
        });
    }

    /*
     * Defines the default listener meta data elements
     */
    self.runtimeDataKeys = {
        state: '_state',
        error: '_error',
        delayedJob: '_delayedJob'
    }

    self.onMessage = function (handler) {
        _messageHandler = handler;
    };

    self.listen = function (qName, qStorageAccountKey, qStorageAccountSecret, qPolling, qLogger) {

        // set the config
        _queueConfig.qName = qName;
        _queueConfig.qStorageAccountKey = qStorageAccountKey;
        _queueConfig.qStorageAccountSecret = qStorageAccountSecret;
        _queueConfig.qPolling = qPolling;

        // set the logger
        _logger = qLogger;

        // log some status
        logMessage('Info', 'Starting polling on job queue: %s (Account: %s)', qName, qStorageAccountKey);

        // start the polling
        startCheckingQueuePeriodically();
    };

    /*
     * Allows to delay a job for a specific amount of seconds
     */
    self.delay = function (processedMessage, retryPolicy) {

        // process the next tiemout
        var nextTimeout = retryPolicy.nextTimeout(processedMessage, self);
        if (nextTimeout < 0) {
            return self.error(new Error("Retry counter for delayed job is exceeded"), processedMessage);
        }

        // get the delayed job date
        var delayedJobInformation = self.getMetaInformation(processedMessage, self.runtimeDataKeys.delayedJob, {count: 0, lastTimeout: 0});

        // increas the values
        delayedJobInformation.count += 1;
        delayedJobInformation.lastTimeout = nextTimeout;

        // write the meta information back
        self.setMetaInformation(processedMessage, self.runtimeDataKeys.delayedJob, delayedJobInformation);

        // adjust the state
        self.setMetaInformation(processedMessage, self.runtimeDataKeys.state, 'delayed');
        self.setMetaInformation(processedMessage, self.runtimeDataKeys.error, null);

        // enqueue the job
        var azureQueue = new AzureQueue(_queueConfig.qName, _queueConfig.qStorageAccountKey, _queueConfig.qStorageAccountSecret);
        return azureQueue.sendMessageWithMetaData(processedMessage.messageType, processedMessage.messageData, processedMessage.messageMetaInformation, {visibilityTimeout: nextTimeout});
    };

    /*
     * Notifies the infrastructure that the job is done without errors
     */
    self.done = function(processedMessage) {

        // adjust the state
        if (processedMessage) {
            self.setMetaInformation(processedMessage, self.runtimeDataKeys.state, 'finished');
            self.setMetaInformation(processedMessage, self.runtimeDataKeys.error, null);
        }

        // done
        return q.resolve();
    };

    /*
     * Notifies the infrastructure that the job is aborted
     */
    self.error = function(error, processedMessage) {

        // adjust the state
        if (processedMessage) {
            self.setMetaInformation(processedMessage, self.runtimeDataKeys.state, 'failed');
            self.setMetaInformation(processedMessage, self.runtimeDataKeys.error, error);
        }

        // reject
        return q.reject(error);
    }

    /*
     * Returns the current state of the job
     */
    self.getState = function(processedMessage) {
        return self.getMetaInformation(processedMessage, self.runtimeDataKeys.state);
    }

    /*
     * Allows to set meta information from outside
     */
    self.setMetaInformation = function(processedMessage, key, valueObject) {
        processedMessage.messageMetaInformation[key] = valueObject;
    }

    /*
     * Returns meta information
     */
    self.getMetaInformation = function(processedMessage, key, defaultValue) {
        return processedMessage.messageMetaInformation[key] || defaultValue;
    }
}

module.exports = exports = AzureQueueListener;