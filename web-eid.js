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

  function ab2b (v) {
    return window.btoa(String.fromCharCode.apply(null, new Uint8Array(v)))
  }

  function b2ab (v) {
    return new Uint8Array(window.atob(v).split('').map(function (c) { return c.charCodeAt(0) })).buffer
  }

  var pending = {} // pending promises
  var port = null

  // Resolve or reject the promise if id matches
  function processMessage (reply) {
    // reply.hwcrypto is in window message listener.
    if (!reply.hwcrypto && reply.id && reply.id in pending) {
      console.log('RECV: ' + JSON.stringify(reply))
      if (!reply.error) {
        pending[reply.id].resolve(reply)
      } else {
        pending[reply.id].reject(new Error(reply.error))
      }
      delete pending[reply.id]
    }
  }

  function toExtension (msg) {
    return new Promise(function (resolve, reject) {
      msg.id = getNonce()
      msg.hwcrypto = true // This will be removed by content script
      window.postMessage(msg, '*')
      pending[msg.id] = {
        resolve: resolve,
        reject: reject
      }
    })
  }

  // Send a message and return the promise.
  function msg2promise (msg) {
    return new Promise(function (resolve, reject) {
      // amend with necessary metadata
      msg.id = msg.id || getNonce()
      console.log('SEND: ' + JSON.stringify(msg))
      // send message
      if (!port) { reject(new Error('App has disappeared')) }
      port.send(msg)
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
    window.addEventListener('message', function (message) { processMessage(message.data) })

    // Fields to be exported
    var fields = {}

    // Returns app version
    fields.getVersion = function () {
      return msg2promise({
        'version': {}
      }).then(function (r) {
        return r.version
      })
    }

    fields.isAvailable = function (options) {
      // Already open
      if (port) {
        return Promise.resolve(port.technology)
      }

      // If the extension is not responding, the only
      // way to get a connection without reloading the page
      // is if the application is download and started
      // thus only websockets must be re-tried
      var timeout = 0
      if (options) { timeout = options.timeout || timeout }
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
            if (!retry) { return reject(new Error('Already connected')) }
            delay = delay * 1.3
            try {
              var ws = {}
              ws.socket = new WebSocket(APPURL)
              ws.technology = 'websocket'

              ws.socket.addEventListener('open', function (event) {
                console.log('WS open', event)
                // clearTimeout(retry)
                ws.socket.addEventListener('message', function (m) {
                  processMessage(JSON.parse(m.data))
                })
                ws.send = function (msg) {
                  ws.socket.send(JSON.stringify(msg))
                }
                ws.socket.addEventListener('close', function (event) {
                  console.error('WS close: ', event)
                  if (port.technology === 'websocket') { port = null }
                })
                resolve(ws)
              })
              ws.socket.addEventListener('error', function (event) {
                console.error('WS error: ', event)
                if (retry) {
                  setTimeout(function () {
                    console.log('Will retry in', delay / 1000, 'seconds')
                    connect()
                  }, delay)
                }
              })
            } catch (e) {
              console.log('Could not create WS', e)
              reject(e)
            }
          }
          // give extension head start
          setTimeout(connect, 700)
        })
      }

      // Race for a port
      // Resolves if extension replies. Will never happen if no extension
      var e = toExtension({version: {}}).then(function (response) {
        return {
          send: function (message) {
            message.hwcrypto = true
            window.postMessage(message, '*')
          },
          technology: 'webextension'
        }
      })

      // Rejects after timeout
      var t = new Promise(function (resolve, reject) {
        setTimeout(function () {
          reject(new Error('timeout'))
        }, timeout)
      })

      // resolves to websocket lookalike with .send() if open is successful
      var s = openSocket()

      // Race to connection
      return Promise.race([e, s, t]).then(function (r) {
        retry = false
        console.log('race resolved to', r.technology)
        port = r
        return r.technology
      }).catch(function (err) {
        retry = false
        console.log('race failed', err)
        return false
      })
    }

    fields.getCertificate = function (options) {
      options = options || {}
      // resolves to a certificate handle (in real life b64)
      return msg2promise({ 'certificate': options }).then(function (r) {
        return b2ab(r.certificate)
      })
    }

    fields.sign = function (cert, hash, options) {
      return msg2promise({
        'sign': {
          'certificate': ab2b(cert),
          'hash': ab2b(hash),
          'hashalgo': options.hashalgo
        }
      }).then(function (r) {
        return b2ab(r.signature)
      })
    }

    // TODO: return an object where onLogout resolves if cert removed
    function authenticate (nonce) {
      return msg2promise({
        'authenticate': { 'nonce': nonce }
      }).then(function (r) {
        return r.token
      })
    }
    fields.authenticate = authenticate

    // Connect to a card reader in plain PC/SC mode
    fields.connect = function (options) {
      if (options === 'undefined') { options = {} }

      var timeout = options.timeout || Infinity
      // Infinity is actually 1 hour
      if (timeout === Infinity) { timeout = 3600 }

      var atrs = options.atrs || []
      atrs = atrs.map(function (x) { return ab2b(x) })

      var protocol = options.protocol || '*'

      return msg2promise({
        SCardConnect: {protocol: protocol, atrs: atrs}
      }).then(function (r) {
        return {
          name: r.name,
          atr: b2ab(r.atr),
          protocol: r.protocol,

          transmit: function (bytes) {
            return msg2promise({
              SCardTransmit: {reader: r.name, bytes: ab2b(bytes)}
            }).then(function (r) {
              return b2ab(r.bytes)
            })
          },
          reconnect: function (protocol) {
            return msg2promise({
              SCardReconnect: {reader: r.name, protocol: protocol}
            }).then(function (r) {
              return true
            })
          },
          disconnect: function () {
            return msg2promise({
              SCardDisconnect: {reader: r.name}
            }).then(function (r) {
              return true
            })
          },
          control: function (code, bytes) {
            return msg2promise({
              SCardControl: {reader: r.name, code: code, bytes: ab2b(bytes)}
            }).then(function (r) {
              return b2ab(r.bytes)
            })
          }
        }
      })
    }

    fields.authenticatedWebSocket = function (url, options) {
      return new Promise(function (resolve, reject) {
        var socket = new WebSocket(url)
        socket.addEventListener('open', function (event) {
          var messagelistener = socket.addEventListener('message', function (event) {
            var msg = JSON.parse(event.data)
            if (!msg.nonce) {
              reject(new Error('No .nonce in first message'))
            }
            var nonce = JSON.parse(event.data).nonce
            authenticate(nonce).then(function (token) {
              socket.send(JSON.stringify({token: token}))
              socket.removeEventListener('message', messagelistener)
              resolve(socket)
            })
          })
        })
        socket.addEventListener('error', function (event) {
          reject(event)
        })
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
