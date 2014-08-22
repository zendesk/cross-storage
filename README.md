# cross-storage

Cross domain local storage. Features an API using ES6 promises.

Hub

``` javascript
CrossStorageHub.init(/.*\.example.com$/);
```

Client

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

## Compatibility

For compatibility with older browsers, simply load a Promise polyfill such as
[es6-promise](https://github.com/jakearchibald/es6-promise).

``` html
<script src="https://s3.amazonaws.com/es6-promises/promise-1.0.0.min.js"></script>
```

You can also use RSVP or any other ES6 compliant promise library. Supports IE8
and up using the above polyfill. A JSON polyfill is also required
for IE8 in Compatibility View.

## Tests

Tests can be ran locally using `npm test` Tests are built using Zuul, for
eventual easy integration with SauceLabs for multi-browser testing.
