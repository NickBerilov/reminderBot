const schedule = require('node-schedule');
const db = require('./mongoConnection');
const request = require('request');
const config = require('./config');

function deleteReminderById(id) {
  console.log('DEBUG: deleteReminderById', id);
  return db.remindersCollection().deleteOne({_id: id})
    .then(() => {
      console.log(id, 'successfully deleted');
    })
    .catch(console.error);
}

function moveReminderToFailed(id) {
  console.log('DEBUG: moveReminderToFailed', id);
  return db.remindersCollection().findOneAndDelete({_id: id})
    .then(result => {
      return db.failedCollection().insertOne(result.value)
        .then(() => {
          console.log(id, 'successfully moved to failed collection');
        });
    })
    .catch(console.error);
}

function messageHuman(id, result, repeat) {
  console.log('DEBUG: messageHuman', repeat, result.userId);
  return request.post({
    url: 'https://api.motion.ai/1.0/messageHuman',
    json: true,
    body: {
      to: result.userId,
      bot: config.botId,
      key: config.apiKey,
      msg: `<a href=https://www.google.com/maps/dir/${result.origin}/${result.destination}>Google Direction Map</a>`,
    },
  }, (err, response, body) => {
    if (err || body.err){
      console.error(err || body.err);
      if (repeat) return messageHuman(id, result, false);
      else return moveReminderToFailed(id);
    }

    deleteReminderById(id);
  });
}

db.init(() => {
  console.log('DEBUG: init');
  return db.remindersCollection().find().toArray()
    .then(results => {
      results.forEach(result => {
        let reminderTime = new Date(result.time) > new Date() ? new Date(result.time) : new Date(Date.now() + 60000);
        schedule.scheduleJob(reminderTime, messageHuman.bind(null, result._id, result, true));
      });
    })
    .catch(console.error);
});

function scheduleReminder(req, res, next) {
  console.log('DEBUG: scheduleReminder');
  let body = {
    userId: req.body.userId,
    origin: req.body.origin,
    destination: req.body.destination,
    time: req.body.time,
  };
  return db.remindersCollection().insertOne(body)
    .then(result => {
      res.end();
      schedule.scheduleJob(new Date(req.body.time), messageHuman.bind(null, result.ops[0]._id, body, true));
    })
    .catch(next);
}

module.exports = {
  scheduleReminder,
};