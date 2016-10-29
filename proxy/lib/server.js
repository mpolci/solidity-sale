'use strict';

var _ = require('lodash');
var bitcore = require('bitcore-lib');
var WalletUtils = require('bitcore-wallet-client').Utils;
var cosignKey = require('cosignkey');
var defaultLog = require('./logger');
var LightClient = require('./restrictedClient');
var Model = require('./model');
var notificationServer = require('../lib/notificationServer');
var utils = require('./utils');
var verifyAuthSign = require('./auth-parser').verifySignature;
var ClientErrors = require('./errors/errordefinitions');
var clientsCache = require('./clientsCache').singleton();
var config = require('../config');

var bwsUrl = _.get(config, 'bwsOps.bwsServer.url', 'http://localhost:3232/bws/api');
var server_name = 'Server';
var storage;
var walletManager;

var Server = module.exports = function(logger) {
    if (!(this instanceof Server)) return new Server(logger);
    this.log = logger || defaultLog;
};

Server.init = function(oStorage, oWalletManager) {
    storage = oStorage;
    walletManager = oWalletManager;
    if (!clientsCache.storage) clientsCache.storage = oStorage;
};

Server.DEFAULT_SPENDING_LIMIT = 10000;

Server.prototype.prepareWallet = function(walletId, network, cb) {
    this.log.warn('Deprecated API');
    var lightClient = new LightClient({ baseUrl: bwsUrl});
    lightClient.seedFromRandom({network});
    storage.storeWalletCandidate(Model.WalletCandidate.createV1({walletId: walletId, credentials: lightClient.credentials}), function (err, wr) {
        if (err) return cb(err);
        var copayerHash = lightClient.getCopayerHash(server_name, network);
        cb(null, {
            copayerHash: copayerHash
        });
    });
};

Server.prototype.joinWallet = function (walletId, walletPubKey, copayerHashSignature, sharedEncryptingKey, cb) {
    this.log.warn('Deprecated API');
    var self = this;
    storage.fetchWalletCandidate(walletId, function (err, candidate) {
        if (err) return cb(err);
        if (!candidate || !candidate.credentials) return cb('no candidate wallet');

        var client = new LightClient({ baseUrl: bwsUrl});
        try {
            client.import(JSON.stringify(candidate.credentials));
        } catch (err) {
            self.log.error({credentials: candidate.credentials}, 'Cannot import credentials');
            return cb(err);
        }
        // store data for recovery in case of error
        var step2 = {
            walletPubKey: walletPubKey,
            copayerHashSignature: copayerHashSignature,
            sharedEncryptingKey: sharedEncryptingKey
        };
        storage.updateWalletCandidate(walletId, {"step2": step2}, function (err, writeResult) {
            if (err) return cb(err);
            self._joinAndStoreWallet(client, walletId, walletPubKey, sharedEncryptingKey, copayerHashSignature, function (err, wallet) {
                //TODO se c'è un errore a questo punto il wallet potrebbe essere joinato ma non salvato, le informazioni per il recupero sono nel walletCandidate
                if (err) return cb(err);
                self._openWallet(client, function (err) {
                    if (err) return cb(err);
                    candidate.archiveTime = Date.now();
                    storage.archiveWalletCandidate(candidate, function (err, wr) {
                        if (err) self.log.error(err);
                    });
                    cb(null, wallet);
                });
            });
        });
    });
};

Server.prototype._joinAndStoreWallet = function (client, walletId, walletPubKey, sharedEncryptingKey, copayerHashSignature, cb) {
    var self = this;
    client.lightJoinWallet(server_name, walletId, walletPubKey, sharedEncryptingKey, copayerHashSignature, function (err, wallet) {
        if (err || !wallet) return cb(err);
        self.log.info({walletId: walletId, walletName: wallet.name}, 'Wallet Joined');
        var to_save = Model.ManagedWallet.create({
            walletId: walletId,
            credentials: client.credentials,
            spendingLimit: Server.DEFAULT_SPENDING_LIMIT
        });
        storage.storeWallet(to_save, function (err) {
            cb(err, wallet);
        });
    });
};

/**
 * Open the client wallet, extract and store copayers info
 * @param client
 * @param cb
 * @private
 */
Server.prototype._openWallet = function (client, cb) {
    var self = this;
    var walletId = client.credentials.walletId
    client.openWallet(function (err, ret) {
        try {
            if (err) throw err;
            if (!client.isComplete) throw 'wallet is not complete';
            if (!ret) throw 'no wallet status on open'
            if (ret.wallet && ret.wallet.copayers)
                self._storeCopayers(walletId, ret.wallet.copayers);
            else if (client.credentials.publicKeyRing)
                self._storeCopayers(walletId, client.credentials.publicKeyRing);
            else
                throw 'no copayers info';
            self.log.info('wallet opened');
            cb(null, ret);
        } catch (e) {
            self.log.error(e);
            cb(_.isString(e) ? new Error(e) : e);
        }
    });
};

Server.prototype._storeCopayers = function (walletId, data) {
    var self = this;
    var conflicts = [];
    data.forEach(function (item) {
        var copayerId = item.id || WalletUtils.xPubToCopayerId(item.xPubKey);
        storage.fetchCopayerLookup(copayerId, function (err, lookup) {
            if (err) return self.log.fatal(err, 'StoreCopayer not completed');
            if (lookup) return self.log.fatal(new Error('Existing copayerId ' + copayerId), 'StoreCopayer not completed');
            storage.storeCopayerLookup({
                walletId: walletId,
                copayerId: copayerId,
                requestPubKey: item.requestPubKey
            }, function (err) {
                if (err) self.log.fatal(err, 'StoreCopayer not completed');
            });
        });
    });
};

function _checkJoinSignature(opts, walletPubKey) {
    var checkData = _.clone(opts);
    delete checkData.joinSignature;
    delete checkData.reqSignData;
    var checkOk = WalletUtils.verifyMessage(JSON.stringify(checkData), opts.joinSignature, walletPubKey);
    return checkOk;
}

Server.prototype.joinV2Start = function (opts, cb) {
    if (!utils.checkRequired(opts, ['walletId', 'copayerId1', 'entropy1', 'network', 'walletPubKey', 'sharedEncKey', 'joinSignature', 'reqSignData']))
        return cb(ClientErrors.MISSING_PARAMETER);
    //TODO should validate all input data
    if (!_checkJoinSignature(opts, opts.walletPubKey)) return cb(ClientErrors.JOIN_BAD_SIGNATURE);
    var wc = Model.WalletCandidate.create(opts);
    wc.reqSignDataArray = [{
        copayerId: opts.copayerId1,
        msg: opts.reqSignData.msg,
        signature: opts.reqSignData.signature,
    }];
    storage.storeWalletCandidate(wc, function (err, wr) {
        //if (err) return cb(err);
        cb(err);
    });
};

Server.prototype.joinV2Update = function (opts, cb) {
    function sort(buffs) {
        if (buffs[0].length > buffs[1].length) return buffs;
        if (buffs[0].length < buffs[1].length) return [buffs[1], buffs[0]];
        for (let i = buffs[0].length - 1; i >= 0; i--) {
            if (buffs[0][i] > buffs[1][i]) return buffs;
            if (buffs[0][i] < buffs[1][i]) return [buffs[1], buffs[0]];
        }
        return buffs;
    }
    if (!utils.checkRequired(opts, ['walletId', 'copayerId2', 'entropy2', 'joinSignature', 'reqSignData']))
        return cb(ClientErrors.MISSING_PARAMETER);
    var self = this;
    storage.fetchWalletCandidate(opts.walletId, function (err, candidate) {
        if (err) return cb(err);
        if (!candidate || !candidate.walletPubKey) return cb(new Error('No wallet candidate'));
        if (candidate.credentials) return cb(ClientErrors.JOIN_STEP2_ALREADY_DONE);

        if (!_checkJoinSignature(opts, candidate.walletPubKey)) return cb(ClientErrors.JOIN_BAD_SIGNATURE);
        var seed;
        try {
            seed = cosignKey.get3rdKeySeed(candidate.entropy1, opts.entropy2);
        } catch (e) {
            return e.message === 'Source entropies should be 256 bits long'
                ? cb(ClientErrors.JOIN_NOT_512BIT_ENTROPY)
                : cb(ClientErrors.JOIN_INVALID_ENTROPY)
        }
        var xpriv = bitcore.HDPrivateKey.fromSeed(seed, candidate.network).toString();
        var lightClient = new LightClient({ baseUrl: bwsUrl});
        lightClient.seedFromExtendedPrivateKey(xpriv);

        var update = {
            copayerId2: opts.copayerId2,
            entropy2: opts.entropy2,
            credentials: lightClient.credentials,
            reqSignDataArray: candidate.reqSignDataArray || []
        };
        update.reqSignDataArray.push({
            copayerId: opts.copayerId2,
            msg: opts.reqSignData.msg,
            signature: opts.reqSignData.signature,
        });
        storage.updateWalletCandidate(opts.walletId, update, function (err, writeResult) {
            if (err) return cb(err);
            var copayerHash = lightClient.getCopayerHash(server_name);
            cb(null, {
                copayerHash: copayerHash
            });
        });
    });
};

function verifyCopayersSignatures(signDataArray, walletCopayers, serverCopayerId) {
    return signDataArray && signDataArray.length === 2 &&
        signDataArray[0].copayerId !== signDataArray[1].copayerId &&
        _.all(signDataArray, function (signData) {
            var copayer = _.find(walletCopayers, {id: signData.copayerId});
            return copayer && verifyAuthSign(signData.msg, signData.signature, copayer) &&
                copayer.id !== serverCopayerId;
        });
}

Server.prototype.joinV2Complete = function (opts, cb) {
    if (!utils.checkRequired(opts, ['walletId', 'copayerHashSignature', 'joinSignature']))
        return cb(ClientErrors.MISSING_PARAMETER);
    var self = this;
    var walletId = opts.walletId;
    storage.fetchWalletCandidate(walletId, function (err, candidate) {
        if (err) return cb(err);
        if (!candidate) return cb(new Error('No wallet candidate'));
        if (!candidate.credentials) return cb(ClientErrors.JOIN_STEP2_NOT_DONE);

        if (!_checkJoinSignature(opts, candidate.walletPubKey)) return cb(ClientErrors.JOIN_BAD_SIGNATURE);

        var client = new LightClient({ baseUrl: bwsUrl});
        try {
            client.import(JSON.stringify(candidate.credentials));
        } catch (err) {
            self.log.error({credentials: candidate.credentials}, 'Cannot import credentials');
            return cb(new Error('Cannot import credentials'));
        }

        self._joinAndStoreWallet(client, walletId, candidate.walletPubKey, candidate.sharedEncKey, opts.copayerHashSignature, function (err, wallet) {
            if (err && wallet)
                self.log.error(walletId, 'Wallet joined but not saved. Recovery data are available on the walletCandidate.');
            if (err) return cb(err);
            if (!wallet || wallet.n !== 3 || wallet.m != 2) return cb(ClientErrors.JOIN_INVALID_WALLET);
            self._openWallet(client, function (err) {
                if (err) return cb(err);
                // No need to check the copayer signature for the last step, only the first two contain entropy
                var signOk = verifyCopayersSignatures(candidate.reqSignDataArray, wallet.copayers, client.credentials.copayerId);
                if (!signOk) return cb(ClientErrors.BAD_SIGNATURES);
                storage.updateWallet(walletId, { joinCompleted: true}, function(err, wr) {
                    if (err) return cb(err);
                    candidate.archiveTime = Date.now();
                    storage.archiveWalletCandidate(candidate, function (err, wr) {
                        if (err) self.log.error(err);
                    });
                    cb(null, wallet);
                })
            });
        });
    });
};

//TODO deprecate getWalletDetails
Server.prototype.getWalletDetails = function (walletId, cb) {
    this._fetchWalletOrError(walletId, cb, function (wallet) {
        // TODO limit wallet fields to strictly necessary
        cb(null, wallet);
    });
};

Server.prototype.getSpendingLimit = function (walletId, copayerId, cb) {
    var self = this;
    //if (!walletId || !copayerId) return cb(new Error('missing parameter'));

    self._fetchWalletOrError(walletId, cb, function (wallet) {
        storage.fetchLimitChangeRequest(walletId, function (err, lcr) {
            if (err) return cb(err);
            var result = {
                spendingLimit: wallet.spendingLimit,
                consumed: wallet.lastSpentDay === today() ? wallet.todaySpent : 0,
                timeOffset: wallet.timeOffset
            };
            if (lcr) {
                if (!Model.LimitChangeRequest.isValidChange(lcr.pendingChange) || !lcr.approvedBy)
                    return cb(new Error('Invalid limit change request'));
                result.pending = lcr.pendingChange;
                result.pendingApproved = lcr.approvedBy.indexOf(copayerId) > -1;
            }
            cb(null, result);
        });
    });
};

Server.prototype.requestSpendingLimitChange = function (walletId, copayerId, change, cb) {
    var self = this;
    if (!walletId || !copayerId || !Model.LimitChangeRequest.isValidChange(change))
        return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchLimitChangeRequest(walletId, function (err, cReq) {
        if (err) return cb(err);
        if (cReq) {
            return cb(null, {result: 'rejected'});
        }
        // no pending request
        self._fetchWalletOrError(walletId, cb, function (wallet) {
            if (!utils.checkRequired(wallet, ['spendingLimit','credentials']))
                return cb(new Error('invalid manageWallet'));
            let confirmsNeeded = requiredConfirms(wallet.credentials),
                changeTime = change.timeOffset !== wallet.timeOffset;
            //if (change.spendingLimit < wallet.spendingLimit && !changeTime && confirmsNeeded > 1)
            if (change.spendingLimit === wallet.spendingLimit && !changeTime) {
                cb(null, {result: "OK"});
            } else if (!changeTime && (change.spendingLimit < wallet.spendingLimit || confirmsNeeded === 1)) {
                // update limit
                self._updateLimit(walletId, change, cb);
            } else {
                // confirmation required
                var newChangeReq = Model.LimitChangeRequest.create({
                    walletId: walletId,
                    applicant: copayerId,
                    pendingChange: change
                });
                storage.storeLimitChangeRequest(newChangeReq, function (err, writeResult) {
                    if (err) return cb(err);
                    notifySpendingLimit(walletId);
                    cb(null, {result: "confirmation required"});
                });
            }
        });
    });
};

Server.prototype.confirmSpendingLimitChange = function (walletId, copayerId, change, action, cb) {
    var self = this;
    if (!walletId || !copayerId || !Model.LimitChangeRequest.isValidChange(change) || !action)
        return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchLimitChangeRequest(walletId, function (err, cReq) {
        if (err) return cb(err);
        if (!cReq || !(change.spendingLimit === cReq.pendingChange.spendingLimit && change.timeOffset === cReq.pendingChange.timeOffset))
            return cb(null, {result: 'invalid'});
        // pending request matches
        self._fetchWalletOrError(walletId, cb, function (wallet) {
            if (!utils.checkRequired(wallet, ['spendingLimit','credentials']))
                return cb(new Error('invalid managedWallet'));
            if ('confirm' === action) {
                if (cReq.approvedBy.indexOf(copayerId) > -1) {
                    // copayer already confirmed
                    cb(null, {result: "confirmation required"});
                } else {
                    cReq.approvedBy.push(copayerId);
                    //TODO there is no check that inibit server from partecipating to the approvement
                    if (cReq.approvedBy.length >= requiredConfirms(wallet.credentials)) {
                        cReq.complete = true;
                        storage.archiveLimitChangeRequest(cReq, function (err, wr) {
                            if (err) return cb(err);
                            self._updateLimit(walletId, change, cb);
                        });
                    } else {
                        storage.storeLimitChangeRequest(cReq, function (err, wr) {
                            if (err) return cb(err);
                            cb(null, {result: 'confirmation required'});
                        });
                    }
                }
            } else if ('reject' === action) {
                storage.archiveLimitChangeRequest(cReq, function (err, wr) {
                    if (err) return cb(err);
                    notifySpendingLimit(walletId);
                    cb(null, {result: "OK"});
                });
            } else {
                self.log.warn({action, change}, 'Invalid request on confirmSpendingLimitChange');
                return cb(null, {result: 'invalid'});
            }
        });
    });
};

Server.prototype._updateLimit = function (id, change, cb) {
    storage.updateWallet(id, {
        spendingLimit: change.spendingLimit,
        timeOffset: change.timeOffset
    }, function (err, writeResult) {
        if (err) return cb(err);
        notifySpendingLimit(id);
        cb(null, {result: "OK"});
    });
};

Server.prototype.newBackupRequest = function (opts, cb) {
    this.log.warn('Deprecated API');
    var self = this;
    if (!utils.checkRequired(opts, ['walletId', 'reqId', 'reqTimestamp', 'reqCopayer', 'reqSignature']))
        return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchBackupRequest(opts.walletId, function (err, br) {
        if (err) return cb(err);
        if (br) return cb(null, {result: 'backup in progress'});
        // TODO check request timestamp
        self._fetchWalletOrError(opts.walletId, cb, function (wallet) {
            // TODO dovrei controllare che il wallet sia di tipo 2 su 3
            var newBackupReq = Model.BackupRequest.create(opts);
            storage.storeBackupRequest(newBackupReq, function (err, writeResult) {
                if (err) return cb(err);
                notifyBackupStart(opts.walletId);
                cb(null, {result: 'OK'});
            });
        });
    });
};

Server.prototype.getBackupRequest = function (walletId, cb) {
    this.log.warn('Deprecated API');
    if (!walletId) return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchBackupRequest(walletId, function (err, br) {
        if (err) return cb(err);
        //if (!br) return cb(null, {});
        cb(null, br);
    });
};

Server.prototype.addBackupRequestData = function (opts, cb) {
    this.log.warn('Deprecated API');
    var self = this;
    if (!utils.checkRequired(opts, ['walletId', 'reqId', 'copayerId', 'partialData']))
        return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchBackupRequest(opts.walletId, function (err, backupRequest) {
        if (err) return cb(err);
        if (!backupRequest) return cb(null, {result: 'no backup'});
        // TODO check request timestamp
        self._fetchWalletOrError(opts.walletId, cb, function (wallet) {
            if (backupRequest.reqCopayer === opts.copayerId) return cb(null, {result: 'data from wrong copayer'});
            if (backupRequest.reqId !== opts.reqId) return cb(null, {result: 'request id mismatch'});
            if (backupRequest.partialData) return cb(null, {result: 'request already completed'});
            storage.updateBackupRequest(opts.walletId, {partialData: opts.partialData}, function (err, writeResult) {
                if (err) return cb(err);
                notifyBackupUpdate(opts.walletId);
                cb(null, {result: 'OK'});
            });
        });
    });
};

Server.prototype.deleteBackupRequest = function (walletId, cb) {
    this.log.warn('Deprecated API');
    var self = this;
    if (!walletId) return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchBackupRequest(walletId, function (err, backupRequest) {
        if (err) return cb(err);
        if (!backupRequest) return cb(null, {result: 'no backup'});
        storage.deleteBackupRequest(walletId, function (err, writeResult) {
            if (err) return cb(err);
            notifyBackupUpdate(walletId);
            cb(null, {result: 'OK'});
        });
    });
};

Server.prototype.processTxps = function (walletId, cb) {
    //var self = this;
    if (!walletId) return cb(ClientErrors.MISSING_PARAMETER);
    clientsCache.getClient(walletId, (err, client) => {
        if (err) return cb(err);
        walletManager.processTxps(client, null, storage, (err, actionsTaken) => {
            let verdicts = {};
            _.forIn(actionsTaken, (action, id) => {
                if (_.isString(action)) {
                    verdicts[id] = action;
                } else {
                    this.log.error({txpId: id, err: action.err || action}, 'Error processing transaction proposal');
                    verdicts[id] = 'Error';
                }
            });
            if (err) {
                if (!actionsTaken) return cb(err);
                return cb(null, {result: 'Partial error', verdicts});
            }
            cb(null, {result: 'OK', verdicts});
        });
    });
};

Server.prototype._fetchWalletOrError = function (id, error, cb) {
    storage.fetchWallet(id, function (err, wallet) {
        if (err)
            error(err);
        else if (!wallet)
            error(Error('Wallet not found'));
        else
            cb(wallet);
    });
};

Server.prototype.storeNotice = function (opts, cb) {
    if (!utils.checkRequired(opts, ['type', 'data', 'copayerId', 'walletId']))
        return cb(ClientErrors.MISSING_PARAMETER);
    this._fetchWalletOrError(opts.walletId, cb, () => {
        var notice = Model.Notice.create(opts);
        storage.storeNotice(notice, err => {
            if (err) return cb(err);
            this.log.info({notice}, 'Stored new notice');
            notificationServer.notify({walletId: opts.walletId}, 'notice');
            cb(null, {
                result: 'OK',
                details: {
                    noticeHash: notice.id,
                    timestamp: notice.timestamp
                }
            });
        });
    });
};

Server.prototype.getNotices = function (walletId, cb) {
    if (!walletId)
        return cb(ClientErrors.MISSING_PARAMETER);
    storage.fetchNotices(walletId, (err, notices) => {
        if (err) return cb(err);
        if (!notices) notices = [];
        cb(null, {
            result: 'OK',
            notices
        });
    });
};

Server.prototype.deleteNotice = function (walletId, id, cb) {
    if (!walletId || !id)
        return cb(ClientErrors.MISSING_PARAMETER);
    this.log.info({noticeId: id}, 'Delete notice');
    storage.deleteNotice(walletId, id, (err, writeResult) => {
        if (err) return cb(err);
        if (writeResult.nRemoved < 1)
            return cb(null, {result: 'Not found'});
        notificationServer.notify({walletId}, 'notice');
        cb(null, {result: 'OK'});
    });
};

function today() {
    return Math.floor(Date.now()/(24*3600000));
}

function notifySpendingLimit(id) {
    notificationServer.notify({
        walletId: id,
        type: 'spendingLimitUpdated'
    });
}

function notifyBackupStart(walletId) {
    defaultLog.warn('Deprecated API');
    notificationServer.notify({
        walletId: walletId,
        type: 'backupStart'
    });
}

function notifyBackupUpdate(walletId) {
    defaultLog.warn('Deprecated API');
    notificationServer.notify({
        walletId: walletId,
        type: 'backupStatusUpdated'
    });
}

function requiredConfirms(credentials) {
    var n = credentials.n;
    var m = credentials.m;
    return n === m ? n - 1 : m;
}
