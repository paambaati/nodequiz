/**
 * User routes.
 * Author: GP.
 * Version: 1.0.3
 * Release Date: 11-May-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    models = require('../models/models'),
    user = require('../utils/user'),
    crypt = require('../utils/pass'),
    misc = require('../utils/misc'),
    mailer = require('../utils/mail');

/*
 * Module exports.
 */

module.exports = function(app) {

    /**
     * GET '/'
     */
    app.get(config.URL.MAIN, function(req, res) {
        config.logger.info('QUIZ - MAIN - PAGE GET', {
            username: (req.session.user) ? req.session.user.username : 'AnonymousUser'
        });
        if (req.session.user) {
            res.redirect(config.URL.QUIZ_MAIN);
        } else {
            res.render(config.TEMPL_LOGIN, {
                tab: 'login'
            });
        }
    });

    /**
     * GET '/login'
     */

    app.get(config.URL.LOGIN, function(req, res) {
        config.logger.info('LOGIN - PAGE GET');
        res.render(config.TEMPL_LOGIN, {
            tab: 'login'
        });
    });

    /**
     * POST '/login'
     */

    app.post(config.URL.LOGIN, function(req, res) {
        var username = req.body.username;
        config.logger.info('LOGIN - FORM POST', {
            username: username
        });
        user.authenticate(username, req.body.password, function(err, user) {
            console.log(user);
            if (user) {
                req.session.regenerate(function() {
                    config.logger.info('LOGIN - SESSION REGENERATED SUCCESSFULLY', {
                        username: username
                    });
                    //Custom session variables.
                    req.session.user = user;
                    req.session.is_admin = user.admin;
                    req.session.last_seen = user.last_seen;
                    req.session.success = 'Authenticated as ' + user.username;
                    res.redirect(config.URL.QUIZ_MAIN);
                });
            } else {
                config.logger.warn('LOGIN - LOGIN FAILED', {
                    username: username,
                    error: err.message
                });
                req.session.error = err.message;
                res.redirect(config.URL.LOGIN);
            }
        });
    });

    /**
     * GET '/logout'
     */

    app.get(config.URL.LOGOUT, function(req, res) {
        config.logger.info('LOGOUT', {
            username: req.session.user.username
        });
        req.session.destroy(function() {
            res.redirect(config.URL.MAIN);
        });
    });

    /**
     * GET '/signup'
     */

    app.get(config.URL.SIGNUP, function(req, res) {
        config.logger.info('SIGNUP - PAGE GET');
        if (req.session.user) {
            res.redirect(config.URL.MAIN);
        } else {
            res.render(config.TEMPL_LOGIN, {
                tab: 'signup'
            });
        }
    });

    /**
     * POST '/signup'
     */

    app.post(config.URL.SIGNUP, user.userExist, function(req, res) {
        var username = req.body.username;
        var password = req.body.first_password;
        var password1 = req.body.second_password;
        var security_question = req.body.security_question;
        var security_answer = req.body.security_answer;
        config.logger.info('SIGNUP - FORM POST', {
            username: username,
            security_question: security_question,
            security_answer: security_answer
        });

        misc.validateSignUpForm(req.body, function(err, valid) {
            if (err) {
                req.session.error = err;
                res.redirect(config.URL.SIGNUP);
            } else {
                user.isUsernameValid(username, function(err, valid) {
                    if (err) throw err;
                    if (!valid) {
                        crypt.hash(password, function(err, salt, hash) {
                            if (err) throw err;
                            var user = new models.User({
                                username: username,
                                salt: salt,
                                hash: hash,
                                security_question: security_question,
                                security_answer: security_answer
                            }).save(function(err, new_user) {
                                if (err) throw err;
                                config.logger.info('SIGNUP - USER SAVED IN DB. PROCEEDING TO GENERATE ACTIVATE KEY NOW.', {
                                    username: username
                                });
                                var encrypt = require('../utils/pass').encrypt;
                                encrypt(new_user._id, function(err, activate_key) {
                                    if (err) throw err;
                                    var domain = req.protocol + '://' + req.get('host');
                                    mailer.sendActivationLink(domain, username, activate_key);
                                    config.logger.info('SIGNUP - SENDING ACTIVATION LINK VIA EMAIL', {
                                        username: username,
                                        activate_key: activate_key
                                    });
                                });

                                res.render(config.TEMPL_200, {
                                    message_title: 'Done!',
                                    message_1: 'We\'ve sent you an email with the activation link!',
                                    message_2: 'Check your mailbox yo!'
                                });
                            });
                        });
                    } else {
                        config.logger.warn('SIGNUP - USERNAME ALREADY EXISTS', {
                            username: username
                        });
                        req.session.error = config.ERR_SIGNUP_ALREADY_EXISTS;
                        res.redirect(config.URL.SIGNUP);
                    }
                });
            }
        });
    });

    /**
     * GET '/forgot'
     */

    app.get(config.URL.FORGOT, function(req, res) {
        config.logger.info('FORGOT PASSWORD - PAGE GET');
        res.render(config.TEMPL_LOGIN, {
            tab: 'forgot'
        });
    });

    /**
     * POST '/forgot'
     */

    app.post(config.URL.FORGOT, function(req, res) {
        var username = req.body.username;
        var security_question = req.body.security_question;
        var security_answer = req.body.security_answer;
        config.logger.info('FORGOT PASSWORD - FORM POST', {
            username: username
        });
        user.isUsernameValid(username, function(err, valid) {
            if (err) throw err;
            if (valid) {
                var domain = req.protocol + '://' + req.get('host');
                var ip = req.headers['x-forwarded-for'] ||
                    req.connection.remoteAddress ||
                    req.socket.remoteAddress ||
                    req.connection.socket.remoteAddress;
                var user_cookie = req.cookies.last_user;
                config.logger.info('FORGOT PASSWORD - USER DOC EXISTS IN DB. PROCEEDING TO SEND RESET LINK NOW.', {
                    username: username,
                    domain: domain,
                    ip_address: ip,
                    shame_cookie: user_cookie
                });
                user.sendResetKey(username, security_question, security_answer, domain, ip, user_cookie, function(err, reset_key) {
                    if (err && err.message == config.ERR_RESET_INVALID_DETAILS) {
                        config.logger.warn('FORGOT PASSWORD - INVALID DETAILS ENTERED BY USER', {
                            username: username,
                            security_question: security_question,
                            security_answer: security_answer
                        });
                        req.session.error = err.message;
                        res.redirect(config.URL.FORGOT);
                    } else if (err) {
                        throw err;
                    }
                    config.logger.info('FORGOT PASSWORD - SENDING RESET LINK VIA EMAIL', {
                        username: username,
                        reset_key: reset_key
                    });
                    res.render(config.TEMPL_200, {
                        message_title: 'Done!',
                        message_1: 'We\'ve sent you an email with your reset key that is valid for <strong>' + config.RESET_VALIDITY + '</strong> hours!',
                        message_2: 'Check your mailbox yo!'
                    });
                });

            } else {
                config.logger.warn('FORGOT PASSWORD - USERNAME DOC DOES NOT EXIST IN DB', {
                    username: username
                });
                req.session.error = config.ERR_RESET_INVALID_USERNAME;
                res.redirect(config.URL.FORGOT);
            }
        });
    });

    /**
     * GET '/reset/xxxxxxxx'
     */

    app.get(config.URL.RESET + '/:reset_key', function(req, res) {
        var reset_key = req.params.reset_key;
        config.logger.info('RESET PASSWORD - PAGE GET', {
            reset_key: reset_key
        });
        user.validateResetKey(reset_key, function(err, status) {
            if (err) throw err;
            config.logger.info('RESET PASSWORD - GET - RESET KEY VALIDATION COMPLETED', {
                reset_key: reset_key,
                status: status
            });
            res.render(config.TEMPL_RESET, {
                'reset_key': reset_key
            });
        });
    });

    /**
     * POST '/reset'
     */

    app.post(config.URL.RESET, function(req, res) {
        var reset_key = req.body.reset_key;
        var new_password = req.body.new_password1;
        config.logger.info('RESET PASSWORD - FORM POST', {
            reset_key: reset_key
        });
        user.validateResetKey(reset_key, function(err, status) {
            if (err) throw err;
            config.logger.info('RESET PASSWORD - POST - RESET KEY VALIDATION COMPLETED', {
                reset_key: reset_key,
                status: status
            });
            if (status == 'success') {
                user.resetPassword(reset_key, new_password, function(err, succeeded) {
                    config.logger.info('RESET PASSWORD - PASSWORD RESET COMPLETE', {
                        reset_key: reset_key,
                        succeeded: succeeded
                    });
                    if (succeeded) {
                        res.render(config.TEMPL_200, {
                            message_title: 'Done!',
                            message_1: 'Your password has been reset!',
                            message_2: 'You can now login and start taking quizzes again.'
                        });
                    }
                });
            } else {
                res.render(config.TEMPL_RESET, {
                    'reset_key': reset_key,
                    'status': status
                });
            }
        });
    });

    /**
     * GET '/activate/xxxxxxx'
     */

    app.get(config.URL.ACTIVATE + '/:activate_key', function(req, res) {
        var activate_key = req.params.activate_key;
        config.logger.info('ACTIVATION - PAGE GET', {
            activate_key: activate_key
        });
        var decrypt = require('../utils/pass').decrypt;
        decrypt(activate_key, function(err, user_id) {
            if (err) {
                config.logger.error('ACTIVATION - ACTIVATION KEY DECRYPTION FAILED', {
                    activate_key: activate_key
                });
                req.session.error = '... but not really. Looks like your activation key is invalid.' +
                    'Either you\'re trying to break into someone else\'s account (which is really lame) ' +
                    'or.. nope. You\'re lame.';
                throw err;
            }
            config.logger.info('ACTIVATION - ACTIVATION KEY SUCCESSFULLY DECRYPTED', {
                activate_key: activate_key,
                user_id: user_id
            });
            user.activateUser(user_id, function(err, count) {
                if (err) {
                    config.logger.error('ACTIVATION - ACTIVATION FAILED', {
                        user_id: user_id,
                        error: err
                    });
                    req.session.error = 'User no longer exists!';
                    throw err;
                }
                config.logger.info('ACTIVATION - ACTIVATION COMPLETED FOR USER', {
                    user_id: user_id,
                    records_updated: count
                });
                if (count == 1) {
                    res.render(config.TEMPL_200, {
                        message_title: 'Done!',
                        message_1: 'Your account has been activated!',
                        message_2: 'You can now login and start taking quizzes.'
                    });
                } else if (count == 0) {
                    res.render(config.TEMPL_200, {
                        message_title: 'WAITAMINIT!',
                        message_1: 'Your account has already been activated!',
                        message_2: 'Did you <a href="' + config.URL.FORGOT + '">forget</a> your password?'
                    });
                }
            });
        });
    });

    /**
     * GET '/timeclosed'
     */

    app.get(config.URL.TIMECLOSED, user.requiredAuthentication, function(req, res) {
        res.render(config.TEMPL_TIMECLOSED, {
            start_time: config.QUIZ_START_TIME,
            stop_time: config.QUIZ_STOP_TIME,
            current_time: [new Date().getHours(), new Date().getMinutes()]
        });
    });

    /**
     * GET '/faq'
     */

    app.get(config.URL.FAQ, function(req, res) {
        res.render(config.TEMPL_FAQ, {
            username: (req.session.user) ? req.session.user.username : null,
            start_time: config.QUIZ_START_TIME,
            stop_time: config.QUIZ_STOP_TIME
        });
    });

    /**
     * GET '/feedback'
     */

    app.get(config.URL.FEEDBACK, user.requiredAuthentication, function(req, res) {
        res.render(config.TEMPL_FEEDBACK);
    });

    /**
     * POST '/feedback'
     */

    app.post(config.URL.FEEDBACK, user.requiredAuthentication, function(req, res) {
        var username = req.session.user.username,
            form_data = req.body;
        config.logger.info('FEEDBACK - FORM POST', {
            username: username,
            form_data: form_data
        });
        user.saveFeedback(username, form_data);
        res.render(config.TEMPL_FEEDBACK, {
            'form_submitted': true
        });
    });
};