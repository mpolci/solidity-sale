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

Open the browser at http://localhost:80

## Building a library for external web site
Run 
```
truffle compile
truffle migrate
truffle build
```

Import the generated `./build/app.js` file in your website.

