/**
 * cross-storage - Cross domain local storage
 *
 * @version   0.3.3
 * @link      https://github.com/zendesk/cross-storage
 * @author    Daniel St. Jules <danielst.jules@gmail.com>
 * @copyright Zendesk
 * @license   Apache-2.0
 */

/**
 * Constructs a new cross storage client given the url to a hub. By default,
 * an iframe is created within the document body that points to the url. It
 * also accepts an options object, which may include a timeout, frameId, and
 * promise. The timeout, in milliseconds, is applied to each request and
 * defaults to 3000ms. The options object may also include a frameId,
 * identifying an existing frame on which to install its listeners. If the
 * promise key is supplied the constructor for a Promise, that Promise library
 * will be used instead of the default window.Promise.
 *
 * @example
 * var storage = new CrossStorageClient('https://store.example.com/hub.html');
 *
 * @example
 * var storage = new CrossStorageClient('https://store.example.com/hub.html', {
 *   timeout: 5000,
 *   frameId: 'storageFrame'
 * });
 *
 * @constructor
 *
 * @param {string} url    The url to a cross storage hub
 * @param {object} [opts] An optional object containing additional options,
 *                        including timeout, frameId, and promise
 *
 * @property {string}   _id        A UUID v4 id
 * @property {function} _promise   The Promise object to use
 * @property {string}   _frameId   The id of the iFrame pointing to the hub url
 * @property {string}   _origin    The hub's origin
 * @property {object}   _requests  Mapping of request ids to callbacks
 * @property {bool}     _connected Whether or not it has connected
 * @property {bool}     _closed    Whether or not the client has closed
 * @property {int}      _count     Number of requests sent
 * @property {function} _listener  The listener added to the window
 * @property {Window}   _hub       The hub window
 */
function CrossStorageClient(url, opts) {
  opts = opts || {};

  this._id        = CrossStorageClient._generateUUID();
  this._promise   = opts.promise || Promise;
  this._frameId   = opts.frameId || 'CrossStorageClient-' + this._id;
  this._origin    = CrossStorageClient._getOrigin(url);
  this._requests  = {};
  this._connected = false;
  this._closed    = false;
  this._count     = 0;
  this._timeout   = opts.timeout || 3000;
  this._listener  = null;

  this._installListener();

  var frame;
  if (opts.frameId) {
    frame = document.getElementById(opts.frameId);
  }

  // If using a passed iframe, poll the hub for a ready message
  if (frame) {
    this._poll();
  }

  // Create the frame if not found or specified
  frame = frame || this._createFrame(url);
  this._hub = frame.contentWindow;
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
 * Returns the origin of an url, with cross browser support. Accommodates
 * the lack of location.origin in IE, as well as the discrepancies in the
 * inclusion of the port when using the default port for a protocol, e.g.
 * 443 over https.
 *
 * @param   {string} url The url to a cross storage hub
 * @returns {string} The origin of the url
 */
CrossStorageClient._getOrigin = function(url) {
  var uri, origin;

  uri = document.createElement('a');
  uri.href = url;

  origin = uri.protocol + '//' + uri.host;
  origin = origin.replace(/:80$|:443$/, '');

  return origin;
};

/**
 * UUID v4 generation, taken from: http://stackoverflow.com/questions/
 * 105034/how-to-create-a-guid-uuid-in-javascript/2117523#2117523
 *
 * @returns {string} A UUID v4 string
 */
CrossStorageClient._generateUUID = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16|0, v = c == 'x' ? r : (r&0x3|0x8);

    return v.toString(16);
  });
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
    return this._promise.resolve();
  }

  var client = this;

  return new this._promise(function(resolve, reject) {
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
 * Returns a promise that, when resolved, passes an array of all keys
 * currently in storage.
 *
 * @returns {Promise} A promise that is settled on hub response or timeout
 */
CrossStorageClient.prototype.getKeys = function() {
  return this._request('getKeys');
};

/**
 * Deletes the iframe and sets the connected state to false. The client can
 * no longer be used after being invoked.
 */
CrossStorageClient.prototype.close = function() {
  var frame = document.getElementById(this._frameId);
  if (frame) {
    frame.parentNode.removeChild(frame);
  }

  // Support IE8 with detachEvent
  if (window.removeEventListener) {
    window.removeEventListener('message', this._listener, false);
  } else {
    window.detachEvent('onmessage', this._listener);
  }

  this._connected = false;
  this._closed = true;
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

  this._listener = function(message) {
    if (client._closed) return;

    // Ignore messages not from our hub
    if (message.origin !== client._origin) return;

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
    window.addEventListener('message', this._listener, false);
  } else {
    window.attachEvent('onmessage', this._listener);
  }
};

/**
 * Invoked when a frame id was passed to the client, rather than allowing
 * the client to create its own iframe. Polls the hub for a ready event to
 * establish a connected state.
 */
CrossStorageClient.prototype._poll = function() {
  var client, interval;

  client = this;
  interval = setInterval(function() {
    if (client._connected) return clearInterval(interval);
    if (!client._hub) return;

    client._hub.postMessage('poll', client._origin);
  }, 1000);
};

/**
 * Creates a new iFrame containing the hub. Applies the necessary styles to
 * hide the element from view, prior to adding it to the document body.
 * Returns the created element.
 *
 * @private
 *
 * @param  {string}            url The url to the hub
 * returns {HTMLIFrameElement} The iFrame element itself
 */
CrossStorageClient.prototype._createFrame = function(url) {
  var frame = window.document.createElement('iframe');
  frame.id = this._frameId;

  // Style the iframe
  for (var key in CrossStorageClient.frameStyle) {
    if (CrossStorageClient.frameStyle.hasOwnProperty(key)) {
      frame.style[key] = CrossStorageClient.frameStyle[key];
    }
  }

  window.document.body.appendChild(frame);
  frame.src = url;

  return frame;
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

  if (this._closed) {
    return this._promise.reject(new Error('CrossStorageClient has closed'));
  }

  client = this;
  client._count++;

  req = {
    id:     this._id + ':' + client._count,
    method: method,
    params: params
  };

  return new this._promise(function(resolve, reject) {
    // Timeout if a response isn't received after 4s
    var timeout = setTimeout(function() {
      if (!client._requests[req.id]) return;

      delete client._requests[req.id];
      reject(new Error('Timeout: could not perform ' + req.method));
    }, client._timeout);

    // Add request callback
    client._requests[req.id] = function(err, result) {
      clearTimeout(timeout);
      if (err) return reject(new Error(err));
      resolve(result);
    };

    // In case we have a broken Array.prototype.toJSON, e.g. because of
    // old versions of prototype
    var originalToJSON;

    if (Array.prototype.toJSON) {
      originalToJSON = Array.prototype.toJSON;
      Array.prototype.toJSON = null;
    }

    // Send serialized message
    client._hub.postMessage(JSON.stringify(req), client._origin);

    // Restore original toJSON
    if (originalToJSON) {
      Array.prototype.toJSON = originalToJSON;
    }
  });
};
