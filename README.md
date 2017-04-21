# web-eid.js &middot; [![npm version](https://badge.fury.io/js/web-eid.svg)](https://www.npmjs.com/package/web-eid) [![Bower version](https://badge.fury.io/bo/web-eid.svg)](https://github.com/web-eid/web-eid.js)

 [`web-eid.js`](./web-eid.js) is a ultrathin wrapper on top of the messaging interface provided by [Web eID app](https://github.com/web-eid/web-eid/wiki/MessagingAPI), either via [`hwcrypto-extension`](https://github.com/hwcrypto/hwcrypto-extension) [HTML5 postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) interface or [WebSockets](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API) or some other message transport in the future (like Android Intents)

It makes using the features provided by Web eID installation as available via [web-eid.com](https://web-eid.com) super-easy:

- provides an asynchronous, Promise-based DWIM interface
- listens to incoming messages and turns them into resolved Promises

## Installation

### Browser installation
Just download the file and use it in a script tag

    <script src="web-eid.js"></script>

Functionality will be bound to `window.webeid`

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
- The `message` property of a rejected promise (an [Error](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Error)) will contain a symbolic error code that can be parsed
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


- resolves to `true` or `false`, depending on whether necessary client software is present and available or not
- if `false`, the recommended action is to display a notice with a link to https://web-eid.com
- if called with `timeout = Infinity`, the recommended action is to display a dynamic notice during the call that asks the user to install or start the client app
- recommended use: guard function before dynamicallly showing login button; general client availability check before calling rest of the API etc
- possible changes: Boolean https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean

## PKI operations

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

## PC/SC operations
- if rejected, the message of the Error object for PC/SC operations will be a [PC/SC API error code](https://pcsclite.alioth.debian.org/api/group__ErrorCodes.html) as a string (e.g. `SCARD_E_NOT_TRANSACTED`)

### `webeid.connect()`
- resolves to a `object`
  - `reader` - `string` - name of the reader
  - `protocol` - `string` - (optional) protocol of the connection (`T=0` or `T=1`)
  - `atr` - `ArrayBuffer` - ATR of the card, as reported by the host PC/SC API
- equivalent of [`SCardConnect`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379474(v=vs.85).aspx) in the PC/SC API

### `webeid.transmit(bytes)`
- resolves to `ArrayBuffer` of the response
- equivalent of [`SCardTransmit`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379804(v=vs.85).aspx) in PC/SC API
- resembles [transmitRaw](https://globalplatform.github.io/WebApis-for-SE/doc/#dom-channel-transmitraw), without the tidbits of channels or `61XX`/`6CXX` handling
- comparable to [transceive()](https://developer.android.com/reference/android/nfc/tech/IsoDep.html#transceive(byte[])) in Android IsoDep API

### `webeid.control(code, bytes)`
- resolves to `ArrayBuffer` of the response
- equivalent of [`SCardControl`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379474(v=vs.85).aspx) in PC/SC API

### `webeid.disconnect()`
- equivalent of [`SCardDisconnect`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379475(v=vs.85).aspx) in PC/SC API

## Error codes
- TBD
