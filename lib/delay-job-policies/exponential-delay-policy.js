var StaticDelayPolicy = require('./static-delay-policy.js');

function ExponentialDelayPolicy(timeout, maxRetryCount) {
    var self = this;
    var staticDelayPolicy = new StaticDelayPolicy(timeout, maxRetryCount);

    self.nextTimeout = function(message) {
        var t = staticDelayPolicy.nextTimeout(message);
        if (t < 0) {
            return t;
        } else {
            t = message.messageData._delayedJob ? message.messageData._delayedJob.lastTimeout : t;

            if (self.count(message) === 0) {
                return t;
            } else {
                return t * 2;
            }
        }
    };

    self.count = function(message) {
        return staticDelayPolicy.count(message);
    };
}

module.exports = exports = ExponentialDelayPolicy;
