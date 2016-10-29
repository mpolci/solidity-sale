'use strict';

var _ = require('lodash');
var util = require('util');
var bunyan = require('bunyan');
var randomBytes = require('crypto').randomBytes;
var config = require('../config');

var streams = undefined;
var src = undefined;
if (process.env.NODE_ENV === 'development') {
    var PrettyStream = require('bunyan-prettystream');
    var prettyStdOut = new PrettyStream();
    prettyStdOut.pipe(process.stdout);
    streams = [{
        level: 'debug',
        stream: prettyStdOut
    }];
    src = true;
} else {
    streams = _.get(config, 'logOpts.bunyanStreams');
}

var logger = module.exports = bunyan.createLogger({
    name: 'proxy',
    streams: streams,
    serializers: {
        req: bunyan.stdSerializers.req,
        res: bunyan.stdSerializers.res,
        managedWallet: managedWalletSerializer,
        walletId: walletIdSerializer,
        credentials: credentialsSerializer,
        notification: notificationSerializer
    },
    src: src
});

/**
 * logger.stream can be used in morgan initialization
 * Example:
 *   app.use(require('morgan')({ "stream": logger.stream }));
 */
logger.stream = {
    write: function(message, encoding){
        logger.info(message);
    }
};

function newId() {
    return randomBytes(6).toString('hex');
}

/**
 * Create a bunyan-request middleware for express requests logging.
 * Usage:
 *    var app = express();
 *    app.use(logger.getRequestLogger());
 *
 * @returns {*} a new middleware
 */
logger.getRequestLogger = function () {
    var headerName = 'x-request-id';

    return function (req, res, next) {
        var id = req.headers[headerName] || newId();
        var now = Date.now();

        res.log = req.log = logger.child({
            requestId: id,
        });

        res.setHeader(headerName, id);

        req.log.info({
            method: req.method,
            path: req.path,
            remoteAddress: req.connection.remoteAddress,
            remotePort: req.connection.remotePort,
            'x-identity': getShort(req.header('x-identity'))
        }, 'start request');
        if (!_.isEmpty(req.body)) req.log.debug({body: req.body}, 'request body');

        var time = process.hrtime();
        res.once('finish', function responseSent() {
            var diff = process.hrtime(time);
            req.log.info({statusCode: res.statusCode, duration: diff[0] * 1e3 + diff[1] * 1e-6}, 'end request');
        });

        next();
    };
};

// Replace console calls

var levels = [
    'trace',
    'debug',
    'info',
    'warn',
    'error',
    'fatal'
];

/**
 * Replace logging methods of obj with new methods that use logger.
 * Example:
 * logger.override(console);
 * console.debug('this message is logged using logger.debug()');
 *
 * @param obj object (ex: console) with logging methods
 */
logger.override = function (obj) {
    levels.forEach(function (levelName) {
        if (obj[levelName]) {
            obj[levelName] = function () {
                //var args = Array.prototype.slice.call(arguments);
                //var msg = args.join(' ');
                var msg = util.format.apply(util, arguments);
                logger[levelName].call(logger, msg);
            }
        }
    });
    obj.log = console.info;
};

function managedWalletSerializer(managedWallet) {
    return managedWallet.walletId;
}

function walletIdSerializer(item) {
    if (typeof item === "object") {
        if (item.walletId)
            return item.walletId;
        if (item.credentials && item.credentials.walletId)
            return item.credentials.walletId
    }
    return item;
}

function credentialsSerializer(item) {
    if (typeof item === "object") {
        if (typeof item.credentials === "object")
            item = item.credentials;
        var data = _.clone(item);
        [
            'xPrivKey',
            'xPrivKeyEncrypted',
            'requestPrivKey',
            'walletPrivKey',
            'personalEncryptingKey',
            'sharedEncryptingKey',
        ].forEach(function (name) {
            if (data[name])
                data[name] = 'hidden';
        });
        return data;
    }
    return item;
}

function notificationSerializer(item) {
    if (typeof item === "object") {
        return _.pick(item,  ['id', 'type']);
    }
    return item;
}

function getShort(itemStr) {
    return itemStr != null ? itemStr.toString().substr(0, 8) + '..' : itemStr;
}