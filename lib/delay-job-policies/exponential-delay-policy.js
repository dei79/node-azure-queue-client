var StaticDelayPolicy = require('./static-delay-policy.js');

function ExponentialDelayPolicy(timeout, maxRetryCount) {
    var self = this;
    var staticDelayPolicy = new StaticDelayPolicy(timeout, maxRetryCount);

    self.nextTimeout = function(message, queueListener) {
        var t = staticDelayPolicy.nextTimeout(message, queueListener);
        if (t < 0) {
            return t;
        } else {
            var jobMetaData = queueListener.getMetaInformation(message, queueListener.runtimeDataKeys.delayedJob);
            t = jobMetaData ? jobMetaData.lastTimeout : t;

            if (self.count(message, queueListener) === 0) {
                return t;
            } else {
                return t * 2;
            }
        }
    };

    self.count = function(message, queueListener) {
        return staticDelayPolicy.count(message, queueListener);
    };
}

module.exports = exports = ExponentialDelayPolicy;
