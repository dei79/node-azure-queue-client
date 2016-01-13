/*
    This module implements a representation of an Azure Queue. It's possible
    to send a message to the queue and it's possible to peek messaged from
    the queue
 */

var azure   = require("azure-storage");
var q       = require("q");

function AzureQueue(queueName, storageKey, storageSecret) {
    var self = this;

    var firstCall = true;

    function sendMessageInternal(messageType, messageData, messageMetaInformation, nameofQueue, queueService, options) {

        var defer = q.defer();

        queueService.createMessage(nameofQueue, JSON.stringify({messageType: messageType, messageData: messageData, messageMetaInformation: messageMetaInformation ? messageMetaInformation : {}}), options, function(error, result, response){
            if(error !== null){
                defer.reject(error);
            } else {
                defer.resolve();
            }
        });

        return defer.promise;
    }

    function createQueueIfNeeded(nameOfQueue, queueService) {
        var defer = q.defer();

        if (firstCall) {
            firstCall = false;
            queueService.createQueueIfNotExists(nameOfQueue, function(error, result, response){
                if (error != null) {
                    defer.reject(error);
                } else {
                    defer.resolve();
                }
            })
        } else {
            defer.resolve();
        }

        return defer.promise;
    }

    self.sendMessage = function(messageType, messageData, options) {
        return self.sendMessageWithMetaData(messageType, messageData, null, options);
    };

    self.sendMessageWithMetaData = function(messageType, messageData, messageMetaInformation, options) {
        var deferred = q.defer();

        // generate the client
        var retryOperations = new azure.ExponentialRetryPolicyFilter();
        var queueService = azure.createQueueService(storageKey, storageSecret).withFilter(retryOperations);

        // create the queue if not exists
        createQueueIfNeeded(queueName, queueService).finally(function() {
            sendMessageInternal(messageType, messageData, messageMetaInformation, queueName, queueService, options).then(function() {
                deferred.resolve();
            }).catch(function(error) {
                deferred.reject(error);
            })
        });

        return deferred.promise;
    };

    self.getMessage = function() {
        var deferred = q.defer();

        // generate the client
        var retryOperations = new azure.ExponentialRetryPolicyFilter();
        var queueService = azure.createQueueService(storageKey, storageSecret).withFilter(retryOperations);

        // some options
        var getMessageOptions = { numofmessages: 1, visibilitytimeout: 2 * 60 };

        // console.log("Receiving message from azure storage queue " + config.storage_queue);
        queueService.getMessages(queueName, getMessageOptions, function (error, result, response) {

            // reject the promise if error
            if (error) {
                deferred.reject(error);
                return;
            }

            // reject the promise if no message
            if (result.length == 0) {
                // console.log("No message in the queue");
                deferred.reject(null);
                return;
            }

            // the message
            var message = result[0];

            // if message found remove them because we will process the message
            queueService.deleteMessage(queueName, message.messageid, message.popreceipt, function(error, response) {

                // check if we have an error
                if (error) { deferred.reject(error); return; }

                // parse the data
                var messageData = null;

                try {
                    // try to parse JSON
                    messageData = JSON.parse(message.messagetext);
                } catch(error) {

                    // try to parse XML
                    var parseString = require('xml2js').parseString;
                    parseString(message.messagetext, function (error, result) {
                        if (error) {
                            deferred.reject(error);
                        } else {
                            // check if it is a storage queue message from scheduler
                            if (result.StorageQueueMessage && result.StorageQueueMessage !== undefined) {
                                try {
                                    messageData = JSON.parse(result.StorageQueueMessage.Message[0]);
                                } catch(error) {
                                    deferred.reject(error);
                                }
                            } else {
                                deferred.reject(new Error("Not Supported XML message"));
                            }
                        }
                    });
                }

                // finish the promise and delegate the message
                deferred.resolve(messageData);
            })
        });

        return deferred.promise;
    }
}

module.exports = exports = AzureQueue;