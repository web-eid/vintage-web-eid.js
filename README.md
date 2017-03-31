# web-eid.js &middot; [![npm version](https://badge.fury.io/js/web-eid.svg)](https://badge.fury.io/js/web-eid)

 [`web-eid.js`](./web-eid.js) is a ultrathin wrapper on top of the messaging interface provided by [`hwcrypto-native`](https://github.com/hwcrypto/hwcrypto-native), either via [`hwcrypto-extension`](https://github.com/hwcrypto/hwcrypto-extension) [HTML5 postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) interface or some other message transport in the future (like local web service or Android Intents)

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

# API
- All calls are asynchronous in nature and return a Promise
- While asynchronous, the API is still sequential - only one call can be serviced at a time
- The `message` property of a rejected promise will contain a symbolic error code that can be parsed
- Conformance to https://www.w3.org/2001/tag/doc/promises-guide is intended

## Note about API and stability
At this point of time no API stability is assured. Please note that if `window.hwcrypto` from [hwcrypto.js](https://github.com/hwcrypto/hwcrypto.js) is detected, `hwcrypto.getCertificate()` and `hwcrypto.sign()` are monkeypatched.


### `webeid.isAvailable()`
- resolves to `true` or `false`, depending on whether necessary client software is present or not.
- if not present, the recommended action is to display a notice with a link to https://web-eid.com.
- possible changes: Boolean https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Boolean
- possible changes: resolve to version information

## PKI operations

### `webeid.authenticate(nonce)`
- resolves to a `string` containing the JWT token
- possible reasons for rejection: user cancel authentication, no certificates available, some other technical error
- used certificate is available in the `x5c` header field of the token. JWT token description: https://github.com/martinpaljak/x509-webauth/wiki/OpenID-X509-ID-Token
- possible changes: resolving to `undefined` when no certificates available

### `webeid.getSigningCertificate()`
- resolves to an `ArrayBuffer` with the certificate that shall be used with the following `webeid.sign()` operation
- possible reasons for rejection: user cancels certificate selection, no certificates available, some other technical error
- possible changes: resolving to `undefined` when no certificates available

### `webeid.sign(certificate, hash, options)`
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
- slightly resembles [transmitRaw](https://globalplatform.github.io/WebApis-for-SE/doc/#dom-channel-transmitraw), without the channel related aspects.
- comparable to [transceive()](https://developer.android.com/reference/android/nfc/tech/IsoDep.html#transceive(byte[])) in Android IsoDep API

### `webeid.control(code, bytes)`
- resolves to `ArrayBuffer` of the response
- equivalent of [`SCardControl`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379474(v=vs.85).aspx) in PC/SC API

### `webeid.disconnect()`
- equivalent of [`SCardDisconnect`](https://msdn.microsoft.com/en-us/library/windows/desktop/aa379475(v=vs.85).aspx) in PC/SC API

## Error codes
- TBD
