# cross-storage

Cross domain local storage. Features an API using ES6 promises.

## Overview

The library is a convenient alternative to sharing a root domain cookie.
Unlike cookies, your client-side data isn't limited to a few kilobytes - you
get a guaranteed 2.49Mb. This is all thanks to LocalStorage, which is available
in IE 8+, FF 3.5+, Chrome 4+, as well as a majority of mobile browsers. For a
list of compatible browsers, refer to
[caniuse](http://caniuse.com/#feat=namevalue-storage).

How does it work? The library is divided into two types of components: hubs
and clients. The hubs reside on a host of choice and interact directly with
the LocalStorage API. The clients then load said hub over an embedded iframe
and post messages, requesting data to be stored, retrieved, and deleted. This
allows multiple clients to access and share the data located in a single store.

Care should be made to limit the origins of the bidirectional communication.
As such, when initializing the hub, a RegExp is passed. Any messages from
clients whose origin does not match the pattern are ignored.

**Hub**

``` javascript
CrossStorageHub.init(/.*\.example.com$/);
```

Note the $ for matching the end of the string. The RegExp in the above example
will match origins such as valid.example.com, but not
invalid.example.com.malicious.com.

**Client**

``` javascript
var storage = new CrossStorageClient('https://example.com/hub.html');

storage.onConnect().then(function() {
  // Set a key with a TTL of 90 seconds
  return storage.set('newKey', 'foobar', 90000);
}).then(function() {
  return storage.get('existingKey', 'newKey');
}).then(function(res) {
  console.log(res.length); // 2
}).catch(function(err) {
  // Handle error
});
```

## Installation

Once made public, the module will be available via bower:

``` bash
bower install cross-storage
```

## API

#### CrossStorageHub.init

Initializes the cross storage hub to accept requests from any origin
matching the specified RegExp. A 'ready' message is sent to the parent
window once complete.

``` javascript
CrossStorageHub.init(/localhost:3000$/);
```

#### Class: CrossStorageClient

Constructs a new cross storage client given the url to a hub. An iframe
is created within the document body that points to the specified url.

``` javascript
var storage = new CrossStorageClient('http://localhost:3000/example/hub.html');
```

#### CrossStorageClient.prototype.onConnect

Returns a promise that is fulfilled when a connection has been established
with the cross storage hub. Its use is recommended to avoid sending any
requests prior to initialization being complete.

``` javascript
storage.onConnect().then(function() {
  // ready!
});
```

#### CrossStorageClient.prototype.set

Sets a key to the specified value, optionally accepting a ttl to passively
expire the key after a number of milliseconds. Returns a promise that is
fulfilled on success, or rejected if any errors setting the key occurred,
or the request timed out.

``` javascript
storage.onConnect().then(function() {
  return storage.set('key', {foo: 'bar'});
}).then(function() {
  return storage.set('expiringKey', 'foobar', 10000);
});
```

#### CrossStorageClient.prototype.get

Accepts one or more keys for which to retrieve their values. Returns a
promise that is settled on hub response or timeout. On success, it is
fulfilled with the value of the key if only passed a single argument.
Otherwise it's resolved with an array of values. On failure, it is rejected
with the corresponding error message.

``` javascript
storage.onConnect().then(function() {
  return storage.get('key1');
}).then(function(res) {
  return storage.get('key1', 'key2', 'key3');
}).then(function(res) {
  // ...
});
```

#### CrossStorageClient.prototype.del

Accepts one or more keys for deletion. Returns a promise that is settled on
hub response or timeout.

``` javascript
storage.onConnect().then(function() {
  return storage.del('key1', 'key2');
});
```

## Compatibility

For compatibility with older browsers, simply load a Promise polyfill such as
[es6-promise](https://github.com/jakearchibald/es6-promise).

``` html
<script src="https://s3.amazonaws.com/es6-promises/promise-1.0.0.min.js"></script>
```

You can also use RSVP or any other ES6 compliant promise library. Supports IE8
and up using the above polyfill. A JSON polyfill is also required
for IE8 in Compatibility View.

## Building

The minified, production JavaScript can be generated with gulp by running
`gulp dist`. If not already on your system, gulp can be installed using
`npm install -g gulp`

## Tests

Tests can be ran locally using `npm test` Tests are built using Zuul for
eventual easy integration with SauceLabs for multi-browser testing.
