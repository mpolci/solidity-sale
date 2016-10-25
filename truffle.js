module.exports = {
  build: {
    "index.html": "index.html",
    "app.js": [],
    "extra.js": [
      "javascripts/application.js",
      "javascripts/transaction.controller.js"
    ],
    "app.css": [
      "stylesheets/app.css"
    ],
    // "images/": "images/"
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
