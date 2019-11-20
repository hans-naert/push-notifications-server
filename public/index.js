const VAPID_PUBLIC_KEY = '';

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

// Convenience function for creating XMLHttpRequests. 
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

// Request a test notification to one or all subscribers.
async function sendNotification(who) {
  let subscription = await getSubscription();  
  // POST to either '/notify-all' or 'notify-me',
  // depending on which button was clicked.
  if (who === 'me') {
    postToServer('/notify-me', { 
      endpoint: subscription.endpoint 
    });
  } 
  if (who === 'all') {
    postToServer('/notify-all', {});
  }
}

// Refresh onscreen messages, set up UI.
// 
// Note that the "Send notification" buttons are always
// active, whether or not a subscription exists. The server
// needs to figure out what to do with notifications 
// to nowhere, or malformed/non-existent/expired subscriptions.
async function updateUI() {
  let registration = await getRegistration();
  let subscription = await getSubscription();
  
  // Get references to elements on the page
  let reg = document.getElementById('registration');
  let sub = document.getElementById('subscription');
  let regButton = document.getElementById('register');
  let subButton = document.getElementById('subscribe');
  let unRegButton = document.getElementById('unregister');
  let unSubButton = document.getElementById('unsubscribe');
  
  // Reset all UI elements
  reg.textContent = '';
  sub.textContent = '';
  regButton.disabled = true;
  subButton.disabled = true;
  unRegButton.disabled = true;
  unSubButton.disabled = true;
  
  // Set state of UI elements based on registration 
  // and subscription states
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
    if (registration) {
      subButton.disabled = false;
    }
  }
}

// Get current service worker registration, if any
async function getRegistration() {
  return navigator.serviceWorker.getRegistration();
}

// Get current push subscription, if any
async function getSubscription() {
  let registration = await getRegistration();
  if (!(registration && registration.active)) {
    return null;
  } else { 
    return registration.pushManager.getSubscription();
  }
}

// Register service worker, then update the UI
async function registerServiceWorker() {
  await navigator.serviceWorker.register('./service-worker.js');
  updateUI();
}

// Unregister service worker, then update the UI
async function unRegisterServiceWorker() {
  let registration = await getRegistration();
  await registration.unregister();
  updateUI();
}

// Subscribe the user to push notifications. 
// 
// If permission state is: 
// 
//   * 'default', a popup asks the user to allow or block.
//   * 'granted', notifications will be sent without a popup.
//   * 'denied', notifications and popup are both blocked.
async function subscribeToPush() {
  let registration = await getRegistration();
  let subscription = await getSubscription();
  if (!registration || subscription) { return; }
  let options = {
    userVisibleOnly: true,
    applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
  };
  subscription = await registration.pushManager.subscribe(options);
  // Send the subscription to the server 
  postToServer('/add-subscription', subscription);
  updateUI();
}

// Unsubscribe the user from push notifications
async function unSubscribeFromPush() {
  let subscription = await getSubscription();
  if (!subscription) { 
    return; 
  } 
  // Tell the server to remove the subscription
  postToServer('/remove-subscription', { endpoint: subscription.endpoint });
  await subscription.unsubscribe();
  updateUI();
}

// Perform feature-detection and update the UI
const isServiceWorkerCapable = 'serviceWorker' in navigator;
const isPushCapable = 'PushManager' in window;
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

window.onload = initializePage;
