# web-eid.js &middot; [![npm version](https://badge.fury.io/js/web-eid.svg)](https://badge.fury.io/js/web-eid)

 [`web-eid.js`](./web-eid.js) is a ultrathin wrapper on top of the messaging interface provided by [`hwcrypto-native`](https://github.com/hwcrypto/hwcrypto-native), either via [`hwcrypto-extension`](https://github.com/hwcrypto/hwcrypto-extension) [HTML5 postMessage](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage) interface or some other message transport in the future.

It makes using the features provided by Web eID installation as available via [web-eid.com](https://web-eid.com) super-easy:

- provides an asynchronous, Promise-based DWIM interface
- listens to incoming messages and turns them into resolved Promises

## API stability
At this point of time no API stability is assured
