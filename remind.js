const schedule = require('node-schedule');
const db = require('./mongoConnection');
const request = require('request');
const config = require('./config');

function getTime(time, offset = 0) {
  return new Date(Number(time) + offset);
}

function encodeLocation(location) {
  return encodeURIComponent(location.replace(/\s/g, '+'))
}

function getMapImageUrl(origin, destination) {
  return `https://maps.googleapis.com/maps/api/staticmap?size=400x300&markers=${encodeLocation(origin)}&markers=${encodeLocation(destination)}&key=${config.mapKey}`
}

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
      msg: `Here are the directions for your trip from ${result.origin} to ${result.destination}`,
      cards: [{
        cardTitle: 'Google Maps',
        cardSubtitle: 'Find local businesses, view maps and get driving directions in Google Maps',
        cardImage: getMapImageUrl(result.origin, result.destination),
        cardLink: 'https://www.google.com/maps/dir',
        buttons: [{
          buttonText: 'See routes',
          buttonType: 'url',
          target: `https://www.google.com/maps/dir/${encodeLocation(result.origin)}/${encodeLocation(result.destination)}`,
        }]
      }],
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
        let reminderTime = getTime(result.time) > new Date() ? getTime(result.time) : getTime(Date.now() + 60000);
        schedule.scheduleJob(reminderTime, messageHuman.bind(null, result._id, result, true));
      });
    })
    .catch(console.error);
});

function scheduleReminder(req, res, next) {
  console.log('DEBUG: scheduleReminder');
  const body = req.body;
  if (!body.userId || !body.origin || !body.destination || !body.time) {
    return res.status(400).send({ message: 'Invalid body' });
  }
  let reminder = {
    userId: body.userId,
    origin: body.origin,
    destination: body.destination,
    time: body.time,
  };
  return db.remindersCollection().insertOne(reminder)
    .then(result => {
      res.end();
      schedule.scheduleJob(getTime(body.time), messageHuman.bind(null, result.ops[0]._id, reminder, true));
    })
    .catch(next);
}

module.exports = {
  scheduleReminder,
};