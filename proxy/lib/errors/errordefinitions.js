'use strict';

var _ = require('lodash');

var ClientError = require('./clienterror');

var errors = {
  BAD_REQUES: 'Bad request',
};

var errorObjects = _.zipObject(_.map(errors, function(msg, code) {
  return [code, new ClientError(code, msg)];
}));

errorObjects.codes = _.mapValues(errors, function(v, k) {
  return k;
});

function createError(code, name, data) {
  var e = new ClientError(code, name);
  e.data = data;
  return e;
}

errorObjects.create = {
  INVALID_PARAMETER: (name) => createError('INVALID_PARAMETER', 'Invalid parameter', {name: name})
};

module.exports = errorObjects;
