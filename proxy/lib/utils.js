'use strict';
var _ = require('lodash');

var utils = module.exports = {};

utils.isInt = function (value) {
    return !isNaN(value) && (function (x) {
            return (x | 0) === x;
        })(parseFloat(value));
};


utils.checkRequired = function(obj, args) {
    args = [].concat(args);
    if (!_.isObject(obj)) return false;
    for (var i = 0; i < args.length; i++) {
        if (!obj.hasOwnProperty(args[i])) return false;
    }
    return true;
};

utils.exist = function (){
    for (let i = 0; i < arguments.length; i++) {
        // check if null or undefined with double =
        if (v == null) return false;
    }
    return true;
}