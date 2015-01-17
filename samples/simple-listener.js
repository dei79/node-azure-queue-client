// config with your settings
var qName               = '<<YOURQUEUENAME>>';
var qStorageAccount     = '<<YOURACCOUNTNAME>>';
var qStorageSecret      = '<<YOURACCOUNTSECRET>>';
var qPolling            = 2;

// load the modules
var queueListener   = require('../lib/azure-queue-listener.js');
var q               = require("Q");

// establish a message handler
queueListener.onMessage(function(message) {
    var defer = q.defer();

    console.log('Message received: ' + JSON.stringify(message));
    defer.resolve();

    return defer.promise;
});

// start the listening
queueListener.listen(qName, qStorageAccount, qStorageSecret, qPolling, null);

// Add the following sample message to the queue
/*
{ "messageType":"J1", "messageData": {}}
*/