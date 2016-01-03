# node-azure-queue-client
A simple to use client for azure queues. The module allows to listen on an azure queue and 
when a job comes into the queue it will be processed. The most important features are:

* simple to listen a queue 
* simple to enqueue jobs
* simple to delay jobs
* prepared for job routing
* support for wrapped xml from Azure Scheduler
* listening on multiple queues supported

## Sample

```javascript
// config with your settings
var qName               = '<<YOURQUEUENAME>>';
var qStorageAccount     = '<<YOURACCOUNTNAME>>';
var qStorageSecret      = '<<YOURACCOUNTSECRET>>';
var qPolling            = 2;

// load the module
var azureQueueClient = new require('azure-queue-client');

// create the listener
var queueListener = new azureQueueClient.AzureQueueListener();

// establish a message handler
queueListener.onMessage(function(message) {

    // log something
    console.log('Message received: ' + JSON.stringify(message));

    // job is finished without errors
    return queueListener.done();
});

// start the listening
queueListener.listen(qName, qStorageAccount, qStorageSecret, qPolling, null);
```