var expect = require('expect.js');

var url = 'http://localhost:8080/test/hub.html';
var storage = new CrossStorageClient(url);

describe('CrossStorageClient', function() {
  describe('Constructor', function() {
    it('parses the passed url and stores its origin', function() {
      expect(storage._origin).to.be('http://localhost:8080');
    });

    it('sets its connected status to false', function() {
      expect(storage._connected).to.be(false);
    });

    it('initializes _requests as an empty object', function() {
      expect(storage._requests).to.eql({});
    });

    it('creates a hidden iframe', function() {
      var frame = document.getElementsByTagName('iframe')[0];
      expect(frame.style.display).to.be('none');
      expect(frame.style.position).to.be('absolute');
      expect(frame.style.top).to.be('-999px');
      expect(frame.style.left).to.be('-999px');
    });

    it('sets the iframe src to the hub url', function() {
      var frame = document.getElementsByTagName('iframe')[0];
      expect(frame.src).to.be(url);
    });

    it('stores the frame context window in _hub', function() {
      expect(storage._hub.constructor.name).to.be('Window');
    });
  });

  describe('onConnect', function() {
    it('returns a promise that is resolved when connected', function(done) {
      storage.onConnect().then(done);
    });

    it('is not fulfilled if a connection is not established', function(done) {
      var storage = new CrossStorageClient('http://localhost:9999');
      var invoked = false;

      storage.onConnect().then(function() {
        invoked = true;
      });

      setTimeout(function() {
        if (!invoked) return done();

        done(new Error('onConnect fired without connecting'));
      }, 100);
    });
  });

  describe('set', function() {
    beforeEach(function(done) {
      // Delete keys before each test
      storage.onConnect().then(function() {
        return storage.del('key1', 'key2');
      })
      .then(done)
      .catch(done);
    });

    it('sets a key to the specified value', function(done) {
      var key = 'key1';

      storage.onConnect().then(function() {
        return storage.set(key, 'foo');
      }).then(function() {
        return storage.get(key);
      }).then(function(res) {
        expect(res).to.be('foo');
        done();
      }).catch(done);
    });

    it('can set objects as the value', function(done) {
      var key = 'key1';
      var object = {foo: 'bar'};

      storage.onConnect().then(function() {
        return storage.set(key, object);
      }).then(function() {
        return storage.get(key);
      }).then(function(res) {
        expect(res).to.eql(object);
        done();
      }).catch(done);
    });

    it('can overwrite existing values', function(done) {
      var key = 'key1';
      var value = 'new';

      storage.onConnect().then(function() {
        return storage.set(key, 'old');
      }).then(function() {
        return storage.set(key, value);
      }).then(function() {
        return storage.get(key);
      }).then(function(res) {
        expect(res).to.eql(value);
        done();
      }).catch(done);
    });

    it('can set a ttl on the key', function(done) {
      var key = 'key1';
      var value = 'foobar';

      var initialSet = function() {
        // Set the initial value and verify
        return storage.set(key, value, 50).then(function() {
          return storage.get(key);
        }).then(function(res) {
          expect(res).to.be(value);
        });
      };

      var delay = function() {
        // Delay by 100ms
        return new Promise(function(resolve, reject) {
          setTimeout(resolve, 100);
        });
      };

      storage.onConnect()
      .then(initialSet)
      .then(delay)
      .then(function() {
        return storage.get(key);
      }).then(function(res) {
        expect(res).to.be(null);
        done();
      }).catch(done);
    });
  });
});
