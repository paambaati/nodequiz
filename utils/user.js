/**
 * User+authentication utilities.
 * Author: GP.
 * Version: 1.0
 * Release Date: 29-Apr-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    models = require('../models/models'),
    crypt = require('./pass'),
    mailer = require('./mail');

/**
 * Authenticates a user by looking up the database.
 *
 * @param {String} username.
 * @param {String} password.
 * @param {Function} callback.
 */

function authenticate(name, pass, fn) {
    models.User.findOne({
        username: name
    }, function(err, user) {
        if (user) {
            if (err) return fn(new Error(config.ERR_AUTH_INVALID_USERNAME));
            if (!user.activated) {
                config.logger.warn('AUTHENTICATION - ACTIVATION PENDING', {
                    username: name
                });
                return fn(new Error(config.ERR_AUTH_ACTIVATION_PENDING));
            } else {
                crypt.hash(pass, user.salt, function(err, hash) {
                    if (err) return fn(err);
                    if (hash == user.hash) return fn(null, user);
                    config.logger.warn('AUTHENTICATION - INVALID PASSWORD', {
                        username: name
                    });
                    fn(new Error(config.ERR_AUTH_INVALID_PASSWORD));
                });
            }
        } else {
            config.logger.warn('AUTHENTICATION - INVALID USERNAME', {
                username: name
            });
            return fn(new Error(config.ERR_AUTH_INVALID_USERNAME));
        }
    });
}

/**
 * Checks if user is logged in.
 * If yes, proceed to next middleware.
 * If no, redirect user to login page.
 *
 * @param {String} request.
 * @param {String} response.
 * @param {Boolean} allow to move to next middleware.
 */

function requiredAuthentication(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        req.session.error = config.ERR_AUTH_NOT_LOGGED_IN;
        res.redirect(config.URL.LOGIN);
    }
}

/**
 * Checks if the username exists.
 * Returns a boolean value.
 *
 * @param {String} username.
 * @param {Function} callback.
 */

function isUsernameValid(name, fn) {
    models.User.findOne({
        username: name
    }, function(err, user) {
        if (user) {
            if (err) {
                config.logger.warn('USERNAME DOC NOT FOUND IN DB', {
                    username: name
                });
                return fn(new Error(config.ERR_AUTH_INVALID_USERNAME));
            }
            return fn(null, true);
        } else {
            return fn(null, false);
        }
    });
}

/**
 * Checks if username exists in the database.
 * If yes, move to next middleware.
 * If no, redirect user to signup page.
 * (Called during signup process.)
 *
 * @param {String} request.
 * @param {String} response.
 * @param {Boolean} allow to move to next middleware.
 */

function userExist(req, res, next) {
    models.User.count({
        username: req.body.username
    }, function(err, count) {
        if (count === 0) {
            next();
        } else {
            req.session.error = config.ERR_SIGNUP_ALREADY_EXISTS;
            res.redirect(config.URL.SIGNUP);
        }
    });
}

/**
 * Activates user by setting `activated` = `true` in DB docs.
 *
 * @param {String} user ID (MongoDB's ObjectID).
 * @param {Function} callback.
 */

function activateUser(id, fn) {
    //Better use a new instance because mongoose behaves
    //weirdly when doing an UPDATE on an existing instance.
    var User = models.mongoose.model(config.DB_AUTH_TABLE, models.UserSchema);
    models.User.findOne({
        _id: id
    }, function(err, user) {
        if (user) {
            User.update({
                _id: id,
                activated: false
            }, {
                activated: true
            }, {
                multi: false
            }, function(err, count) {
                if (err) {
                    throw err;
                }
                return fn(null, count);
            });
        } else {
            return fn(new Error(config.ERR_ACTIVATION_INVALID_KEY));
        }
    });
}

/**
 * Validates reset key and it's expiry time and returns
 * an appropriate status string.
 *
 * @param {String} reset key.
 * @param {Function} callback.
 */

function validateResetKey(reset_key, fn) {
    models.PasswordReset.findOne({
        reset_key: reset_key
    }, function(err, reset_entry) {
        if (reset_entry != null) {
            if (reset_entry.used) {
                return fn(null, 'used');
            }
            var time_diff = Math.abs(new Date() - reset_entry.date) / 36e5;
            if (time_diff <= config.RESET_VALIDITY) {
                return fn(null, 'success');
            } else {
                return fn(null, 'failure');
            }
        } else {
            return fn(null, 'invalid_key');
        }
    });
}

/**
 * Validates reset password request, and if valid, generates a reset key & *saves* it
 * to the database and then mails it to the user's registered email ID.
 *
 * @param {String} username.
 * @param {String} security question.
 * @param {String} security answer.
 * @param {String} domain that the app is running on.
 * @param {String} request's origin IP address.
 * @param {String} value of last_user cookie.
 * @param {Function} callback.
 */

function sendResetKey(name, security_question, security_answer, domain, ip, user_cookie, fn) {
    models.User.findOne({
        username: name,
        security_question: security_question,
        security_answer: security_answer
    }, function(err, user) {
        if (user) {
            var generateResetKey = require('./pass').generateResetKey;
            generateResetKey(user._id, function(err, reset_key) {
                var resetPass = new models.PasswordReset({
                    reset_key: reset_key,
                    user_id: user._id,
                    date: new Date()
                }).save(function(err, entry) {
                    mailer.mailResetKey(domain, ip, user_cookie, name, reset_key);
                    return fn(null, reset_key);
                });
            });
        } else {
            return fn(new Error(config.ERR_RESET_INVALID_DETAILS));
        }
    });
}

/**
 * Decrypts reset key and then updates password & reset key used status.
 * to the user's registered email ID.
 *
 * @param {String} encrypted reset key.
 * @param {String} new password input by user.
 * @param {Function} callback.
 */

function resetPassword(reset_key, new_password, fn) {
    var decryptResetKey = require('./pass').decryptResetKey;
    var user_id = null;
    decryptResetKey(reset_key, function(err, user_id) {
        crypt.hash(new_password, function(err, salt, hash) {
            if (err) throw err;
            var User = models.mongoose.model(config.DB_AUTH_TABLE, models.UserSchema);
            var query = {
                _id: user_id
            };
            var update_to = {
                salt: salt,
                hash: hash
            };
            var query_options = {
                multi: false
            };
            User.update(query, update_to, query_options, function(err, count) {
                if (err) throw err;
                config.logger.info('RESET PASSWORD - USER DOC UPDATED IN DB WITH NEW HASH', {
                    reset_key: reset_key,
                    records_updated: count
                });
                var PasswordReset = models.mongoose.model(config.DB_AUTH_PASSWORD_RESET, models.PasswordResetSchema);
                var query = {
                    reset_key: reset_key
                };
                var to_update = {
                    used: true
                }
                PasswordReset.findOneAndUpdate(query, to_update, {}, function(err, updated_record) {
                    if (err) throw err;
                    config.logger.info('RESET PASSWORD - RESET KEY DOC INVALIDATED IN DB', {
                        reset_key: reset_key
                    });
                    return fn(null, true);
                });
            });
        });
    });
}

/**
 * Module exports.
 */

module.exports = {
    authenticate: authenticate,
    requiredAuthentication: requiredAuthentication,
    isUsernameValid: isUsernameValid,
    userExist: userExist,
    activateUser: activateUser,
    validateResetKey: validateResetKey,
    sendResetKey: sendResetKey,
    resetPassword: resetPassword
}