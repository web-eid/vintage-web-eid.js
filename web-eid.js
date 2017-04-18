(function (window) {
  'use strict';

  var VERSION = "0.0.5";
  var APPURL = "wss://app.web-eid.com:42123";

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

  var ws; // websocket
  var poster = postext; // By default post to extension
  var pending = {}; // pending promises

  // Resolve or reject the promise if id matches
  function processMessage(reply) {
    if (reply.id && reply.id in pending) {
      console.log("RECV: " + JSON.stringify(reply));
      if (!reply.error) {
        pending[reply.id].resolve(reply);
      } else {
        pending[reply.id].reject(new Error(reply.error));
      }
      delete pending[reply.id];
    } else {
      console.error("id missing on not matched in a reply");
    }
  }

  function exthandler(m) {
    if (m.data.extension) {
      return processMessage(m.data);
    }
  }

  function wshandler(m) {
    return processMessage(JSON.parse(m.data));
  }

  function postws(m) {
    ws.send(JSON.stringify(m));
  }

  function postext(m) {
    m["hwcrypto"] = true; // This will be removed by content script
    window.postMessage(m, "*");
  }

  // Send a message and return the promise.
  function msg2promise(msg) {
    return new Promise(function (resolve, reject) {
      // amend with necessary metadata
      msg["id"] = getNonce();
      console.log("SEND: " + JSON.stringify(msg));
      // send message to content script
      poster(msg);
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
    window.addEventListener('message', exthandler);

    ws = new WebSocket(APPURL);
    ws.addEventListener('message', wshandler);
    ws.addEventListener('error', function (event) {
      console.error(event);
    });

    // Fields to be exported
    var fields = {};

    // resolves to true or false
    fields.hasExtension = function () {
      console.log("Testing for extension");
      var v = msg2promise({});
      // If there is no extension, we shall never get a response.
      // Thus use Promise.race() with a sensible timeout
      var t = new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject('timeout');
        }, 700); // TODO: make faster ?
      });

      return Promise.race([v, t]).then(function (r) {
        return true;
      }).catch(function (err) {
        return false;
      });
    };

    // Returns app version
    fields.getVersion = function () {
      return msg2promise({
        "version": {},
      }).then(function (r) {
        return r.version;
      });
    };

    // first try extension, then try ws
    // possibly do some UA parsing here?
    fields.isAvailable = function () {
      return fields.hasExtension().then(function (v) {
        if (!v) {
          console.log("No extension, trying WS");
          // This a mess. make the WS setup properly event based
          if (ws.readyState != 1) {
            console.log("WS is not open");
            return false;
          } else {
            poster = postws;
          }
        } else {
          // Extension
          poster = postext;
        }
        return fields.getVersion().then(function (v) {
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
    } else {
      exports.webeid = webeid();
    }
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
