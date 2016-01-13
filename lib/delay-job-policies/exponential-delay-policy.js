var StaticDelayPolicy = require('./static-delay-policy.js');

function ExponentialDelayPolicy(timeout, maxRetryCount) {
    var self = this;
    var staticDelayPolicy = new StaticDelayPolicy(timeout, maxRetryCount);

    self.nextTimeout = function(message, metaInformation) {
        var t = staticDelayPolicy.nextTimeout(message, metaInformation);
        if (t < 0) {
            return t;
        } else {

            if (self.count(message, metaInformation) === 0) {
                return t;
            } else {
                t = metaInformation ? metaInformation.lastTimeout : t;
                return t * 2;
            }
        }
    };

    self.count = function(message, metaInformation) {
        return staticDelayPolicy.count(message, metaInformation);
    };
}

module.exports = exports = ExponentialDelayPolicy;
