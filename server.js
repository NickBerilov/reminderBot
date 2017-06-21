const app = require('express')();
const bodyParser = require('body-parser');
const config = require('./config');
const remind = require('./remind');

remind.init();

app.use(bodyParser.json());

app.post('/remind', remind.scheduleReminder);

app.get('/version', (req, res, next) => {
  res.json(require('./package').version);
});

app.use((err, req, res, next) => {
  let message = err.message || 'Oops... We are working on your problem.';
  let code = err.code || 500;
  console.error(message + '; Stack: ' + err.stack, {error: err});
  res.status(code).json({ error: message });
});

app.listen(config.port, () => {
  console.log('Server listening on port', config.port);
});