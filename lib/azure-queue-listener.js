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

// some handlers
var _messageHandler = null;
var _queueConfig = { qName: null, qStorageAccountKey: null, qStorageAccountSecret: null, qPolling: 0 };
var _logger = null;

// the log message helper
function logMessage() {
    // log
    if (_logger != null) {
        _logger.log.apply(this, arguments);
    } else {

        // read the arguments
        var logLevel = arguments[0];
        var logFormat = arguments[1];
        var logParameters = Array.prototype.slice.call(arguments, 2);

        // generate the parameter for the format function
        var formatParameters = [];
        formatParameters.push('[%s] ' + logFormat);
        formatParameters.push(logLevel);
        logParameters.forEach(function(param) {
            formatParameters.push(param);
        });

        var logString = util.format.apply(this, formatParameters);
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
    azureQueue.getMessage().then(function(message) {

        // we got a message check our message handler
        if (!_messageHandler ||_messageHandler === undefined) {
            logMessage("Info", "No message handler configured");
            return;
        }

        // now call the message handler and check what the result is
        _messageHandler(message).then(function() {
            scheduleListenerForNewJobs(true);
        }).catch(function(error) {
            logMessage("Error", "Message raised error for last message: " + error);
            scheduleListenerForNewJobs(true);
        })
    }).catch(function(error) {
        if (error) {
            logMessage("Error", error);
        }

        // no message found
        scheduleListenerForNewJobs(false);
    });
}

exports.onMessage = function(handler) {
    _messageHandler = handler;
};

exports.listen = function(qName, qStorageAccountKey, qStorageAccountSecret, qPolling, qLogger) {

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