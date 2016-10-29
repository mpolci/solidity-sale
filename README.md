# Smart contract for token sale

## Testing
Nodejs and npm are required. Install dependency:
```
npm install ethereumjs-testrpc truffle
```

In a separated terminal run an emulated ethereum network and node:
```shell
testrpc
```

Compile and build:
```
truffle compile
truffle migrate
truffle serve
```

Run the proxy server for proxy version of the website (optional):
```
npm install
npm start
```

Open the browser at [http://localhost:80](http://localhost:80).

For proxy version of website open [http://localhost:80/index-proxy.html](http://localhost:80).

The proxy version of the website doesn't connect directly to the ethereum node but uses the REST API provided by the proxy.

## Building a library for external web site
Run 
```
truffle compile
truffle migrate
truffle build
```

Import the generated `./build/app.js` file in your website.

