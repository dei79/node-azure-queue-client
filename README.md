# node-azure-queue-client
A simple to use client for azure queues. The module allows to listen on an azure queue and 
when a job comes into the queue it will be processed. The most important features are:

* simple to listen a queue 
* prepared for job routing 
* support for wrapped xml from Azure Scheduler

## Sample

```javascript
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
```
