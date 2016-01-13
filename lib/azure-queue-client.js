var exports = module.exports;

exports.AzureQueue = require('./azure-queue.js');
exports.AzureQueueListener = require('./azure-queue-listener.js');
exports.AzureQueueWorker = require('./azure-queue-worker.js');

exports.AzureQueueDelayedJobPolicies = {
    StaticDelayPolicy: require('./delay-job-policies/static-delay-policy.js'),
    ExponentialDelayPolicy: require('./delay-job-policies/exponential-delay-policy.js')
};