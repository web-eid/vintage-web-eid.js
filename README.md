# web-eid.js [![npm version](https://badge.fury.io/js/web-eid.svg)](https://badge.fury.io/js/web-eid)

`web-eid.js` is a ultrathin wrapper on top of the HTML5 postMessage
interface provided by `hwcrypto-extension`.

It makes using the features provided by Web eID installation super-easy:

- provides an asynchronous, Promise-based DWIM interface
- listens to incoming messages and turns them into resolved Promises
