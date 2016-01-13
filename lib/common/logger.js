var util = require('util');

function Logger(externalLogger) {
    var self = this;

    // the log message helper
    self.logMessage = function() {

        // read the arguments
        var logLevel = arguments[0];
        var logFormat = arguments[1];
        var logParameters = Array.prototype.slice.call(arguments, 2);

        // generate the parameter for the format function
        var formatParameters = [];

        if (externalLogger === null || externalLogger === undefined) {
            formatParameters.push('[%s] ' + logFormat);
            formatParameters.push(logLevel);
        } else {
            formatParameters.push(logFormat);
        }

        // add all other parameters
        logParameters.forEach(function (param) {
            formatParameters.push(param);
        });

        // build the log string
        var logString = util.format.apply(this, formatParameters);

        // send to the logger
        if (externalLogger != null) {
            externalLogger(logLevel, logString);
        } else {
            console.log(logString);
        }
    }
}

module.exports = exports = Logger;