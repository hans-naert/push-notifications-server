const push = require('./push.js');

function addSubscription(request, response) {
  let subscription = request.body;
  let subscriptions = request.session.subscriptions;
  subscriptions[subscription.endpoint] = subscription;
  response.sendStatus(200);
}

function removeSubscription(request, response) {
  let subscription = request.body;
  let subscriptions = request.session.subscriptions;
  delete subscriptions[subscription.endpoint];
  response.sendStatus(200);
}

function notifyAll(request, response) {
  let subscriptions = request.session.subscriptions;
  let notification = request.body.notification;
  push.sendNotifications(subscriptions, notification);
  response.sendStatus(200);
}

function notifyMe(request, response) {
  let subscription = request.body.subscription;
  let notification = request.body.notification;
  push.sendNotification(subscription, notification);
  response.sendStatus(200);
}

let handlers = {
  addSubscription: addSubscription,
  removeSubscription: removeSubscription,
  notifyAll: notifyAll,
  notifyMe: notifyMe
}

module.exports = handlers;
