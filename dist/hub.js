/**
 * cross-storage - Cross domain local storage
 *
 * @version   0.6.1
 * @link      https://github.com/zendesk/cross-storage
 * @author    Daniel St. Jules <danielst.jules@gmail.com>
 * @copyright Zendesk
 * @license   Apache-2.0
 */

var CrossStorageHub = {};

/**
 * Accepts an array of objects with two keys: origin and allow. The value
 * of origin is expected to be a RegExp, and allow, an array of strings.
 * The cross storage hub is then initialized to accept requests from any of
 * the matching origins, allowing access to the associated lists of methods.
 * Methods may include any of: get, set, del, getKeys and clear. A 'ready'
 * message is sent to the parent window once complete.
 *
 * @example
 * // Subdomain can get, but only root domain can set and del
 * CrossStorageHub.init([
 *   {origin: /\.example.com$/,        allow: ['get']},
 *   {origin: /:(www\.)?example.com$/, allow: ['get', 'set', 'del']}
 * ]);
 *
 * @param {array} permissions An array of objects with origin and allow
 */
CrossStorageHub.init = function(permissions) {
  var available = true;

  // Return if localStorage is unavailable, or third party
  // access is disabled
  try {
    if (!window.localStorage) available = false;
  } catch (e) {
    available = false;
  }

  if (!available) {
    try {
      return window.parent.postMessage('cross-storage:unavailable', '*');
    } catch (e) {
      return;
    }
  }

  CrossStorageHub._permissions = permissions || [];
  CrossStorageHub._installListener();
  window.parent.postMessage('cross-storage:ready', '*');
};

/**
 * Installs the necessary listener for the window message event. Accommodates
 * IE8 and up.
 *
 * @private
 */
CrossStorageHub._installListener = function() {
  var listener = CrossStorageHub._listener;
  if (window.addEventListener) {
    window.addEventListener('message', listener, false);
  } else {
    window.attachEvent('onmessage', listener);
  }
};

/**
 * The message handler for all requests posted to the window. It ignores any
 * messages having an origin that does not match the originally supplied
 * pattern. Given a JSON object with one of get, set, del or getKeys as the
 * method, the function performs the requested action and returns its result.
 *
 * @param {MessageEvent} message A message to be processed
 */
CrossStorageHub._listener = function(message) {
  var uri, available, request, method, error, result, response;

  // Handle polling for a ready message
  if (message.data === 'cross-storage:poll') {
    return window.parent.postMessage('cross-storage:ready', message.origin);
  }

  // Ignore the ready message when viewing the hub directly
  if (message.data === 'cross-storage:ready') return;

  request = JSON.parse(message.data);
  method = request.method.split('cross-storage:')[1];

  if (!method) {
    return;
  } else if (!CrossStorageHub._permitted(message.origin, method)) {
    error = 'Invalid permissions for ' + method;
  } else {
    try {
      result = CrossStorageHub['_' + method](request.params);
    } catch (err) {
      error = err.message;
    }
  }

  response = JSON.stringify({
    id: request.id,
    error: error,
    result: result
  });

  window.parent.postMessage(response, message.origin);
};

/**
 * Returns a boolean indicating whether or not the requested method is
 * permitted for the given origin. The argument passed to method is expected
 * to be one of 'get', 'set', 'del' or 'getKeys'.
 *
 * @param   {string} origin The origin for which to determine permissions
 * @param   {string} method Requested action
 * @returns {bool}   Whether or not the request is permitted
 */
CrossStorageHub._permitted = function(origin, method) {
  var available, i, entry, match;

  available = ['get', 'set', 'del', 'clear', 'getKeys'];
  if (!CrossStorageHub._inArray(method, available)) {
    return false;
  }

  for (i = 0; i < CrossStorageHub._permissions.length; i++) {
    entry = CrossStorageHub._permissions[i];
    if (!(entry.origin instanceof RegExp) || !(entry.allow instanceof Array)) {
      continue;
    }

    match = entry.origin.test(origin);
    if (match && CrossStorageHub._inArray(method, entry.allow)) {
      return true;
    }
  }

  return false;
};

/**
 * Sets a key to the specified value. If a ttl is provided, an expiration
 * timestamp is added to the object to be stored, prior to serialization.
 *
 * @param {object} params An object with key, value and optional ttl
 */
CrossStorageHub._set = function(params) {
  var ttl, item;

  ttl = params.ttl;
  if (ttl && parseInt(ttl, 10) !== ttl) {
    throw new Error('ttl must be a number');
  }

  item = {value:  params.value};
  if (ttl) {
    item.expire = CrossStorageHub._now() + ttl;
  }

  window.localStorage.setItem(params.key, JSON.stringify(item));
};

/**
 * Accepts an object with an array of keys for which to retrieve their values.
 * Returns a single value if only one key was supplied, otherwise it returns
 * an array. Any keys not set, or expired, result in a null element in the
 * resulting array.
 *
 * @param   {object} params An object with an array of keys
 * @returns {*|*[]}  Either a single value, or an array
 */
CrossStorageHub._get = function(params) {
  var storage, result, i, item, key;

  storage = window.localStorage;
  result = [];

  for (i = 0; i < params.keys.length; i++) {
    key = params.keys[i];
    item = JSON.parse(storage.getItem(key));

    if (item === null) {
      result.push(null);
    } else if (item.expire && item.expire < CrossStorageHub._now()) {
      storage.removeItem(key);
      result.push(null);
    } else {
      result.push(item.value);
    }
  }

  return (result.length > 1) ? result : result[0];
};

/**
 * Deletes all keys specified in the array found at params.keys.
 *
 * @param {object} params An object with an array of keys
 */
CrossStorageHub._del = function(params) {
  for (var i = 0; i < params.keys.length; i++) {
    window.localStorage.removeItem(params.keys[i]);
  }
};

/**
 * Clears localStorage.
 */
CrossStorageHub._clear = function() {
  window.localStorage.clear();
};

/**
 * Returns an array of all keys stored in localStorage.
 *
 * @returns {string[]} The array of keys
 */
CrossStorageHub._getKeys = function(params) {
  var i, length, keys;

  keys = [];
  length = window.localStorage.length;

  for (i = 0; i < length; i++) {
    keys.push(window.localStorage.key(i));
  }

  return keys;
};

/**
 * Returns whether or not a value is present in the array. Consists of an
 * alternative to extending the array prototype for indexOf, since it's
 * unavailable for IE8.
 *
 * @param   {*}    value The value to find
 * @parma   {[]*}  array The array in which to search
 * @returns {bool} Whether or not the value was found
 */
CrossStorageHub._inArray = function(value, array) {
  for (var i = 0; i < array.length; i++) {
    if (value === array[i]) return true;
  }

  return false;
};

/**
 * A cross-browser version of Date.now compatible with IE8 that avoids
 * modifying the Date object.
 *
 * @return {int} The current timestamp in milliseconds
 */
CrossStorageHub._now = function() {
  if (typeof Date.now === 'function') {
    return Date.now();
  }

  return new Date().getTime();
};
