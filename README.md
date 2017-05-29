# web-eid.js &middot; [![npm version](https://badge.fury.io/js/web-eid.svg)](https://www.npmjs.com/package/web-eid) [![Bower version](https://badge.fury.io/bo/web-eid.svg)](https://github.com/web-eid/web-eid.js)

 [`web-eid.js`](./web-eid.js) is a ultrathin wrapper on top of the [messaging interface](https://github.com/web-eid/web-eid/wiki/MessagingAPI) provided by the [Web eID app](https://github.com/web-eid/web-eid), either via [`web-eid-extension`](https://github.com/web-eid/web-eid-extension) [HTML5 postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) interface or [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) or some other message transport in the future (like Android Intents)

It makes using the features provided by Web eID installation as available via [web-eid.com](https://web-eid.com) super-easy:

- provides an asynchronous, Promise-based DWIM interface
- listens to incoming messages and turns them into resolved Promises

## Installation

### Browser installation
Just download the file and use it in a script tag

    <script src="web-eid.js"></script>

Functionality shall be bound to `window.webeid`

## Bower
    $ bower install --save web-eid

## Webpack & Browserify
    $ npm install --save web-eid

And simply

    webeid = require('web-eid');

### Note for IE users
IE 11 does not have [`Promise` support](http://caniuse.com/#search=promise), thus a polyfill is required.

# API
- All calls are asynchronous in nature and return a Promise
- While asynchronous, the API is still sequential - only one call can be serviced by a smart card (reader) at a time. If a call can not be serviced because this reason, the promise shall be rejected
- The `message` property of a rejected promise (an [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)) shall contain a symbolic error code that can be parsed
- Conformance to https://www.w3.org/2001/tag/doc/promises-guide is intended

## Note about API and stability
At this point of time no API stability is assured. Please note that if `window.hwcrypto` from [hwcrypto.js](https://github.com/hwcrypto/hwcrypto.js) is detected, `hwcrypto.getCertificate()` and `hwcrypto.sign()` are monkeypatched.

#### Timeouts
By default the execution time of a call depends on the underlying hardware and timeout is infinite. A timeout can be set for some calls, so that the operations that depend on user action would fail sooner (e.g. do not wait forever but fail in 2 minutes, if the user does not connect a card reader and insert a card in time) or set to `0` to get an instant error code. Please note that not all calls are cancelable on all platforms, due to unerlying platform limitations.

### `isAvailable`
```javascript
webeid.isAvailable(object options)
```

| parameter  | type        |                                 |
|------------|-------------|---------------------------------|
| `options`  | object      | additional options (_optional_) |

| `options` |                                                 |
|-----------|-------------------------------------------------|
| `timeout` | timeout in seconds or `Infinity`. Default is `0`|


- resolves to `false` if client software is not available or to a string that describes the connection type of the application (`webextension` or `websocket`)
- if `false`, the recommended action is to display a notice with a link to https://web-eid.com
- if called with `timeout = Infinity`, the recommended action is to display a dynamic notice during the call that asks the user to install or start the client app
- recommended use: guard function before dynamicallly showing login button; general client availability check before calling rest of the API etc

## PKI operations
If a PKI call fails, the promise shall be rejected with an `Error` object, which `message` property shall be a string from [CKR_* series](http://docs.oasis-open.org/pkcs11/pkcs11-base/v2.40/pkcs11-base-v2.40.html#_Toc385057886) (PKCS#11, CNG/CryptoAPI return codes are mapped)

### `authenticate`
```javascript
webeid.authenticate(string nonce, object options)
```

| parameter  | type        |                                      |
|------------|-------------|--------------------------------------|
| `nonce`    | string      | nonce for the session (**required**) |
| `options`  | object      | additional options (_optional_)      |


| `options` |                                                        |
|-----------|--------------------------------------------------------|
| `timeout` | timeout in seconds or `Infinity`. Default is `Infinity`|

- resolves to a `string` containing the JWT token. JWT token description: https://github.com/martinpaljak/x509-webauth/wiki/OpenID-X509-ID-Token
- possible reasons for rejection: timeout or user cancels authentication, no certificates available, some other technical error
- used certificate is available in the `x5c` header field of the JWT token.
- expected behavior: user is instructed though the process of attaching a reader and a card, if necessary
- possible changes: resolving to `undefined` when no certificates are available

### `getCertificate`
```javascript
webeid.getCertificate(object options)
```

| parameter  | type        |                                 |
|------------|-------------|---------------------------------|
| `options`  | object      | additional options (_optional_) |

| `options` |                                                        |
|-----------|--------------------------------------------------------|
| `filter`  | type of certificate to return. Default is `sign`       |
| `timeout` | timeout in seconds or `Infinity`. Default is `Infinity`|

- resolves to an `ArrayBuffer` with the certificate
- intended to be used with the following `webeid.sign()` operation
- expected behavior: user is instructed though the process of attaching a reader and a card, if necessary
- possible reasons for rejection: user cancels certificate selection, no certificates available, some other technical error
- possible changes: resolving to `undefined` when no certificates available

### `sign`
```javascript
webeid.sign(ArrayBuffer certificate, ArrayBuffer hash, object options)
```

| parameter     | type        |                                   |
|---------------|-------------|-----------------------------------|
| `certificate` | ArrayBuffer | certificate to use (**required**) |
| `hash`        | ArrayBuffer | hash to sign (**required**)       |
| `options`     | object      | additional options (_optional_)   |


| `options`  |                                                        |
|------------|--------------------------------------------------------|
| `hashalgo` | hash algorithm type (`"SHA-256"` etc). (**required**)  |
| `timeout`  | timeout in seconds or `Infinity`. Default is `Infinity`|


- resolves to a `ArrayBuffer` containing the signature of the `hash` parameter (ArrayBuffer) generated with the private key belonging to the `certificate` (ArrayBuffer). Hash type is specified in `options.hashalgo` (`string`) and is one of "SHA-256", "SHA-384", "SHA-512"
- possible reasons for rejection: user cancels/refuses signing, user PIN is blocked, some other technical error
- possible changes: support for "last round on card" hashing

## WebSocket operations
### `authenticatedWebSocket`
```javascript
webeid.authenticatedWebSocket(string url, object options)
```

| parameter     | type        |                                   |
|---------------|-------------|-----------------------------------|
| `url`         | string      | URL to connect to (**required**)  |
| `options`     | object      | additional options (_optional_)   |

| `options`           |                                                            |
|---------------------|------------------------------------------------------------|
| `autoclose`         | set to `true` to close the socket when the card is removed |
| `timeout`           | timeout in seconds or `Infinity`. Default is `Infinity`    |

- the first message from the service MUST be JSON and MUST contain the nonce `{"nonce": "noncevalue"}`
- `authenticate()` is called with the nonce
- the authentication token is sent back to the service as JSON `{"token": "authenticationtoken"}`
- promise is resolved with the WebSocket object
- if a card remove event is detected and autoclose is enabled, the socket is closed

## PC/SC operations
- if rejected, the message of the Error object for PC/SC operations shall be a [PC/SC API error code](https://pcsclite.alioth.debian.org/api/group__ErrorCodes.html) as a string (e.g. `"SCARD_E_NOT_TRANSACTED"`)

### `connect`
```
webeid.connect(object options)
```

| parameter  | type        |                                 |
|------------|-------------|---------------------------------|
| `options`  | object      | additional options (_optional_) |

| `options` |                                                        |
|-----------|--------------------------------------------------------|
| `atrs`    | list of expected ATR-s in base64. Default is `[]`      |
| `protocol`| protocol to use (`T=0`, `T=1`, `*`. Default is `*`      |
| `timeout` | timeout in seconds or `Infinity`. Default is `Infinity`|

- resolves to a `Reader` object
  - `name` - `string` - name of the reader
  - `protocol` - `string` - protocol of the connection (`T=0` or `T=1`)
  - `atr` - `ArrayBuffer` - ATR of the card, as reported by the host PC/SC API
  - `transmit(ArrayBuffer)` - `function` - transmits the APDU to the card, returns a Promise that resolves to the response
  - `disconnect()` - `function`- disconnects the card, returns a Promise
  - `reconnect(string protocol)` - `function` - reconnects with the specified protocol, returns a Promise
- equivalent for [`SCardConnect`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379474(v=vs.85).aspx) in the PC/SC API
- `SCardConnect` is called with `SCARD_SHARE_EXCLUSIVE` or if it is not possible, with `SCARD_SHARE_SHARED` and a `SCardBeginTransaction()` on non-Windows machines

### `Reader.transmit(bytes)`
- resolves to `ArrayBuffer` of the response
- equivalent of [`SCardTransmit`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379804(v=vs.85).aspx) in PC/SC API
- resembles [transmitRaw](https://globalplatform.github.io/WebApis-for-SE/doc/#dom-channel-transmitraw), without the tidbits of channels or `61XX`/`6CXX` handling
- comparable for [transceive()](https://developer.android.com/reference/android/nfc/tech/IsoDep.html#transceive(byte[])) in Android IsoDep API

### `Reader.control(code, bytes)`
- resolves to `ArrayBuffer` of the response
- equivalent for [`SCardControl`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379474(v=vs.85).aspx) in PC/SC API

### `Reader.reconnect(protocol)`
- resolves to `true`. `Reader` object properties `protocol` and `atr` might have changed
- equivalent for [`SCardReconnect`](hhttps://msdn.microsoft.com/en-us/library/windows/desktop/aa379797(v=vs.85).aspx) in PC/SC API

### `Reader.disconnect()`
- equivalent for [`SCardDisconnect`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379475(v=vs.85).aspx) in PC/SC API
- `SCardDisconnect` is called with `SCARD_RESET_CARD` argument

## Error codes
- `SCARD_E_READER_UNAVAILABLE` - if `webeid.connect()` has not been called or the reader has disappeared
- `SCARD_E_SHARING_VIOLATION` - if `webeid.connect()` can not establish a reliable (no interference from other applications on the computer) connection to the card
