var CrossStorageHub = {};

/**
 * Initializes the cross storage hub to accept requests from any origin
 * matching the specified RegExp. A 'ready' message is sent to the parent
 * window once complete.
 *
 * @param {RegExp} originPattern The pattern for which to test message origins
 */
CrossStorageHub.init = function(originPattern) {
  if (!window.localStorage) return;

  CrossStorageHub._originPattern = originPattern;
  CrossStorageHub._installListener();
  window.parent.postMessage('ready', '*');
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
 * pattern. Given a JSON object with one of get, set, or del as the method,
 * the function performs the requested action and returns its result.
 *
 * @param {MessageEvent} message A message to be processed
 */
CrossStorageHub._listener = function(message) {
  var uri, available, request, method, error, result, response;

  // Ignore messages not matching the pattern
  if (!CrossStorageHub._originPattern.test(message.origin)) {
    return;
  }

  available = ['get', 'set', 'del'];
  request = JSON.parse(message.data);

  if (available.indexOf(request.method) !== -1) {
    try {
      result = CrossStorageHub['_' + request.method](request.params);
    } catch (err) {
      error = err.message;
    }

    response = JSON.stringify({
      id: request.id,
      error: error,
      result: result
    });

    window.parent.postMessage(response, message.origin);
  }
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

  item = JSON.stringify({
    value:  params.value,
    expire: Date.now() + ttl
  });

  window.localStorage.setItem(params.key, item);
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
    } else if (item.expire && item.expire < Date.now()) {
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
