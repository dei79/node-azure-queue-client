// config with your settings
var qName               = '<<YOURQUEUENAME>>';
var qStorageAccount     = '<<YOURACCOUNTNAME>>';
var qStorageSecret      = '<<YOURACCOUNTSECRET>>';
var qPolling            = 2;

// load the module
var azureQueueClient = new require('../lib/azure-queue-client.js');

// create the listener
var queueListener = new azureQueueClient.AzureQueueListener();

// establish a message handler
queueListener.onMessage(function(message) {

    // just logging
    console.log('Message received: ' + JSON.stringify(message));
    console.log('Message Date: ' + new Date());

    // generate the delay policy
    var exponentialRetryPolicy = new azureQueueClient.AzureQueueDelayedJobPolicies.ExponentialDelayPolicy(1, 5);

    // delay the job
    console.log("Job was delayed " + exponentialRetryPolicy.count(message) + " times");
    console.log("Delaying the job by " + exponentialRetryPolicy.nextTimeout(message) + " seconds");
    return queueListener.delay(message, exponentialRetryPolicy);
});

// start the listening
queueListener.listen(qName, qStorageAccount, qStorageSecret, qPolling, null);

// Add the following sample message to the queue
/*
{ "messageType":"J1", "messageData": { "demo": "valu"}}
*/