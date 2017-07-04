const schedule = require('node-schedule');
const request = require('request');
const logger = require('./logger');
const db = require('./mongoConnection');
const config = require('./config');
const googleMapsClient = require('@google/maps').createClient({
  key: config.directionsKey
});

function getTime(time, offset = 0) {
  let date = new Date(Number(time) + offset);
  return {
    startTime: date,
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function encodeLocation(location) {
  return encodeURIComponent(location.replace(/\s/g, '+'))
}

function getMapImageUrl(origin, destination) {
  return `https://maps.googleapis.com/maps/api/staticmap?size=400x300&markers=${encodeLocation(origin)}&markers=${encodeLocation(destination)}&key=${config.mapKey}`
}

function moveReminderToFailed(id) {
  logger.debug('moveReminderToFailed', id);
  return db.remindersCollection().findOneAndDelete({_id: id})
    .then(result => {
      return db.failedCollection().insertOne(result.value)
        .then(() => {
          logger.info(id, 'successfully moved to failed collection');
        });
    })
    .catch(logger.error);
}

function getRouteDuration(result, callback) {
  logger.debug('getRouteDuration', result.userId);
  return googleMapsClient.directions({
    origin: result.origin,
    destination: result.destination,
    departure_time: result.time,
  }, function (err, data) {
    let duration = data.json.routes[0].legs[0].duration_in_traffic.text || data.json.routes[0].legs[0].duration.text;
    return callback(err, duration);
  });
}

function handleMessageHumanError (err, id, result, repeat) {
  logger.error(err);
  if (repeat) return messageHuman(id, result, false);
  else return moveReminderToFailed(id);
}

function messageHuman(id, result, repeat) {
  logger.debug('messageHuman', repeat, result.userId);
  let mapUrl = `https://www.google.com/maps/dir/${encodeLocation(result.origin)}/${encodeLocation(result.destination)}`;
  return getRouteDuration(result, function (err, duration) {
    if (err) handleMessageHumanError(err, id, result, repeat);

    return request.post({
      url: 'https://api.motion.ai/1.0/messageHuman',
      json: true,
      body: {
        to: result.userId,
        bot: config.botId,
        key: config.apiKey,
        msg: `Here are the directions for your trip from ${result.origin} to ${result.destination}. You will need ${duration} to get there.`,
        cards: [{
          cardTitle: 'Google Maps',
          cardSubtitle: 'Find local businesses, view maps and get driving directions in Google Maps',
          cardImage: getMapImageUrl(result.origin, result.destination),
          cardLink: mapUrl,
          buttons: [{
            buttonText: 'See routes',
            buttonType: 'url',
            target: mapUrl,
          }]
        }],
      },
    }, (err, response, body) => {
      if (err || body.err) handleMessageHumanError(err, id, result, repeat);

      logger.info('message successful', result.userId);
    });
  });
}

db.init(() => {
  logger.debug('init');
  return db.remindersCollection().find().toArray()
    .then(results => {
      results.forEach(result => {
        schedule.scheduleJob(getTime(result.time), messageHuman.bind(null, result._id, result, true));
      });
    })
    .catch(logger.error);
});

function scheduleReminder(req, res, next) {
  logger.debug('scheduleReminder');
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
      getRouteDuration(reminder, function(err, duration) {
        if (err) return next(err);

        res.json({ duration });
        schedule.scheduleJob(getTime(body.time), messageHuman.bind(null, result.ops[0]._id, reminder, true));
      });
    })
    .catch(next);
}

module.exports = {
  scheduleReminder,
};