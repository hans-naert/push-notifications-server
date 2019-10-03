// Key used to identify the app server and client to each other.
const VAPID_PUBLIC_KEY = 'BLNuAat43YdqpTNKEZFXqUp8uJAriWOzLBWtVAvWy6Axbusnedn8bm4EpLGqCFxGzyjl4-c9GP9sJ5XheswDjTA';

// Convert a base64 string to Uint8Array.
// Must do this so the server can understand the VAPID_PUBLIC_KEY.
const urlB64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray; 
};

// Create a couple of booleans to use in 
// feature-detection for service worker and push.
const isServiceWorkerCapable = 'serviceWorker' in navigator;
const isPushCapable = 'PushManager' in window;

// Convenience function for creating XMLHttpRequests. 
// Used to send stuff to the server.
function createXhr(method, contentType, url) {
  let xhr = new XMLHttpRequest();
  let loadHandler = (event) => { 
    let text = event.srcElement.responseText;
    let status = event.srcElement.status;
    console.log(url, status, text);
  };
  let errorHandler = (error) => {
    console.log(error);
  }
  xhr.onload = loadHandler;
  xhr.onerror = errorHandler;
  xhr.open(method, url);
  xhr.setRequestHeader('Content-Type', contentType);
  return xhr;
}

// Send an XMLHttpRequest to a server URL.
async function postToServer(url, data) {
  // Since the app only needs to send POSTs with JSON,
  // the method and content types are hard-coded for now.
  let xhr = createXhr('POST', 'application/json', url);
  // Stringify the data. The server parses it back into an object.
  xhr.send(JSON.stringify(data));
}

// Create a notification. Send it to a server URL
// to trigger push notification/s.
async function sendNotification(who) {
  let subscription = await getSubscription();
  // Include a random number to help tell the
  // difference between test notifications.
  let randy = Math.floor(Math.random() * 100);
  let notification = {
    title: 'Test ' + randy, 
    options: { body: 'Test body ' + randy }
  };
  // Post to either '/notify-all' or 'notify-me',
  // depending on which button was clicked.
  postToServer('/notify-' + who, {
    subscription: subscription,
    notification: notification
  });
}

// Refresh the onscreen messages and make sure only 
// the buttons that make sense are active. 
// 
// Note that the "Send notification" buttons are always
// active, whether or not a subscription exists. The server
// needs to figure out what to do with notifications 
// to nowhere, or malformed/non-existent/expired subscriptions.
async function updateUI() {
  // Get the current registration and subscription states.
  let registration = await getRegistration();
  let subscription = await getSubscription();
  
  // Get a bunch of references to elements on the page.
  let reg = document.getElementById('registration');
  let sub = document.getElementById('subscription');
  let regButton = document.getElementById('register');
  let subButton = document.getElementById('subscribe');
  let unRegButton = document.getElementById('unregister');
  let unSubButton = document.getElementById('unsubscribe');
  
  // Reset all UI elements.
  reg.textContent = '';
  sub.textContent = '';
  regButton.disabled = true;
  subButton.disabled = true;
  unRegButton.disabled = true;
  unSubButton.disabled = true;
  
  // Work out what the state of all UI elements
  // should be, based on registration and 
  // subscription states.
  if (registration) {
    reg.textContent = 
      'Service worker registered. Scope: ' + registration.scope;
    unRegButton.disabled = false;
  } else {
    reg.textContent = 'No service worker registration.'
    regButton.disabled = false;
  }
  if (subscription) {
    sub.textContent = 
      'Subscription endpoint: ' + subscription.endpoint;
    unSubButton.disabled = false;
  } else {
    sub.textContent = 'No push subscription.'
    // Can only subscribe if registration exists.
    if (registration) {
      subButton.disabled = false;
    }
  }
}

// Get the current service worker registration.
// Returns a Promise that resolves to a 
// ServiceWorkerRegistration object, or undefined.
async function getRegistration() {
  return navigator.serviceWorker.getRegistration();
}

// Get the current subscription. Returns a Promise
// that resolves to a PushSubscription object 
// if one exists, or null.
async function getSubscription() {
  let registration = await getRegistration();
  if (!(registration && registration.active)) {
    return null;
  } else { 
    return registration.pushManager.getSubscription();
  }
}

// Register a service worker, then update the UI.
async function registerServiceWorker() {
  // Await the outcome of the registration attempt
  // so that the UI update is not superceded by a 
  // returning Promise.
  await navigator.serviceWorker.register('./serviceworker.js');
  updateUI();
}

// Unregister a service worker, then update the UI.
async function unRegisterServiceWorker() {
  let registration = await getRegistration();
  // Await the outcome of the unregistration attempt
  // so that the UI update is not superceded by a 
  // returning Promise.
  await registration.unregister();
  updateUI();
}

// Subscribe the user to push notifications. 
// 
// If permission state is: 
// 
//   * 'default', a popup asks the user to allow or block.
//   * 'allow', notifications will be sent without a popup.
//   * 'denied', both notifications and popup are blocked.
async function subscribeToPush() {
  let registration = await getRegistration();
  let subscription = await getSubscription();
  // If no registration, can't subscribe.
  // If already a subscription, no need to subscribe.
  if (!registration || subscription) { return; }
  let options = {
    // Only notify if the user will actually see something
    // on screen.
    userVisibleOnly: true,
    // Convert to format the server can understand.
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
  };
  // Wait for the outcome of the subscription event before 
  // telling the server about the new subscription and updating the UI.
  subscription = await registration.pushManager.subscribe(options);
  postToServer('/addsubscription', subscription);
  updateUI();
}

// Unsubscribe from push notifications.
async function unSubscribeFromPush() {
  let subscription = await getSubscription();
  // Don't try to unsubscribe from a non-existent subscription
  // because this would throw an error. 
  if (!subscription) { 
    return; 
  } 
  // Tell the server about the soon-to-be invalid subscription,
  // then unsubscribe.
  postToServer('/removesubscription', subscription);
  // Wait for the unsubscription promise to resolve 
  // before updating the UI, otherwise the change
  // might occur after the UI update.
  await subscription.unsubscribe();
  updateUI();
}

// Perform feature-detection, then if all is well,
// update the UI. 
async function initializePage() {
  if (!isServiceWorkerCapable || !isPushCapable) {
    let message = 
      'User agent must be service worker- ' + 
      'and push-capable to use this page.';
    console.log(message);
    return;
  }
  updateUI();
}

// Wait for the page to load because you need to refer
// to buttons and stuff. Could defer the script instead?
window.onload = initializePage;
