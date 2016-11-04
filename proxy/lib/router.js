'use strict';

var _ = require('lodash');
var express = require('express');
// var log = require('./logger');
// var utils = require('../lib/utils');
var ClientErrors = require('./errors/errordefinitions');
var contracts = require('./contracts');

let web3 = contracts.web3;
let Sale = contracts.Sale;
let sale = Sale.deployed();

function callContract (contract, fn, args, res, next) {
    contract[fn](...args)
      .then(value => res.json(value))
      .catch(err => next(err))
}

/**
 * REST API:
 *
 * GET   /sale/promoters                 get promoters list (array of addresses)
 * GET   /sale/tokens/sold               get the number of tokens sold
 * GET   /sale/ended                     get the state of sale (boolean)
 * GET   /sale/tokens/max                get the max number of tokens for sale
 * GET   /sale/tokens/price              get the price for each token
 * GET   /sale/buyers/count              get the number of buyers
 * GET   /sale/buyers/:address/balance   get the balance for an address
 * GET   /address/sale                   get sale smart contract address
 *
 */

var router = express.Router();

router.handlers = [

    // HACK: if client try to cache request, ignore the if-none-match header
    ['get', '/*', function (req, res, next) {
        delete req.headers['if-none-match'];
        next();
    }],

    /*
     * Set headers for all requests
     */
    ['all', '/*', function (req, res, next) {
        // no cache
        res.header("Cache-Control", "no-cache, no-store, must-revalidate");
        res.header("Pragma", "no-cache");
        res.header("Expires", 0);
        next();
    }],

    ['get', '/sale/promoters', function (req, res, next) {
        callContract(sale, 'getPromoters', [], res, next)
    }],

    ['get', '/sale/tokens/sold', function (req, res, next) {
        callContract(sale, 'soldTokens', [], res, next)
    }],

    ['get', '/sale/ended', function (req, res, next) {
        callContract(sale, 'saleEnded', [], res, next)
    }],

    ['get', '/sale/tokens/max', function (req, res, next) {
        callContract(sale, 'maxTokens', [], res, next)
    }],

    ['get', '/sale/tokens/price', function (req, res, next) {
        callContract(sale, 'tokenPrice', [], res, next)
    }],

    ['get', '/sale/buyers/count', function (req, res, next) {
        callContract(sale, 'getBuyersCount', [], res, next)
    }],

    ['get', '/sale/buyers/:address/balance', function (req, res, next) {
        if (!web3.isAddress(req.params.address)) return next(ClientErrors.INVALID_PARAMETER);
        callContract(sale, 'balanceOf', [req.params.address], res, next)
    }],

    ['get', '/address/sale', function (req, res, next) {
        res.json(Sale.address)
    }],

    ['all', '*', function (req, res, next) {
        // unhandled
        res.status(400);
        res.end();
    }],
];

router.handlers.forEach(function (item) {
    var op = item[0];
    var args = _.drop(item);
    router[op].apply(router, args);
});

module.exports = router;
