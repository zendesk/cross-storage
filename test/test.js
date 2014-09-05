var expect = require('expect.js');
// Note: IE8 requires that catch be referenced as ['catch'] on a promise

describe('CrossStorageClient', function() {
  // Mocha detects the frame id as being leaked in IE
  var userAgent = window.navigator.userAgent;
  var ieDetected = (userAgent.indexOf('MSIE ') !== false ||
    !!navigator.userAgent.match(/Trident.*rv\:11\./));

  if (global.mocha && ieDetected) {
    global.mocha.globals(['CrossStorageClient-*']);
  }

  var origin, url, storage;

  this.timeout((window.location.hostname === 'localhost') ? 5000 : 60000);
  origin = CrossStorageClient._getOrigin(window.location.href);
  url = origin + '/test/hub.html';

  // Create initial client
  before(function(done) {
    var invoked = false;
    var next = function(msg) {
      if (msg.data !== 'ready' || invoked) return;
      invoked = true;
      done();
    };

    if (window.addEventListener) {
      window.addEventListener('message', next, false);
    } else {
      window.attachEvent('onmessage', next);
    }

    storage = new CrossStorageClient(url, {timeout: 10000});
  });

  // Cleanup old iframes
  afterEach(function() {
    var iframes = document.getElementsByTagName('iframe');
    for (var i = 0; i < iframes.length; i++) {
      if (iframes[i].src !== url) {
        iframes[i].parentNode.removeChild(iframes[i]);
      }
    }
  });

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

    it('sets _timeout to opts.timeout, if provided', function() {
      expect(storage._timeout).to.be(10000);
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

    it('sets the frame id to _frameId', function() {
      var frame = document.getElementById(storage._frameId);
      expect(frame).not.to.be(null);
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

  describe('close', function() {
    var storage;

    before(function(done) {
      storage = new CrossStorageClient(url);
      storage.onConnect().then(function() {
        storage.close();
        done();
      });
    });

    it('sets _connected to false', function() {
      expect(storage._connected).to.be(false);
    });

    it('deletes the iframe', function() {
      var frame = document.getElementById(storage._frameId);
      expect(frame).to.be(null);
    });
  });

  it('fails to make any requests not within its permissions', function(done) {
    var url = origin + '/test/getOnlyHub.html';
    var storage = new CrossStorageClient(url, {timeout: 50000});

    storage.onConnect().then(function() {
      return storage.set('key1', 'new');
    })['catch'](function(err) {
      expect(err.message).to.be('Invalid permissions for set');
      done();
    });
  });

  it('fails to make any requests if not of an allowed origin', function(done) {
    var url = origin + '/test/invalidOriginHub.html';
    var storage = new CrossStorageClient(url, {timeout: 50000});

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

    it('returns null when calling get on a non-existent key', function(done) {
      storage.onConnect()
      .then(function() {
        return storage.get('key1');
      }).then(function(res) {
        expect(res).to.be(null);
        done();
      })['catch'](done);
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

    it('can retrieve all keys using getKeys', function(done) {
      var keys = ['key1', 'key2'];
      var values = ['foo', 'bar'];

      storage.onConnect()
      .then(setGet(keys[0], values[0]))
      .then(setGet(keys[1], values[1]))
      .then(function() {
        return storage.getKeys();
      })
      .then(function(res) {
        // key order varies in some browsers
        expect(res).to.have.length(2);
        expect(res).to.contain(keys[0], keys[1]);
        done();
      })['catch'](done);
    });
  });
});
