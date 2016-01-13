/*
 This module implements a queue worker based on the queue listener. The worker implements a state lifecycle which is
 not implemented in the listener.
 */
var q                   = require('q');
var AzureQueue          = require('./azure-queue.js');
var AzureQueueListener  = require('./azure-queue-listener.js');
var StaticDelayPolicy   = require('./delay-job-policies/static-delay-policy.js');
var Logger              = require('./common/logger.js');

function AzureQueueWorker() {
    var self = this;

    /*
     * Contains the last valid config
     */
    var lastValidConfig = undefined;

    /*
     * Contains the different callbacks which will be executed for as described
     * in the documentation
     */
    var callbackMap = {
        onInitialize:   null,
        onProcess:      null,
        onState:        null
    };

    self.onInitialize = function(cb) { callbackMap.onInitialize = cb; };
    self.onProcess = function(cb) { callbackMap.onProcess = cb; };
    self.onState = function(cb) { callbackMap.onState = cb; };

    /*
     * Contains the different states the worker supports
     */
    self.states = {
        none:       'none',
        received:   'received',
        running:    'running',
        delayed:    'delayed',
        finished:   'finished',
        failed:     'failed'
    };

    /*
     * This method can be called from the processore to delay a specific job according
     * a defined retry policy
     */
    self.delay = function(message, retryPolicy) {
        // check if we have a retryPolicy-Model, if not we just add a default one by delaying the job
        // for 60 seconds
        if (!retryPolicy) { retryPolicy = new StaticDelayPolicy(60, -1); }

        // get the delayed job date
        var jobMetaInformation = message.messageMetaInformation || {};
        jobMetaInformation.delay = jobMetaInformation.delay || { count: 0, lastTimeout: 0 };

        // process the next tiemout
        var nextTimeout = retryPolicy.nextTimeout(message, jobMetaInformation.delay);
        if (nextTimeout < 0) {
            return q.reject(new Error("Retry counter for delayed job is exceeded"));
        }

        // increas the values
        jobMetaInformation.delay.count += 1;
        jobMetaInformation.delay.lastTimeout = nextTimeout;

        // enqueue the job
        var azureQueue = new AzureQueue(lastValidConfig.qName, lastValidConfig.qStorageAccount, lastValidConfig.qStorageSecret);
        return azureQueue.sendMessageWithMetaData(message.messageType, message.messageData, jobMetaInformation, {visibilityTimeout: nextTimeout}).then(function() {
            return q.resolve({ operation: 'delay', operationInformation: jobMetaInformation.delay });
        })
    };

    /*
     * Ensure that all exceptions are catched
     */
    function tryCatchProcessMessage(message) {
        try {
            return q.when(callbackMap.onProcess(message));
        } catch(error) {
            return q.reject(error);
        }
    }

    /*
     * The run method brings a message queue worker up and running. It will return
     * a promise which can be rejected from the runtime when something happens badly
     * during the startup
     */
    self.run = function() {

        // current logger
        var logger = new Logger();

        // generate a config object
        var config = {
            qName: undefined,
            qStorageAccount: undefined,
            qStorageSecret: undefined,
            qPolling: undefined,
            qLogger: undefined
        };

        // verify that we have an initalize callback
        if (!callbackMap.onInitialize) {
            return q.reject(new Error('Missing a valid onInitiliaze handler, aborting'));
        }

        // run the initialize function
        logger.logMessage('Info', 'Initialzing job worker');
        return q.when(callbackMap.onInitialize(config)).then(function(updatedConfig) {

            // verify the config
            // ### TODO ### Verify configuration

            // set the config
            lastValidConfig = updatedConfig;

            // set the logger
            logger = new Logger(updatedConfig.qLogger);

            // verify that we have now at least the onProcess callback
            if (!callbackMap.onProcess) {
                return q.reject(new Error('Missing a valid onProcess handler, aborting'));
            }

            // check that we have a onState handler or register a dummy handler
            if (!callbackMap.onState) {
                self.onState(function() {});
            }

            // generate the listener
            var queueListener = new AzureQueueListener();

            // register the onMessage handler
            queueListener.onMessage(function(message) {

                // retrieve a message, first state change needs to be triggered
                return q.when(callbackMap.onState(self.states.received, self.states.none, null)).then(function() {

                    // now we transfer the state into running mode
                    return q.when(callbackMap.onState(self.states.running, self.states.received, null)).then(function() {

                        // let's process the message
                        return tryCatchProcessMessage(message).then(function(postOperation) {

                            // check if we have a supported post operation
                            if (postOperation && postOperation.operation === 'delay') {
                                // transfer the message into delayed mode
                                return q.when(callbackMap.onState(self.states.delayed, self.states.running, postOperation.operationInformation));
                            } else {
                                // transfer the message into finished mode
                                return q.when(callbackMap.onState(self.states.finished, self.states.running, null));
                            }

                        }).catch(function(error) {

                            // transfer the message into failed more
                            return q.when(callbackMap.onState(self.states.failed, self.states.running, error));

                        })
                    })
                })
            });

            // start the listening
            queueListener.listen(updatedConfig.qName, updatedConfig.qStorageAccount, updatedConfig.qStorageSecret, updatedConfig.qPolling, updatedConfig.qLogger);

            // build a fake promise
            var defer = q.defer();
            return defer.promise;
        });
    }
}

module.exports = exports = AzureQueueWorker;