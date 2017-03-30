(function (window) {
  'use strict';

  var VERSION = "0.0.2";
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

  var pending = null; // pending promise

  // Resolve or reject the promise if extension and id match
  function processMessage(m) {
    var reply = m.data;
    if (reply.extension) {
      if (reply.id && pending.id == reply.id) {
        console.log("RECV: " + JSON.stringify(reply));
        if (reply.result == "ok" && !reply.error) {
          pending.resolve(reply);
        } else {
          pending.reject(new Error(reply.result));
        }
        pending = null;
      }
    }
  }

  // Send a message and return the promise.
  function msg2promise(msg) {
    if (pending != null) {
      return Promise.reject(new Error("operation_pending")); // TODO: define
    }
    return new Promise(function (resolve, reject) {
        // amend with necessary metadata
      msg["id"] = getNonce();
      msg["hwcrypto"] = true; // This will be removed by content script
      console.log("SEND: " + JSON.stringify(msg));
        // send message to content script
      window.postMessage(msg, "*");
        // and store promise callbacks
      pending = {
        resolve: resolve,
        reject: reject,
        id: msg["id"]
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
        "type": "VERSION",
      }).then(function (r) {
        return r.version;
      });
    };

    fields.getCertificate = function () {
      // resolves to a certificate handle (in real life b64)
      return msg2promise({ "type": "CERT" }).then(function (r) {
        return r.cert;
      });
    };

    fields.sign = function (cert, hash) {
      return msg2promise({
        "type": "SIGN",
        "cert": cert,
        "hash": hash,
      }).then(function (r) {
        return r.signature;
      });
    };

    fields.auth = function (nonce) {
      return msg2promise({
        "type": "AUTH",
        "nonce": nonce,
      }).then(function (r) {
        return r.token;
      });
    };

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
