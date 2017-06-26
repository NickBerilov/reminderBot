const app = require('express')();
const bodyParser = require('body-parser');
const logger = require('./logger');
const config = require('./config');
const remind = require('./remind');

app.use(bodyParser.json());

app.post('/remind', remind.scheduleReminder);

app.get('/version', (req, res, next) => {
  res.json(require('./package').version);
});

app.use((err, req, res, next) => {
  let message = err.message || 'Oops... We are working on your problem.';
  let code = err.code || 500;
  logger.error(message + '; Stack: ' + err.stack, {error: err});
  res.status(code).json({ error: message });
});

app.listen(config.port, () => {
  logger.info('Server listening on port', config.port);
});