'use strict';

var _ = require('lodash');
var domain = require('domain');
var express = require('express');
var path = require('path');
var mainlog = require('./logger');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var cors = require('cors');

var api = require('./router');
var ClientError = require('./errors/clienterror');

var ExpressApp = {};


/**
 * Create and starts the express application
 *
 * @param {Boolean} [opts.disablelog] true if should disable logs
 * @param {function(err, app)} cb callback - it returns the express app
 */
ExpressApp.create = function (opts, cb) {
    opts = opts || {};

    var app = express();

    // catch unhandled exceptions
    app.use(function (req, res, next) {
        var reqDomain = domain.create();
        reqDomain.add(req);
        reqDomain.add(res);

        res.on('close', function () {
            reqDomain.dispose();
        });
        reqDomain.on('error', function (err) {
            req.log.fatal(err, 'unhandled exception');
            next(err);
        });
        reqDomain.run(next)
    });

    app.use('/api',
        cors(),
        bodyParser.json(),
        bodyParser.urlencoded({extended: false}),
        cookieParser(),
        mainlog.getRequestLogger(),
        api
    );

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // error handlers

    // development error handler
    // will print stacktrace
    //if (app.get('env') === 'development') {
    //    app.use(function (err, req, res, next) {
    //        res.status(err.status || 500);
    //        res.render('error', {
    //            message: err.message,
    //            error: err
    //        });
    //    });
    //}

    // production error handler
    // no stacktraces leaked to user
    app.use(function (err, req, res, next) {
        var log = req.log || mainlog;
        var logmsg = 'Request did not complete successfully';
        if (err instanceof ClientError) {
            log.error({clientError: err}, logmsg);
            var status = (err.code == 'NOT_AUTHORIZED') ? 401 : 400;
            res.status(status).json({
                code: err.code,
                message: err.message,
            });
        } else {
            log.error(err, logmsg);
            log.warn({req, res});
            var code;
            if (_.isObject(err))
                code = err.code || err.statusCode;
            res.status(code || 500).json({
                error: 'Internal server error',
            });
        }
        res.end();
    });

    cb(null, app);
};

module.exports = ExpressApp;
