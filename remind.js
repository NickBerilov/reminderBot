const schedule = require('node-schedule');
const MongoClient = require('mongodb').MongoClient;
const request = require('request');
const config = require('./config');

function handleError(err, db, next) {
  db.close();
  return next(err);
}

function deleteReminderById(id) {
  console.log('DEBUG: deleteReminderById', id);
  MongoClient.connect(config.mongoUrl, (err, db) => {
    db.collection('reminders').deleteOne({_id: id})
      .then(() => {
        db.close();
      })
      .catch(console.error);
  });
}

function messageHuman(id, result) {
  console.log('DEBUG: messageHuman', result.userId);
  request.post({
    url: 'https://api.motion.ai/1.0/messageHuman',
    json: true,
    body: {
      to: result.userId,
      bot: config.botId,
      key: config.apiKey,
      msg: `<a href=https://www.google.com/maps/dir/${result.origin}/${result.destination}>Google Direction Map</a>`,
    },
  }, (err, response, body) => {
    if (err || body.err) return console.error(err || body.err);

    deleteReminderById(id);
  });
}

function init() {
  console.log('DEBUG: init');
  MongoClient.connect(config.mongoUrl, (err, db) => {
    db.collection('reminders').find().toArray()
      .then(results => {
        db.close();
        results.forEach(result => {
          schedule.scheduleJob(new Date(result.time), messageHuman.bind(null, result._id, result));
        });
      })
      .catch(err => handleError(err, db, next));
  });
}

function scheduleReminder(req, res, next) {
  console.log('DEBUG: scheduleReminder');
  MongoClient.connect(config.mongoUrl, (err, db) => {
    let body = {
      userId: req.body.userId,
      origin: req.body.origin,
      destination: req.body.destination,
      time: req.body.time,
    };
    db.collection('reminders').insertOne(body)
      .then(result => {
        db.close();
        res.end();
        schedule.scheduleJob(new Date(req.body.time), messageHuman.bind(null, result.ops[0]._id, body));
      })
      .catch(err => handleError(err, db, next));
  });
}

module.exports = {
  scheduleReminder,
  init,
};