const express = require('express');
const webpush = require('web-push');
const bodyparser = require('body-parser');
const app = express();
const mysql = require('my-sql');


const handlers = require('./handlers.js');
const actions = require('./actions.js');

app.use(bodyparser.json());

app.use(express.static('public'));

app.post('/addsubscription', handlers.addSubscription);
app.post('/removesubscription', handlers.removeSubscription);
app.post('/notify-all', handlers.notifyAll);
app.post('/notify-me', handlers.notifyMe);

app.get('/favicon.ico', (request, response) => {
  response.sendStatus(200);
});

app.get('/', (request, response) => {
  response.sendFile(__dirname + '/views/index.html');
});

const listener = app.listen(process.env.PORT, () => {
  console.log('Listening on port ' + listener.address().port);
});
