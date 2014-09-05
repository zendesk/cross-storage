![cross-storage](https://github.com/zendesk/cross-storage/raw/master/media/logo.png)

Cross domain local storage, with permissions. Enables multiple browser
windows/tabs, across a variety of domains, to share a single localStorage.
Features an API using ES6 promises.

[![Build Status](https://travis-ci.org/zendesk/cross-storage.svg?branch=master)](https://travis-ci.org/zendesk/cross-storage)

* [Overview](#overview)
* [Installation](#installation)
* [API](#api)
  * [CrossStorageHub.init(permissions)](#crossstoragehubinitpermissions)
  * [new CrossStorageClient(url, \[opts\])](#new-crossstorageclienturl-opts)
  * [CrossStorageClient.prototype.onConnect()](#crossstorageclientprototypeonconnect)
  * [CrossStorageClient.prototype.set(key, value, \[ttl\])](#crossstorageclientprototypesetkey-value-ttl)
  * [CrossStorageClient.prototype.get(key1, \[key2\], \[...\])](#crossstorageclientprototypegetkey1-key2-)
  * [CrossStorageClient.prototype.del(key1, \[key2\], \[...\])](#crossstorageclientprototypedelkey1-key2-)
  * [CrossStorageClient.prototype.close()](#crossstorageclientprototypeclose)
* [Compatibility](#compatibility)
* [Building](#building)
* [Tests](#tests)
* [Copyright and license](#copyright-and-license)

## Overview

The library is a convenient alternative to sharing a root domain cookie.
Unlike cookies, your client-side data isn't limited to a few kilobytes - you
get a guaranteed 2.49Mb. For a client-heavy application, you can potentially
shave a few KB off your request headers by avoiding cookies. This is all thanks
to LocalStorage, which is available in IE 8+, FF 3.5+, Chrome 4+, as well as a
majority of mobile browsers. For a list of compatible browsers, refer to
[caniuse](http://caniuse.com/#feat=namevalue-storage).

How does it work? The library is divided into two types of components: hubs
and clients. The hubs reside on a host of choice and interact directly with
the LocalStorage API. The clients then load said hub over an embedded iframe
and post messages, requesting data to be stored, retrieved, and deleted. This
allows multiple clients to access and share the data located in a single store.

Care should be made to limit the origins of the bidirectional communication.
As such, when initializing the hub, an array of permissions objects is passed.
Any messages from clients whose origin does not match the pattern are ignored,
as well as those not within the allowed set of methods. The set of permissions
are enforced thanks to the same-origin policy. However, keep in mind that any
user has full control of their local storage data - it's still client data.
This only restricts access on a per-domain or web app level.

**Hub**

``` javascript
// Config s.t. subdomains can get, but only the root domain can set and del
CrossStorageHub.init([
  {origin: /\.example.com$/,        allow: ['get']},
  {origin: /:(www\.)?example.com$/, allow: ['get', 'set', 'del']}
]);
```

Note the $ for matching the end of the string. The RegExps in the above example
will match origins such as valid.example.com, but not
invalid.example.com.malicious.com.

**Client**

``` javascript
var storage = new CrossStorageClient('https://store.example.com/hub.html');

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

The library can be installed via bower:

``` bash
bower install cross-storage
```

When serving the hub, you may want to set the CORS and CSP headers for your
server depending on client/hub location. For example:

``` javascript
{
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE',
  'Access-Control-Allow-Headers': 'X-Requested-With',
  'Content-Security-Policy':      "default-src 'unsafe-inline' *",
  'X-Content-Security-Policy':    "default-src 'unsafe-inline' *",
  'X-WebKit-CSP':                 "default-src 'unsafe-inline' *",
}
```

If using inline JS to create the hub, you'll need to specify `unsafe-inline`
for the CSP headers. Otherwise, it can be left out if simply including the
init code via another resource.

## API

#### CrossStorageHub.init(permissions)

Accepts an array of objects with two keys: origin and allow. The value
of origin is expected to be a RegExp, and allow, an array of strings.
The cross storage hub is then initialized to accept requests from any of
the matching origins, allowing access to the associated lists of methods.
A 'ready' message is sent to the parent window once complete.

``` javascript
CrossStorageHub.init([
  {origin: /localhost:3000$/, allow: ['get', 'set', 'del']}
]);
```

#### new CrossStorageClient(url, [opts])

Constructs a new cross storage client given the url to a hub. By default,
an iframe is created within the document body that points to the url. It
also accepts an options object, which may include a timeout and frameId. The
timeout, in milliseconds, is applied to each request and defaults to 3000ms.
The options object may also include a frameId, identifying an existing frame
on which to install its listeners.

``` javascript
var storage = new CrossStorageClient('http://localhost:3000/hub.html');

var storage = new CrossStorageClient('http://localhost:3000/hub.html', {
  timeout: 5000,
  frameId: 'storageFrame'
});
```

#### CrossStorageClient.prototype.onConnect()

Returns a promise that is fulfilled when a connection has been established
with the cross storage hub. Its use is recommended to avoid sending any
requests prior to initialization being complete.

``` javascript
storage.onConnect().then(function() {
  // ready!
});
```

#### CrossStorageClient.prototype.set(key, value, [ttl])

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

#### CrossStorageClient.prototype.get(key1, [key2], [...])

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

#### CrossStorageClient.prototype.del(key1, [key2], [...])

Accepts one or more keys for deletion. Returns a promise that is settled on
hub response or timeout.

``` javascript
storage.onConnect().then(function() {
  return storage.del('key1', 'key2');
});
```

#### CrossStorageClient.prototype.close()

Deletes the iframe and sets the connected state to false. The client can
no longer be used after being invoked.

``` javascript
storage.onConnect().then(function() {
  return storage.set('key1', 'key2');
}).catch(function(err) {
  // Handle error
}).then(function() {
  storage.close();
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
for IE8 in Compatibility View. Also note that `catch` is a reserved word in IE8,
and so error handling with promises can be done as:

``` javascript
storage.onConnect().then(function() {
  return storage.get('key1');
}).then(function(res) {
  // ... on success
})['catch'](function(err) {
  // ... on error
});
```

## Building

The minified, production JavaScript can be generated with gulp by running
`gulp dist`. If not already on your system, gulp can be installed using
`npm install -g gulp`

## Tests

Tests can be ran locally using `npm test`. Tests are ran using Zuul, and
the Travis CI build uses Sauce Labs for multi-browser testing as well.

## Copyright and license

Copyright 2014 Zendesk

Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed
under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
CONDITIONS OF ANY KIND, either express or implied. See the License for the
specific language governing permissions and limitations under the License.
