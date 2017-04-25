(function (window) {
  'use strict'

  var VERSION = '0.0.5'
  var APPURL = 'wss://app.web-eid.com:42123'

  // make a nonce
  function getNonce (l) {
    if (l === undefined) {
      l = 24
    }
    var val = ''
    var hex = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVXYZ'
    for (var i = 0; i < l; i++) val += hex.charAt(Math.floor(Math.random() * hex.length))
    return val
  }

  var ws // websocket
  var pending = {} // pending promises
  var technology = null

  // Resolve or reject the promise if id matches
  function processMessage (reply) {
    if (reply.id && reply.id in pending) {
      console.log('RECV: ' + JSON.stringify(reply))
      if (!reply.error) {
        pending[reply.id].resolve(reply)
      } else {
        pending[reply.id].reject(new Error(reply.error))
      }
      delete pending[reply.id]
    } else {
      console.error('id missing on not matched in a reply')
    }
  }

  function exthandler (m) {
    if (m.data.extension) {
      return processMessage(m.data)
    }
  }

  function wshandler (m) {
    console.log('WS message', m)
    return processMessage(JSON.parse(m.data))
  }

  function postws (m) {
    ws.send(JSON.stringify(m))
  }

  function postext (m) {
    m['hwcrypto'] = true // This will be removed by content script
    window.postMessage(m, '*')
  }

  // Send a message and return the promise.
  function msg2promise (msg, tech) {
    //
    return new Promise(function (resolve, reject) {
      // amend with necessary metadata
      msg['id'] = getNonce()
      console.log('SEND: ' + JSON.stringify(msg))
      // send message
      tech = tech || technology
      if (tech === 'websocket') { postws(msg) } else if (tech === 'webextension') { postext(msg) } else { reject(new Error('Could not send message, no backend')) }
      // and store promise callbacks
      pending[msg['id']] = {
        resolve: resolve,
        reject: reject
      }
    })
  }

  // construct
  var webeid = function () {
    console.log('Web eID JS shim v' + VERSION)

    // register incoming message handler for extension
    window.addEventListener('message', exthandler)

    // Fields to be exported
    var fields = {}

    // resolves to true or false
    fields.hasExtension = function () {
      console.log('Testing for extension')
    }

    // Returns app version
    fields.getVersion = function () {
      return msg2promise({
        'version': {}
      }).then(function (r) {
        return r.version
      })
    }

    // first try extension, then try ws
    // possibly do some UA parsing here?
    fields.isAvailable = function (timeout) {
      // If the extension is not responding, the only
      // way to get a connection without reloading the page
      // is if the application is download and started
      // thus only websockets must be re-tried
      console.log('Detecting, timeout is ', timeout)

      if (typeof timeout === 'undefined') { timeout = 0 }
      if (typeof timeout === 'number') { timeout = timeout * 1000 }
      if (timeout === 0) { timeout = 700 }
      if (timeout === Infinity) { timeout = 10 * 60 * 1000 } // 10 minutes
      console.log('Actual timeout is', timeout / 1000, 'seconds')
      var retry = true

      // Try to open the websocket and increase the timeout if it fails
      // and our timeout is Infinity
      // This will only successfully resolve
      function openSocket () {
        var delay = 1000 // delay before trying to re-connect socket
        return new Promise(function (resolve, reject) {
          function connect () {
            delay = delay * 1.3
            try {
              ws = new WebSocket(APPURL)

              ws.addEventListener('open', function (event) {
                console.log('WS open', event)
                // clearTimeout(retry)
                console.log('websocket transport activated')
                resolve('websocket')
              })
              ws.addEventListener('message', wshandler)
              ws.addEventListener('error', function (event) {
                console.error('WS error: ', event)
              })
              ws.addEventListener('close', function (event) {
                console.error('WS close: ', event)
                if (retry) {
                  setTimeout(function () {
                    console.log('Will retry in', delay / 1000, 'seconds')
                    connect()
                  }, delay)
                }
              })
            } catch (e) {
              console.log('Could not create WS', e)
            }
          }
          connect()
        })
      }

      // Race for a port

      // Resolves if extension replies. Will never happen if no extension
      var e = msg2promise({}, 'webextension').then(function (response) { return fields.getVersion() }).then(function (response) { return 'webextension' })

      // Rejects after timeout
      var t = new Promise(function (resolve, reject) {
        setTimeout(function () {
          retry = false
          reject(new Error('timeout'))
        }, timeout)
      })
      // resolves if open is successful
      var s = openSocket()

      // Race to connection
      return Promise.race([e, s, t]).then(function (r) {
        console.log('race resolved to ', r)
        technology = r
        return technology
      }).catch(function (err) {
        console.log('Detection race failed', err)
        return false
      })
    }

    fields.getCertificate = function () {
      // resolves to a certificate handle (in real life b64)
      return msg2promise({ 'cert': {} }).then(function (r) {
        return window.atob(r.cert)
      })
    }

    fields.sign = function (cert, hash, options) {
      return msg2promise({
        'sign': {
          'cert': window.btoa(cert),
          'hash': window.btoa(hash),
          'hashalgo': options.hashalgo
        }
      }).then(function (r) {
        return window.atob(r.signature)
      })
    }

    fields.auth = function (nonce) {
      return msg2promise({
        'auth': { 'nonce': nonce }
      }).then(function (r) {
        return r.token
      })
    }

    fields.connect = function (protocol) {
      return msg2promise({
        'SCardConnect': { 'protocol': protocol }
      }).then(function (r) {
        return { 'reader': r.reader, 'atr': r.atr, 'protocol': r.protocol }
      })
    }

    // TODO: ByteBuffer instead of hex
    fields.transmit = function (apdu) {
      return msg2promise({
        'SCardTransmit': { 'bytes': apdu }
      }).then(function (r) {
        return r.bytes
      })
    }

    fields.disconnect = function () {
      return msg2promise({
        'SCardDisconnect': {}
      }).then(function (r) {
        return {}
      })
    }

    fields.VERSION = VERSION
    fields.promisify = msg2promise

    return fields
  }

  // Register
  if (typeof exports !== 'undefined') {
    // nodejs
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = webeid()
    } else {
      exports.webeid = webeid()
    }
  } else {
    // requirejs
    if (typeof define === 'function' && define.amd) {
      define(function () {
        return webeid()
      })
    } else {
      // browser
      window.webeid = webeid()
    }
  }
})(typeof window === 'object' ? window : this)
