# web-eid.js &middot; [![npm version](https://badge.fury.io/js/web-eid.svg)](https://badge.fury.io/js/web-eid)

`web-eid.js` is a ultrathin wrapper on top of the HTML5 postMessage
interface provided by [`hwcrypto-native`](https://github.com/hwcrypto/hwcrypto-native), either via [`hwcrypto-extension`](https://github.com/hwcrypto/hwcrypto-extension) as available via https://web-eid.com or some other message transport in the future.

It makes using the features provided by Web eID installation super-easy:

- provides an asynchronous, Promise-based DWIM interface
- listens to incoming messages and turns them into resolved Promises

## API stability
At this point of time no API stability is assured
