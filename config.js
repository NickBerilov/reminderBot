module.exports = {
  port: process.env.PORT || 3000,
  mongoUrl: 'mongodb://localhost:27017/reminderBot',
  apiKey: process.env.API_KEY,
  botId: process.env.BOT_ID,
  mapKey: process.env.MAP_KEY,
  directionsKey: process.env.DIRECTIONS_KEY
};