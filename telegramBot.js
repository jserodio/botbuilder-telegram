"use strict";

var __extends = (this && this.__extends) || function (d, b) {
        for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

var botFramework    =   require('botbuilder');
var telegram        =   require('node-telegram-bot-api');
var _               =   require('underscore')


var TelegramBot = (function (_super) {
    __extends(TelegramBot, _super);

    function TelegramBot(options) {
        _super.call(this);

        this._configure(options);

        this.telegramBot = new telegram(this.options.token, {polling: true});
        this.telegramBot.on('message', this._processMessage.bind(this));
    }

    TelegramBot.prototype._configure = function (options) {
        var defaults = {
            defaultDialogId: '/',
            token: '',
            maxSessionAge: 14400000,
            extras: {}

        };
        this.options = _.extend(defaults, options);

        if (!this.options.userStore) {
            this.userStore = new botFramework.MemoryStorage();
        }
        if (!this.options.sessionStore) {
            this.sessionStore = new botFramework.MemoryStorage();
        }
    };

    TelegramBot.prototype.beginDialog = function (address, dialogId, dialogArgs) {
        if (!address.to) {
            throw new Error('Invalid address passed to SkypeBot.beginDialog().');
        }
        if (!this.hasDialog(dialogId)) {
            throw new Error('Invalid dialog passed to SkypeBot.beginDialog().');
        }
        this.dispatchMessage(null, address, dialogId, dialogArgs);
    };

    TelegramBot.prototype._processMessage = function (msg) {
        var message = this.convertFromTelegramMessage(msg);

        this.emit('message', message);
        this.dispatchMessage(msg.chat.id, message , null, this.options.defaultDialogId, this.options.defaultDialogArgs);
    };

    TelegramBot.prototype.dispatchMessage = function (userId, message, callback, dialogId, dialogArgs, newSessionState) {
        var _this = this;
        if (newSessionState === void 0) { newSessionState = false; }

        var ses = new botFramework.Session({
            localizer: this.options.localizer,
            minSendDelay: this.options.minSendDelay,
            dialogs: this,
            dialogId: dialogId,
            dialogArgs: dialogArgs
        });

        ses.on('send', function (reply) {
            _this.saveData(userId, ses.userData, ses.sessionState, function () {
                if (reply && reply.text) {
                    if (callback) {
                        callback(null, reply);
                        callback = null;
                    }
                    else if (message.id || message.conversationId) {
                        var opts = {};
                        if (_.isObject(reply.attachments)) {
                            _.each(reply.attachments, function (attachment) {
                                if (_.has(attachment, 'actions')){
                                    opts['reply_markup'] = {
                                        keyboard: _.map(attachment.actions,
                                            function (value) {
                                                return [{
                                                    text: value.message
                                                }]
                                            }),
                                        one_time_keyboard: true
                                    }
                                }
                            });

                        }
                        _this.telegramBot.sendMessage(userId, reply.text, opts);
                        _this.emit('reply', reply);
                    }
                    else {
                        _this.emit('send', reply);
                    }
                }
            });
        });

        ses.on('error', function (err) {
            if (callback) {
                callback(err, null);
                callback = null;
            }
            else {
                _this.emit('error', err, message);
            }
        });

        ses.on('quit', function () {
            _this.emit('quit', message);
        });

        this.getData(userId, function (err, userData, sessionState) {
            if (!err) {
                ses.userData = userData || {};
                ses.dispatch(newSessionState ? null : sessionState, message);
            }
            else {
                _this.emit('error', err, message);
            }
        });
    };

    TelegramBot.prototype.getData = function (userId, callback) {
        var _this = this;

        var ops = 2;
        var userData, sessionState;

        this.userStore.get(userId, function (err, data) {
            if (!err) {
                userData = data;
                if (--ops == 0) {
                    callback(null, userData, sessionState);
                }
            }
            else {
                callback(err, null, null);
            }
        });

        this.sessionStore.get(userId, function (err, data) {
            if (!err) {
                if (data && (new Date().getTime() - data.lastAccess) < _this.options.maxSessionAge) {
                    sessionState = data;
                }
                if (--ops == 0) {
                    callback(null, userData, sessionState);
                }
            }
            else {
                callback(err, null, null);
            }
        });
    };

    TelegramBot.prototype.saveData = function (userId, userData, sessionState, callback) {
        var ops = 2;
        function onComplete(err) {
            if (!err) {
                if (--ops == 0) {
                    callback(null);
                }
            }
            else {
                callback(err);
            }
        }
        this.userStore.save(userId, userData, onComplete);
        this.sessionStore.save(userId, sessionState, onComplete);
    };

    /**
     *
     * @param msg
     * @protected
     * @returns {*}
     */
    TelegramBot.prototype.convertFromTelegramMessage = function (msg) {
        var created = new Date();
        created.setTime(msg.date);

        var res = {
            id: msg.message_id,
            from: {
                channelId: 'telegram',
                address: msg.from
            },
            created: created,
            conversationId: msg.chat.id,
            text: msg.text,

            channelConversationId:  msg.chat,
            channelMessageId: msg.message_id,
            channelData: msg,
            location: msg.location
        };

        if (_.has(msg, 'venue')){
            res.location = msg.venue.location;
            res.place = msg.venue.title + ", " + msg.venue.address;
        }

        return res;
    };

    TelegramBot.prototype.convertToTelegramMessage = function (msg) {
        return msg;
    };

    return TelegramBot;
})(botFramework.DialogCollection);

exports.TelegramBot = TelegramBot;