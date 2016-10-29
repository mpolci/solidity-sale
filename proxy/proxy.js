#!/usr/bin/env node

/**
 * Module dependencies.
 */

var App = require('./lib/expressApp');
var http = require('http');
var _ = require('lodash');
var config = require('./config');
var log = require('./lib/logger');
log.override(console);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error) {
  if (error.syscall !== 'listen') {
    throw error;
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port;

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      log.error(bind + ' requires elevated privileges');
      process.exit(1);
      break;
    case 'EADDRINUSE':
      log.error(bind + ' is already in use');
      process.exit(1);
      break;
    default:
      throw error;
  }
}

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || config.port || '3001');

var opts = {
  disableLogs: config.disableLogs,
  dbUri: _.get(config, 'storageOpts.mongoDb.uri', 'mongodb://localhost:27017/cosign'),
};

console.log('Starting...');

App.create(opts, function (e, app) {
  if (e)
    return log.fatal(e);

  app.set('port', port);

  /**
   * Create HTTP server.
   */

  var server = http.createServer(app);

  /**
   * Event listener for HTTP server "listening" event.
   */

  function onListening() {
    var addr = server.address();
    var bind = typeof addr === 'string'
      ? 'pipe ' + addr
      : 'port ' + addr.port;
    log.info('Listening on ' + bind);
  }

  /**
   * Listen on provided port, on all network interfaces.
   */


  server.listen(port);
  server.on('error', onError);
  server.on('listening', onListening);
});
