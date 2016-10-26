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
    "monitor.html": "monitor.html",
    "monitor.js": [
      "javascripts/monitor.js",
      "javascripts/transaction.controller.js"
    ]
  },
  rpc: {
    host: "localhost",
    port: 8545
  }
};
