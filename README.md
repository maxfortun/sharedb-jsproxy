# sharedb-jsproxy

[Javascript Proxy](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) to [ShareDB](https://github.com/share/sharedb) document.  

Setting a value on this proxy will update the document on the backend. 
 
Getting a value from this proxy reflects the document on the backend.  

## Usage

### Setting and getting data
```
const shareDbJSProxy = new ShareDBJSProxy(shareDbDoc);

const oldValue = await shareDbJSProxy.key; // await for get operation to complete

shareDbJSProxy.key = "value";
await shareDbJSProxy.key; // await for set operation to complete

const newValue = await shareDbJSProxy.key; // await for get operation to complete

console.log({ oldValue, newValue });
```

### Listening to changes
```
const shareDbJSProxy = new ShareDBJSProxy(shareDbDoc);
shareDbJSProxy.__proxy__.on('change', event => {
	debug("ShareDBJSProxy event", event);
});
```

