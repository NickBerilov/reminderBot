const MongoClient = require('mongodb').MongoClient;
const logger = require('./logger');
const config = require('./config');

let cachedDb;

exports.init = function (callback) {
  MongoClient.connect(config.mongoUrl, function(err, db) {
    if(err) {
      logger.error('Mongo DB connection failed', {error: err});
    } else {
      cachedDb = db;
      exports.db = cachedDb;
      logger.info('Mongo DB: connected!');
      callback();
    }
  });
};

exports.remindersCollection = function () {
  return cachedDb.collection('reminders');
};

exports.failedCollection = function () {
  return cachedDb.collection('failed');
};