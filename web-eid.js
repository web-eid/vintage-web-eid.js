(function (window) {
  'use strict';

  var VERSION = "0.0.4";
  // make a nonce
  function getNonce(l) {
    if (l === undefined) {
      l = 24;
    }
    var val = "";
    var hex = "abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVXYZ";
    for (var i = 0; i < l; i++) val += hex.charAt(Math.floor(Math.random() * hex.length));
    return val;
  }

  var pending = {}; // pending promises

  // Resolve or reject the promise if extension and id match
  function processMessage(m) {
    var reply = m.data;
    if (reply.extension) {
      if (reply.id && reply.id in pending) {
        console.log("RECV: " + JSON.stringify(reply));
        if (!reply.error) {
          pending[reply.id].resolve(reply);
        } else {
          pending[reply.id].reject(new Error(reply.error));
        }
        delete pending[reply.id];
      }
    }
  }

  // Send a message and return the promise.
  function msg2promise(msg) {
    return new Promise(function (resolve, reject) {
      // amend with necessary metadata
      msg["id"] = getNonce();
      msg["hwcrypto"] = true; // This will be removed by content script
      console.log("SEND: " + JSON.stringify(msg));
      // send message to content script
      window.postMessage(msg, "*");
      // and store promise callbacks
      pending[msg["id"]] = {
        resolve: resolve,
        reject: reject,
      };
    });
  }

  // construct
  var webeid = function () {
    console.log("Web eID JS shim v" + VERSION);
    // register incoming message handler
    window.addEventListener('message', processMessage);
    // Fields to be exported
    var fields = {};

    fields.hasExtension = function () {
      console.log("Testing for extension");
      var v = msg2promise({});
      var t = new Promise(function (resolve, reject) {
        setTimeout(reject, 700, 'timeout'); // TODO: make faster ?
      });
      return Promise.race([v, t]).then(function (r) {
        return r.extension;
      });
    };

    fields.getVersion = function () {
      return msg2promise({
        "version": {},
      }).then(function (r) {
        return r.version;
      });
    };

    fields.isAvailable = function () {
      fields.hasExtension().then(function (v) {
        fields.getVersion().then(function (v) {
          return true;
        }).catch(function (err) {
          return false;
        });
      }).catch(function (err) {
        return false;
      });
    };

    fields.getCertificate = function () {
      // resolves to a certificate handle (in real life b64)
      return msg2promise({ "cert": {} }).then(function (r) {
        return atob(r.cert);
      });
    };

    fields.sign = function (cert, hash, options) {
      return msg2promise({
        "sign": {
          "cert": btoa(cert),
          "hash": btoa(hash),
          "hashalgo": options.hashalgo,
        },
      }).then(function (r) {
        return atob(r.signature);
      });
    };

    fields.auth = function (nonce) {
      return msg2promise({
        "auth": { "nonce": nonce },
      }).then(function (r) {
        return r.token;
      });
    };

    fields.connect = function (protocol) {
      return msg2promise({
        "SCardConnect": { "protocol": protocol },
      }).then(function (r) {
        return { "reader": r.reader, "atr": r.atr, "protocol": r.protocol };
      });
    };

    // TODO: ByteBuffer instead of hex
    fields.transmit = function (apdu) {
      return msg2promise({
        "SCardTransmit": { "bytes": apdu },
      }).then(function (r) {
        return r.bytes;
      });
    };

    fields.disconnect = function () {
      return msg2promise({
        "SCardDisconnect": {},
      }).then(function (r) {
        return {};
      });
    };

    fields.VERSION = VERSION;
    fields.promisify = msg2promise;

    return fields;
  };

  // Register
  if (typeof (exports) !== 'undefined') {
    // nodejs
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = webeid();
    }
    exports.webeid = webeid();
  } else {
    // requirejs
    if (typeof (define) === 'function' && define.amd) {
      define(function () {
        return webeid();
      });
    } else {
      // browser
      window.webeid = webeid();
    }
  }
})(typeof window === 'object' ? window : this);
