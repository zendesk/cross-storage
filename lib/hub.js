;(function(root) {
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
    CrossStorageHub._eventListeners = {};
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
    var origin, targetOrigin, request, method, error, result, response;

    // postMessage returns the string "null" as the origin for "file://"
    origin = (message.origin === 'null') ? 'file://' : message.origin;

    // Handle polling for a ready message
    if (message.data === 'cross-storage:poll') {
      return window.parent.postMessage('cross-storage:ready', message.origin);
    }

    // Ignore the ready message when viewing the hub directly
    if (message.data === 'cross-storage:ready') return;

    // Check whether message.data is a valid json
    try {
      request = JSON.parse(message.data);
    } catch (err) {
      return;
    }

    // Check whether request.method is a string
    if (!request || typeof request.method !== 'string') {
      return;
    }

    method = request.method.split('cross-storage:')[1];

    if (!method) {
      return;
    } else if (!CrossStorageHub._permitted(origin, method)) {
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

    // postMessage requires that the target origin be set to "*" for "file://"
    targetOrigin = (origin === 'file://') ? '*' : origin;

    window.parent.postMessage(response, targetOrigin);
  };

  /**
   * Returns a boolean indicating whether or not the requested method is
   * permitted for the given origin. The argument passed to method is expected
   * to be one of 'get', 'set', 'del', 'clear', 'listen' or 'getKeys'.
   *
   * @param   {string} origin The origin for which to determine permissions
   * @param   {string} method Requested action
   * @returns {bool}   Whether or not the request is permitted
   */
  CrossStorageHub._permitted = function(origin, method) {
    var available, i, entry, match;
    if (method==='unlisten') method = 'listen';
    available = ['get', 'set', 'listen', 'del', 'clear', 'getKeys'];
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
   * Sets a key to the specified value.
   *
   * @param {object} params An object with key and value
   */
  CrossStorageHub._set = function(params) {
    window.localStorage.setItem(params.key, params.value);
  };

  /**
   * Accepts an object with an array of keys for which to retrieve their values.
   * Returns a single value if only one key was supplied, otherwise it returns
   * an array. Any keys not set result in a null element in the resulting array.
   *
   * @param   {object} params An object with an array of keys
   * @returns {*|*[]}  Either a single value, or an array
   */
  CrossStorageHub._get = function(params) {
    var storage, result, i, value;

    storage = window.localStorage;
    result = [];

    for (i = 0; i < params.keys.length; i++) {
      try {
        value = storage.getItem(params.keys[i]);
      } catch (e) {
        value = null;
      }

      result.push(value);
    }

    return (result.length > 1) ? result : result[0];
  };

  /**
   * Adds an event listener to `storage` events which sends all events to the client with the given eventKey
   *
   * @param {object} params An object with an eventKey
   */
  CrossStorageHub._listen = function(params) {
    if (params.eventKey in CrossStorageHub._eventListeners) {
      throw new Error("Can't reuse eventKeys")
    }
    var handler = function(event) {
      if (event.storageArea != window.localStorage) return;
      var data = {
        type: 'event',
        eventKey: params.eventKey,
        eventData: {
          key: event.key,
          newValue: event.newValue,
          oldValue: event.oldValue,
          url: event.url
          // storageArea, ignored because we only use localStorage
        }
      };
      window.parent.postMessage(JSON.stringify(data), '*');
    };

    // Support IE8 with attachEvent
    if (window.addEventListener) {
      window.addEventListener('storage', handler, false);
    } else {
      window.attachEvent('onstorage', handler);
    }
    CrossStorageHub._eventListeners[params.eventKey] = handler
  };

  /**
   * Removes an event listener with the given eventKey
   *
   * @param {object} params An object with an eventKey
   */
  CrossStorageHub._unlisten = function(params) {
    var handler = CrossStorageHub._eventListeners[params.eventKey];

    // Support IE8 with attachEvent
    if (window.removeEventListener) {
      window.removeEventListener('storage', handler, false);
    } else {
      window.detachEvent('onstorage', handler);
    }
    CrossStorageHub._eventListeners[params.eventKey] = null
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

  /**
   * Export for various environments.
   */
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CrossStorageHub;
  } else if (typeof exports !== 'undefined') {
    exports.CrossStorageHub = CrossStorageHub;
  } else if (typeof define === 'function' && define.amd) {
    define([], function() {
      return CrossStorageHub;
    });
  } else {
    root.CrossStorageHub = CrossStorageHub;
  }
}(this));
