# cross-storage

Cross domain local storage. Features an API using ES6 promises.

Hub

``` javascript
CrossStorageHub.init(/.*\.example.com$/);
```

Client

``` javascript
var crossStorage = new CrossStorageClient('https://example.com/hub.html');

crossStorage.onConnect().then(function() {
  // Set a key with a TTL of 90 seconds
  return crossStorage.set('newKey', 'foobar', 90000);
}).then(function() {
  return crossStorage.get('existingKey', 'newKey');
}).then(function(res) {
  console.log(res[0], res[1]);
}).catch(function(err) {
  // Handle error
});
```

## Compatibility

For compatibility with older browsers, simply load a Promise polyfill such as
[es6-promise](https://github.com/jakearchibald/es6-promise).

``` html
<script src="http://s3.amazonaws.com/es6-promises/promise-1.0.0.min.js"></script>
```

You can also use RSVP or any other ES6 compliant promise library. Supports IE8
and up using the above polyfill. A JSON polyfill is also required
for IE8 in Compatibility View.
