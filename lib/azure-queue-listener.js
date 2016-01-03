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
        var nextTimeout = retryPolicy.nextTimeout(processedMessage);
        if (nextTimeout < 0) {
            return self.error(new Error("Retry counter for delayed job is exceeded"));
        }

        // adjust delay job data
        if (!processedMessage.messageData._delayedJob) {
            processedMessage.messageData._delayedJob = {count: 0, lastTimeout: 0};
        }
        processedMessage.messageData._delayedJob.count += 1;
        processedMessage.messageData._delayedJob.lastTimeout = nextTimeout;

        // enqueue the job
        var azureQueue = new AzureQueue(_queueConfig.qName, _queueConfig.qStorageAccountKey, _queueConfig.qStorageAccountSecret);
        return azureQueue.sendMessage(processedMessage.messageType, processedMessage.messageData, {visibilityTimeout: nextTimeout});
    };

    /*
     * Notifies the infrastructure that the job is done without errors
     */
    self.done = function() {
        return q.resolve();
    };

    /*
     * Notifies the infrastructure that the job is aborted
     */
    self.error = function(error) {
        return q.reject(error);
    }
}

module.exports = exports = AzureQueueListener;