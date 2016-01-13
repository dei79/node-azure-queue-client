// config with your settings
var qName               = '<<YOURQUEUENAME>>';
var qStorageAccount     = '<<YOURACCOUNTNAME>>';
var qStorageSecret      = '<<YOURACCOUNTSECRET>>';
var qPolling            = 2;

// load the module
var azureQueueClient = require('../lib/azure-queue-client.js');

// generate the listener
var queueListener = new azureQueueClient.AzureQueueListener();

// establish a message handler
queueListener.onMessage(function(message) {

    // log something
    console.log('Message received: ' + JSON.stringify(message));

    // done without errors
    return queueListener.done();
});

// start the listening
queueListener.listen(qName, qStorageAccount, qStorageSecret, qPolling, null);

// Add the following sample message to the queue
/*
{ "messageType":"J1", "messageData": {}}
*/