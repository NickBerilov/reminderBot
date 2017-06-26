const winston = require('winston');

module.exports = new (winston.Logger)({
  transports: [
    new (winston.transports.File)({ //common file logger
      name: 'common-file',
      filename: 'filelog-common.log',
      json: false
    }),
    new (winston.transports.File)({ //error file logger
      name: 'error-file',
      filename: 'filelog-error.log',
      handleExceptions: true,
      humanReadableUnhandledException: true,
      level: 'error',
      json: false
    }),
    new (winston.transports.Console)({
      colorize: 'all',
      level: 'debug',
      handleExceptions: true,
      humanReadableUnhandledException: true
    })
  ],
  exitOnError: false
});