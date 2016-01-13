function StaticDelayPolicy(timeout, maxRetryCount) {
    var self = this;

    var staticDelay = timeout;
    var maxCount = maxRetryCount ? maxRetryCount : -1;

    /*
     * Calculates the next timeout based on the stored timeout in the message. When the function
     * returns a value < 0 it means to retry count es exceeded.
     */
    self.nextTimeout = function(message, metaInformation) {

        // get the last count
        var currentCount = self.count(message, metaInformation);

        // check the max count
        if (maxCount != -1 && maxCount > 0 && currentCount >= maxCount) {
            return -1;
        } else {
            return staticDelay;
        }
    };

    self.count = function(message, metaInformation) {
        return metaInformation ? metaInformation.count : 0;
    }
}

module.exports = exports = StaticDelayPolicy;
