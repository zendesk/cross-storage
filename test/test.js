var expect = require('expect.js');
// Note: IE8 requires that catch be referenced as ['catch'] on a promise

describe('CrossStorageClient', function() {
  this.timeout(15000);

  var origin = CrossStorageClient._getOrigin(window.location.href);
  var url = origin + '/test/hub.html';
  var storage = new CrossStorageClient(url, 5000);

  var setGet = function(key, value, ttl) {
    return function() {
      return storage.set(key, value, ttl).then(function() {
        return storage.get(key);
      });
    };
  };

  // Used to delete keys before each test
  var cleanup = function(fn) {
    storage.onConnect().then(function() {
      return storage.del('key1', 'key2');
    })
    .then(fn)
    ['catch'](fn);
  };

  describe('Constructor', function() {
    it('parses the passed url and stores its origin', function() {
      expect(storage._origin).to.be(origin);
    });

    it('sets its connected status to false', function() {
      var storage = new CrossStorageClient(url);
      expect(storage._connected).to.be(false);
    });

    it('initializes _requests as an empty object', function() {
      var storage = new CrossStorageClient(url);
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
      // constructor.name isn't cross browser, and the window function name
      // varies between browsers (WindowConstructor, Window, etc)
      expect(storage._hub).to.not.be(null);
    });
  });

  describe('onConnect', function() {
    beforeEach(function(done) {
      cleanup(done);
    });

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

  it('fails to make any requests not within its permissions', function(done) {
    var url = origin + '/test/getOnlyHub.html';
    var storage = new CrossStorageClient(url, 5000);

    storage.onConnect().then(function() {
      return storage.set('key1', 'new');
    })['catch'](function(err) {
      expect(err.message).to.be('Invalid permissions for set');
      done();
    });
  });

  it('fails to make any requests if not of an allowed origin', function(done) {
    var url = origin + '/test/invalidOriginHub.html';
    var storage = new CrossStorageClient(url, 5000);

    storage.onConnect().then(function() {
      return storage.set('key1', 'new');
    })['catch'](function(err) {
      expect(err.message).to.be('Invalid permissions for set');
      done();
    });
  });

  describe('given sufficient permissions', function() {
    beforeEach(function(done) {
      cleanup(done);
    });

    it('can set a key to the specified value', function(done) {
      var key = 'key1';
      var value = 'foo';

      storage.onConnect()
      .then(setGet(key, value))
      .then(function(res) {
        expect(res).to.eql(value);
        done();
      })['catch'](done);
    });

    it('can set objects as the value', function(done) {
      var key = 'key1';
      var object = {foo: 'bar'};

      storage.onConnect()
      .then(setGet(key, object))
      .then(function(res) {
        expect(res).to.eql(object);
        done();
      })['catch'](done);
    });

    it('can overwrite existing values', function(done) {
      var key = 'key1';
      var value = 'new';

      storage.onConnect().then(function() {
        return storage.set(key, 'old');
      })
      .then(setGet(key, value))
      .then(function(res) {
        expect(res).to.eql(value);
        done();
      })['catch'](done);
    });

    it('can set a ttl on the key', function(done) {
      var key = 'key1';
      var value = 'foobar';

      var delay = function() {
        // Delay by 100ms
        return new Promise(function(resolve, reject) {
          setTimeout(resolve, 100);
        });
      };

      storage.onConnect()
      .then(setGet(key, value, 50))
      .then(delay)
      .then(function() {
        return storage.get(key);
      }).then(function(res) {
        expect(res).to.be(null);
        done();
      })['catch'](done);
    });

    it('returns an array of values if get is passed multiple keys', function(done) {
      var keys = ['key1', 'key2'];
      var values = ['foo', 'bar'];

      storage.onConnect()
      .then(setGet(keys[0], values[0]))
      .then(setGet(keys[1], values[1]))
      .then(function() {
        return storage.get(keys[0], keys[1]);
      })
      .then(function(res) {
        expect(res).to.eql([values[0], values[1]]);
        done();
      })['catch'](done);
    });

    it('can delete multiple keys', function(done) {
      var keys = ['key1', 'key2'];
      var values = ['foo', 'bar'];

      storage.onConnect()
      .then(setGet(keys[0], values[0]))
      .then(setGet(keys[1], values[1]))
      .then(function() {
        return storage.del(keys[0], keys[1]);
      }).then(function() {
        return storage.get(keys[0], keys[1]);
      })
      .then(function(res) {
        expect(res).to.eql([null, null]);
        done();
      })['catch'](done);
    });
  });
});
