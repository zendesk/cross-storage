/**
 * Constructs a new cross storage client given the url to a hub. An iframe
 * is created within the document body that points to the specified url.
 *
 * @constructor
 *
 * @param {string} url The url to a cross storage hub
 *
 * @property {string} _origin    The hub's origin
 * @property {object} _requests  An object mapping request ids to callbacks
 * @property {bool}   _connected Whether or not the client has connected
 * @property {int}    _count     The number of requests sent, to be used for ids
 * @property {Window} _hub       The hub window
 */
function CrossStorageClient(url) {
  var uri = document.createElement('a');
  uri.href = url;

  this._origin    = uri.protocol + '//' + uri.host;
  this._requests  = {};
  this._connected = false;
  this._count     = 0;

  this._installListener();
  this._hub = this._createFrame(url);
}

/**
 * The styles to be applied to the generated iFrame. Defines a set of properties
 * that hide the element by positioning it outside of the visible area, and
 * by modifying its display.
 *
 * @member {Object}
 */
CrossStorageClient.frameStyle = {
  display:  'none',
  position: 'absolute',
  top:      '-999px',
  left:     '-999px'
};

/**
 * Returns a promise that is fulfilled when a connection has been established
 * with the cross storage hub. Its use is recommended to avoid sending any
 * requests prior to initialization being complete.
 *
 * @returns {Promise} A promise that is resolved on connect
 */
CrossStorageClient.prototype.onConnect = function() {
  if (this._connected) {
    return Promise.resolve();
  }

  var client = this;

  return new Promise(function(resolve, reject) {
    client._requests.connect = resolve;
  });
};

/**
 * Sets a key to the specified value, optionally accepting a ttl to passively
 * expire the key after a number of milliseconds. Returns a promise that is
 * fulfilled on success, or rejected if any errors setting the key occurred,
 * or the request timed out.
 *
 * @param   {string}  key   The key to set
 * @param   {*}       value The value to assign
 * @param   {int}     ttl   Time to live in milliseconds
 * @returns {Promise} A promise that is settled on hub response or timeout
 */
CrossStorageClient.prototype.set = function(key, value, ttl) {
  return this._request('set', {
    key:   key,
    value: value,
    ttl:   ttl
  });
};

/**
 * Accepts one or more keys for which to retrieve their values. Returns a
 * promise that is settled on hub response or timeout. On success, it is
 * fulfilled with the value of the key if only passed a single argument.
 * Otherwise it's resolved with an array of values. On failure, it is rejected
 * with the corresponding error message.
 *
 * @param   {...string} key The key to retrieve
 * @returns {Promise}   A promise that is settled on hub response or timeout
 */
CrossStorageClient.prototype.get = function(key) {
  var args = Array.prototype.slice.call(arguments);

  return this._request('get', {keys: args});
};

/**
 * Accepts one or more keys for deletion. Returns a promise that is settled on
 * hub response or timeout.
 *
 * @param   {...string} key The key to delete
 * @returns {Promise}   A promise that is settled on hub response or timeout
 */
CrossStorageClient.prototype.del = function() {
  var args = Array.prototype.slice.call(arguments);

  return this._request('del', {keys: args});
};

/**
 * Installs the necessary listener for the window message event. When a message
 * is received, the client's _connected status is changed to true, and the
 * onConnect promise is fulfilled. Given a response message, the callback
 * corresponding to its request is invoked. If response.error holds a truthy
 * value, the promise associated with the original request is rejected with
 * the error. Otherwise the promise is fulfilled and passed response.result.
 *
 * @private
 */
CrossStorageClient.prototype._installListener = function() {
  var client = this;
  var listener = function(message) {
    // Handle initial connection
    if (!client._connected) {
      client._connected = true;

      if (client._requests.connect) {
        client._requests.connect();
        delete client._requests.connect;
      }
    }

    if (message.data === 'ready') return;

    // All other messages
    var response = JSON.parse(message.data);
    if (!response.id) return;

    if (client._requests[response.id]) {
      client._requests[response.id](response.error, response.result);
    }
  };

  // Support IE8 with attachEvent
  if (window.addEventListener) {
    window.addEventListener('message', listener, false);
  } else {
    window.attachEvent('onmessage', listener);
  }
};

/**
 * Creates a new iFrame containing the hub. Applies the necessary styles to
 * hide the element from view, prior to adding it to the document body.
 *
 * @private
 *
 * @param  {string} url The url to the hub
 * returns {Window} The content window for the iFrame
 */
CrossStorageClient.prototype._createFrame = function(url) {
  var frame = window.document.createElement('iframe');

  // Style the iframe
  for (var key in CrossStorageClient.frameStyle) {
    if (CrossStorageClient.frameStyle.hasOwnProperty(key)) {
      frame.style[key] = CrossStorageClient.frameStyle[key];
    }
  }

  window.document.body.appendChild(frame);
  frame.src = url;

  return frame.contentWindow;
};

/**
 * Sends a message containing the given method and params to the hub. Stores
 * a callback in the _requests object for later invocation on message, or
 * deletion on timeout. Returns a promise that is settled in either instance.
 *
 * @private
 *
 * @param   {string}  method The method to invoke
 * @param   {*}       params The arguments to pass
 * @returns {Promise} A promise that is settled on hub response or timeout
 */
CrossStorageClient.prototype._request = function(method, params) {
  var req, client;

  client = this;
  req = {
    id:     ++client._count,
    method: method,
    params: params
  };

  return new Promise(function(resolve, reject) {
    // Timeout if a response isn't received after 4s
    var timeout = setTimeout(function() {
      if (!client._requests[req.id]) return;

      delete client._requests[req.id];
      reject('Timeout: could not perform ' + req.method);
    }, 3000);

    // Add request callback
    client._requests[req.id] = function(err, result) {
      clearTimeout(timeout);
      if (err) return reject(new Error(err));
      resolve(result);
    };

    // Send serialized message
    client._hub.postMessage(JSON.stringify(req), client._origin);
  });
};
