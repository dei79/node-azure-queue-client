// load the module
var azureQueueClient = new require('../lib/azure-queue-client.js');
var q                = require('q');
var process          = require('process');

// genenrate the worker instance
var worker = new azureQueueClient.AzureQueueWorker();

// handles the initial configuration
worker.onInitialize(function(config) {

    // read the config (create a storage.json in root of the project)
    var config = require('../storage.json');

    // adapt the config at this point
    config.qPolling            = 2;

    // this sample puts just one singel job into the queue so that the worker has
    // something todo
    var queue = new azureQueueClient.AzureQueue(config.qName, config.qStorageAccount, config.qStorageSecret, config.qStorageEndpointSuffix);
    queue.sendMessage('DEMO', {});

    // return the updated config or a promise
    return config;
});

// handles a message which will be processed
worker.onProcess(function(message) {

    // just logging
    console.log("Received message");
    console.log(message);

    // return nothing, a promise or throw an exception
    return q.resolve();

    // return nothing
    // return;

    // throw an exception
    // throw new Error("OhOh");

    // define a retry policy
    // var retryPolicy = null; // default would be 60 seconds and ininite retries
    // var retryPolicy = new azureQueueClient.AzureQueueDelayedJobPolicies.StaticDelayPolicy(10, 3); // retry with a delay of 10sec, max 3times
    var retryPolicy = new azureQueueClient.AzureQueueDelayedJobPolicies.ExponentialDelayPolicy(5, 3); // retry with a delay of 5sec, exponentila increase, max 3times

    // or delay the message (per default we delay for 60 seconds)
    // return worker.delay(message, retryPolicy);

});

// handles a state change during processing
worker.onState(function(newState, oldState, addtionalInformation) {

    // logging
    console.log("Transfering job state from " + oldState + " to " + newState);
    if ( addtionalInformation ) { console.log(addtionalInformation);}

    // return nothing, a promise or throw an exception
    return q.resolve();
});

// run the worker
worker.run().then(function() {

    // when the promise is resolved means the worker
    // gracefully finished his work
    process.exit(0);

}).catch(function(error) {
    console.log("Something badly happended when trying to start the worker");
    console.log(error);

    process.exit(1);
});
