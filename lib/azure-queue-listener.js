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
var Logger      = require('./common/logger.js');
var q           = require('q');

function AzureQueueListener() {
    var self = this;

    // some handlers
    var _messageHandler = null;
    var _pollHandler = null;
    var _pollCounter = 0;
    var _queueConfig = {qName: null, qStorageAccountKey: null, qStorageAccountSecret: null, qPolling: 0};
    var _logger = new Logger();

    function scheduleListenerForNewJobs(processedMessage) {

        // take the default polling
        var polling = _queueConfig.qPolling * 1000;

        // when we processed a message we should ask directly for new jobs
        // and post a nice message
        if (processedMessage) {

            // reduce the polling to 0
            polling = 0;

            // show the nice message
            _logger.logMessage("Info", "");
            _logger.logMessage("Info", "Waiting for new jobs from message bus...");
        }

        setTimeout(startCheckingQueuePeriodically, polling);
    }

    function startCheckingQueuePeriodically() {

        // increase the poll counter
        _pollCounter++;

        // build the pollpromise
        var pollPromise = _pollHandler ? _pollHandler(_pollCounter) : q.resolve();

        // wait until the poll is handles
        pollPromise.finally(function() {
            // try to get a message from our queue
            var azureQueue = new AzureQueue(_queueConfig.qName, _queueConfig.qStorageAccountKey, _queueConfig.qStorageAccountSecret);
            azureQueue.getMessage().then(function (message) {

                // we got a message check our message handler
                if (!_messageHandler || _messageHandler === undefined) {
                    _logger.logMessage("Info", "No message handler configured");
                    return;
                }

                // now call the message handler and check what the result is
                _messageHandler(message).then(function () {
                    scheduleListenerForNewJobs(true);
                }).catch(function (error) {
                    _logger.logMessage("Error", "Message raised error for last message: " + error);
                    scheduleListenerForNewJobs(true);
                })
            }).catch(function (error) {
                if (error) {
                    _logger.logMessage("Error", error);
                }

                // no message found
                scheduleListenerForNewJobs(false);
            });
        });
    }

    self.onMessage = function (handler) {
        _messageHandler = handler;
    };

    self.onPoll = function (handler) {
        _pollHandler = handler;
    }

    self.listen = function (qName, qStorageAccountKey, qStorageAccountSecret, qPolling, qLogger) {

        // set the config
        _queueConfig.qName = qName;
        _queueConfig.qStorageAccountKey = qStorageAccountKey;
        _queueConfig.qStorageAccountSecret = qStorageAccountSecret;
        _queueConfig.qPolling = qPolling;

        // set the logger
        _logger = new Logger(qLogger);

        // log some status
        _logger.logMessage('Info', 'Starting polling on job queue: %s (Account: %s)', qName, qStorageAccountKey);
        _logger.logMessage('Info', 'Waiting for new jobs from message bus...');

        // start the polling
        startCheckingQueuePeriodically();
    };

    self.done = function() {
        return q.resolve();
    }
}

module.exports = exports = AzureQueueListener;