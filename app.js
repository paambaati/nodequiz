/**
 * TheQuiz
 * Author: GP.
 * Version: 1.7
 * Release Date: 27-Apr-2014
 */

/**
 * Module dependencies.
 */

var express = require('express'),
    http = require('http'),
    bodyparser = require('body-parser'),
    methodoverride = require('method-override'),
    cookieparser = require('cookie-parser'),
    session = require('express-session'),
    morgan = require('morgan'),
    fs = require('fs'),
    path = require('path'),
    date = require('date'),
    swig = require('swig'),
    mongoose = require('mongoose'),
    mongostore = require('connect-mongo')({
        session: session
    }),
    formidable = require('formidable'),
    dateformat = require('date-format-lite'),
    hash = require('./utils/pass').hash,
    config = require('./config/config'),
    models = require('./models'),
    quiz = require('./utils/quiz'),
    stats = require('./utils/stats'),
    mailer = require('./utils/mail'),
    misc = require('./utils/misc');

var app = express();

/**
 * Middlewares.
 */

app.use(morgan('dev'));
app.use(bodyparser());
app.use(cookieparser(config.APP_TITLE));
app.use(session({
    secret: config.MASTER_SALT,
    store: new mongostore({
        db: config.DB_NAME,
        cookie: {
            maxAge: 86400
        }, //1-day cookie.
        host: config.DB_HOST,
        port: config.DB_PORT,
        collection: config.DB_AUTH_SESSIONS,
        auto_reconnect: true
    })
}));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/stylesheets')));
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'swig');
swig.setDefaults({
    autoescape: false
});
app.engine('.html', swig.renderFile);

// `last_user` cookie test/set middleware.
// Saves logged in username to cookie. This is used during reset password.
// If a user is resetting password for someone else, this cookie value
// is sent for shaming.
app.use(function(req, res, next) {
    var cookie = req.cookies.last_user;
    var session_username = (req.session.user) ? req.session.user.username : null;
    if (cookie === undefined || cookie != session_username) {
        if (req.session.user) {
            res.cookie('last_user', req.session.user.username, {
                maxAge: 172800000,
                httpOnly: true
            }); //2-day cookie.
            config.logger.info('SHAME COOKIE - COOKIE SUCCESSFULLY SET', {
                username: req.session.user.username
            });
        }
    }
    next();
});

// Messaging middleware.
app.use(function(req, res, next) {
    var error = req.session.error,
        msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = null;
    if (error) {
        res.locals.message = error;
        res.locals.message_type = 'danger';
    }
    if (msg) {
        res.locals.message = msg;
        res.locals.message_type = 'success';
    }
    res.locals.app_title = config.APP_TITLE;
    res.locals.URL = config.URL;
    res.locals.username = (req.session.user) ? req.session.user.username : '';
    res.locals.UPLOAD_DIR = config.UPLOAD_DIR;
    res.locals.IS_ADMIN = (req.session.is_admin) ? true : false;
    res.locals.COMPANY_SHORT_NAME = config.COMPANY_SHORT_NAME;
    res.locals.MAIL_USER_DOMAIN = config.MAIL_USER_DOMAIN;
    next();
});

/**
 * Helper functions.
 */

/**
 * Custom 500 page handler.
 *
 * @param {Error} full error.
 * @param {Request} request.
 * @param {Response} response.
 * @param {Boolean} allow to move to next middleware.
 */
function errorHandler(err, req, res, next) {
    res.status(500);
    var is_ajax_request = req.xhr;
    var error_data = {
        error: err,
        stacktrace: err.stack
    };
    if (req.session.error) {
        error_data.message = req.session.error;
    }
    if (!is_ajax_request) {
        res.render(config.TEMPL_500, error_data);
    } else {
        res.json(error_data);
    }
}

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
                hash(pass, user.salt, function(err, hash) {
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
            var generateResetKey = require('./utils/pass').generateResetKey;
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
    var decryptResetKey = require('./utils/pass').decryptResetKey;
    var user_id = null;
    decryptResetKey(reset_key, function(err, user_id) {
        hash(new_password, function(err, salt, hash) {
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
 * Routes
 */

app.get(config.URL.QUIZ_START, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    config.logger.info('START QUIZ - PAGE GET', {
        username: req.session.user.username
    });
    quiz.findUserQuestionsForToday(req.session.user._id, function(err, count) {
        quiz.findNextQuestion(count, function(err, question, total_questions) {
            if (err && err.message == config.ERR_QUIZ_NOQUIZTODAY) {
                res.redirect(config.URL.QUIZ_NOQUIZ);
            }
            if (question !== null) {
                config.logger.info('START QUIZ - SHOWING QUESTION', {
                    username: req.session.user.username,
                    question_id: question._id
                });
                //Save answer with answer -1 to mark that the user has seen this question
                quiz.saveAnswer(req.session.user._id, question._id, '-1', '0', function(err, record) {
                    req.session.question_id = question._id;
                    req.session.question_render_time = new Date();
                    res.render(config.TEMPL_QUIZ_START, {
                        question: question,
                        question_index: count + 1,
                        total_questions: total_questions,
                        image: question.image
                    });
                });
            } else {
                var today = new Date();
                today.setHours(0, 0, 0, 0);
                quiz.getResults(req.session.user._id, today, function(err, results) {
                    config.logger.info('START QUIZ - QUIZ COMPLETED. SHOWING RESULTS', {
                        username: req.session.user.username
                    });
                    res.render(config.TEMPL_QUIZ_END, {
                        results: results
                    });
                });
            }
        });
    });
});

app.post(config.URL.QUIZ_START, function(req, res) {
    var response_time = (new Date() - req.session.question_render_time.toString().date()) / 1000;
    var answer_choice = req.body.choice;
    config.logger.info('START QUIZ - FORM POST - SAVING ANSWER DOC IN DB', {
        username: req.session.user.username,
        question_id: req.session.question_id,
        answer_chosen: answer_choice,
        response_time: response_time
    });
    quiz.saveAnswer(req.session.user._id, req.session.question_id, answer_choice, response_time, function(err, record) {
        res.redirect(req.originalUrl);
    });
});

app.get(config.URL.MAIN, function(req, res) {
    if (req.session.user) {
        config.logger.info('QUIZ - WELCOME - PAGE GET', {
            username: req.session.user.username
        });
        res.redirect(config.URL.QUIZ_MAIN);
    } else {
        res.render(config.TEMPL_LOGIN, {
            tab: 'login'
        });
    }
});

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

app.post(config.URL.SIGNUP, userExist, function(req, res) {
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
            isUsernameValid(username, function(err, valid) {
                if (err) throw err;
                if (!valid) {
                    hash(password, function(err, salt, hash) {
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
                            var encrypt = require('./utils/pass').encrypt;
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

app.post(config.URL.FORGOT, function(req, res) {
    var username = req.body.username;
    var security_question = req.body.security_question;
    var security_answer = req.body.security_answer;
    config.logger.info('FORGOT PASSWORD - FORM POST', {
        username: username
    });
    isUsernameValid(username, function(err, valid) {
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
            sendResetKey(username, security_question, security_answer, domain, ip, user_cookie, function(err, reset_key) {
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

app.get(config.URL.RESET + '/:reset_key', function(req, res) {
    var reset_key = req.params.reset_key;
    config.logger.info('RESET PASSWORD - PAGE GET', {
        reset_key: reset_key
    });
    validateResetKey(reset_key, function(err, status) {
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

app.post(config.URL.RESET, function(req, res) {
    var reset_key = req.body.reset_key;
    var new_password = req.body.new_password1;
    config.logger.info('RESET PASSWORD - FORM POST', {
        reset_key: reset_key
    });
    validateResetKey(reset_key, function(err, status) {
        if (err) throw err;
        config.logger.info('RESET PASSWORD - POST - RESET KEY VALIDATION COMPLETED', {
            reset_key: reset_key,
            status: status
        });
        if (status == 'success') {
            resetPassword(reset_key, new_password, function(err, succeeded) {
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

app.post(config.URL.LOGIN, function(req, res) {
    var username = req.body.username;
    config.logger.info('LOGIN - FORM POST', {
        username: username
    });
    authenticate(username, req.body.password, function(err, user) {
        if (user) {
            req.session.regenerate(function() {
                config.logger.info('LOGIN - SESSION REGENERATED SUCCESSFULLY', {
                    username: username
                });
                req.session.user = user;
                req.session.is_admin = user.admin;
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

app.get(config.URL.ACTIVATE + '/:activate_key', function(req, res) {
    var activate_key = req.params.activate_key;
    config.logger.info('ACTIVATION - PAGE GET', {
        activate_key: activate_key
    });
    var decrypt = require('./utils/pass').decrypt;
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
        activateUser(user_id, function(err, count) {
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

//Ajax URLs

app.get(config.URL.QUIZ_STAT_AJAX, requiredAuthentication, function(req, res) {
    config.logger.info('QUIZ STANDINGS - AJAX GET', {
        username: req.session.user.username,
        requested_statistic: req.query.stat
    });
    if (req.query.stat == 'basic') {
        stats.getAllDailyBasicStats(function(err, daily_stats) {
            res.json(daily_stats);
        });
    } else if (req.query.stat == 'top5') {
        stats.getTop5(req.query.period, function(err, top5rankers) {
            /*//Sleep for 2 seconds
            var stop = new Date().getTime();
            while (new Date().getTime() < stop + 2000) {;
            }
            //End sleep*/
            res.json(top5rankers);
        });
    } else if (req.query.stat == 'easytough') {
        stats.getTodaysToughestAndEasiestQuestion(function(err, result) {
            res.json(result);
        });
    } else if (req.query.stat == 'myhistory') {
        var start_day = new Date();
        start_day.setDate(start_day.getDate() - 30);
        stats.getPersonalScoreHistory(req.session.user._id, start_day, function(err, results) {
            res.json(results);
        });
    }
});

app.del(config.URL.QUIZ_ADMIN_SAVE_AJAX, requiredAuthentication, function(req, res) {
    config.logger.info('QUIZ ADMIN - FORM DELETE - DELETE QUESTION', {
        username: req.session.user.username,
        request_params: req.body
    });

    if (req.session.is_admin) {
        quiz.deleteQuestion(req.body.question_id, function(err, deleted_id) {
            if (err) {
                config.logger.error('QUIZ ADMIN - FORM DELETE - DELETION FAILED', {
                    username: req.session.user.username,
                    question_id: req.body.question_id,
                    error: err
                });
                res.json({
                    'error': true,
                    'response': err.message
                })
            } else {
                config.logger.info('QUIZ ADMIN - FORM DELETE - QUESTION DOC DELETED FROM DB', {
                    username: req.session.user.username,
                    deleted_question_id: deleted_id
                });
                res.json({
                    'error': false,
                    'deleted_id': deleted_id
                });
            }
        })
    } else {
        res.status(403);
        res.json({
            'error': true,
            'response': 'lol nice try'
        });
    }
});

app.post(config.URL.QUIZ_ADMIN_SAVE_AJAX, requiredAuthentication, function(req, res) {
    config.logger.info('QUIZ ADMIN - FORM POST - SAVE QUESTION', {
        username: req.session.user.username,
        request_params: req.body
    });

    var question_json = {
        'date': new Date(),
        'choices': {}
    },
        choice_counter = 1,
        form_name_counter = 0,
        req_body = req.body,
        question_id = null;
    if (req.session.is_admin) {
        for (var item in req_body) {
            //Sanitize for HTML/XSS
            item = item.replace(/&/g, '&amp;').
            replace(/</g, '&lt;'). // it's not neccessary to escape >
            replace(/"/g, '&quot;').
            replace(/'/g, '&#039;');
            //All form elements will be submitted as element-name-n where n is the nth form on the admin page.
            //We strip it from each element. Silly, I know.
            var new_item = item.substring(0, item.lastIndexOf('-'));
            form_name_counter = item.substring(item.lastIndexOf('-') + 1, item.length);
            if (item.lastIndexOf('choice') === 0 && req_body[item].trim() !== '') {
                question_json['choices'][choice_counter] = {
                    'choice_text': req_body[item]
                };
                choice_counter++;
            } else {
                question_json[new_item] = (req_body[item]) ? req_body[item] : null;
            }
        }

        question_id = req_body['question_id-' + form_name_counter] ? req_body['question_id-' + form_name_counter] : null;
        delete question_json['question_id'];

        quiz.saveQuestion(question_id, question_json, function(err, question_id) {
            if (err) {
                config.logger.error('QUIZ ADMIN - FORM POST - SAVE FAILED!', {
                    username: req.session.user.username,
                    question_json: question_json,
                    question_id: question_id,
                    error: err
                });
                res.status(500);
                res.json({
                    'error': err,
                    'response': 'Question not saved!'
                });
            } else {
                config.logger.info('QUIZ ADMIN - FORM POST - QUESTION DOC SAVED IN DB', {
                    username: req.session.user.username,
                    question_json: question_json,
                    question_id: question_id
                });
                res.json({
                    'error': false,
                    'question_id': question_id
                });
            }
        });
    } else {
        res.status(403);
        res.json({
            'error': true,
            'response': 'lol nice try'
        });
    }
});

//General URLs

app.get(config.URL.LOGOUT, function(req, res) {
    config.logger.info('LOGOUT', {
        username: req.session.user.username
    });
    req.session.destroy(function() {
        res.redirect(config.URL.MAIN);
    });
});

app.get(config.URL.FORGOT, function(req, res) {
    config.logger.info('FORGOT PASSWORD - PAGE GET');
    res.render(config.TEMPL_LOGIN, {
        tab: 'forgot'
    });
});

app.get(config.URL.TIMECLOSED, requiredAuthentication, function(req, res) {
    res.render(config.TEMPL_TIMECLOSED, {
        start_hour: config.QUIZ_START_TIME[0],
        stop_hour: config.QUIZ_STOP_TIME[0]
    });
});

app.get(config.URL.FAQ, function(req, res) {
    res.render(config.TEMPL_FAQ, {
        start_hour: config.QUIZ_START_TIME,
        stop_hour: config.QUIZ_STOP_TIME
    });
});

app.get(config.URL.QUIZ_NOQUIZ, requiredAuthentication, function(req, res) {
    res.render(config.TEMPL_QUIZ_NOQUIZ);
});

app.get(config.URL.LOGIN, function(req, res) {
    config.logger.info('LOGIN - PAGE GET');
    res.render(config.TEMPL_LOGIN, {
        tab: 'login'
    });
});

app.get(config.URL.QUIZ_MAIN, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    config.logger.info('QUIZ - WELCOME - PAGE GET', {
        username: req.session.user.username,
        is_admin: req.session.is_admin
    });
    if (req.session.is_admin) {
        res.redirect(config.URL.QUIZ_ADMIN);
    } else {
        res.render(config.TEMPL_QUIZ_MAIN);
    }
});

app.get(config.URL.QUIZ_ADMIN, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    config.logger.info('QUIZ ADMIN - PAGE GET', {
        username: req.session.user.username,
        is_admin: req.session.is_admin
    });
    quiz.getAllQuestions(function(err, questions) {
        config.logger.info('QUIZ ADMIN - PAGE GET - RENDERING %s QUESTIONS.', questions.length);
        res.render(config.TEMPL_QUIZ_ADMIN, {
            questions: questions
        });
    });
});

app.del(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    var file_name = path.join(__dirname, '/public/', config.UPLOAD_DIR, req.body.file_name);
    fs.unlink(file_name, function(err) {
        if (err) {
            config.logger.warn('QUIZ ADMIN - IMAGE DELETE FAILED', {
                request_body: req.body
            });
        }
        res.send(null);
    });
});

app.post(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    config.logger.info('QUIZ ADMIN - UPLOAD IMAGE POST', {
        username: req.session.user.username,
        is_admin: req.session.is_admin
    });
    if (req.session.is_admin) {
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            var old_path = files.file.path,
                image_size = files.file.size,
                file_ext = files.file.name.split('.').pop(),
                index = files.file.path.lastIndexOf('/') + 1,
                file_name = files.file.path.substr(index),
                new_path = path.join(__dirname, '/public/', config.UPLOAD_DIR, file_name + '.' + file_ext);

            config.logger.info('QUIZ ADMIN - UPLOAD IMAGE POST - PARSED PARAMETERS', {
                old_path: old_path,
                new_path: new_path,
                image_size: image_size
            });

            fs.readFile(old_path, function(err, data) {
                fs.writeFile(new_path, data, function(err) {
                    fs.unlink(old_path, function(err) {
                        if (err) {
                            res.status(500);
                            res.json({
                                'error': err.message
                            });
                        } else {
                            res.json({
                                'error': null,
                                'file_path': file_name + '.' + file_ext,
                                'image_size': image_size
                            });
                        }
                    });
                });
            });
        });
    } else {
        res.status(403);
        res.json({
            'error': true,
            'response': 'lol nice try'
        });
    }
});

app.get(config.URL.QUIZ_STANDINGS, requiredAuthentication, function(req, res) {
    config.logger.info('QUIZ STANDINGS - PAGE GET');
    res.render(config.TEMPL_QUIZ_STANDINGS);
});

/**
 * Error handling.
 */

//Use our custom 500 handler.
app.use(errorHandler);

//404 handler.
app.use(function(req, res, next) {
    res.status(404);
    res.render(config.TEMPL_400, {
        url: req.url
    });
    return;
});

/**
 * Run the app!
 */

app.listen(config.APP_PORT, function() {
    config.logger.info('START - NodeJS Express server started listening on port [' + config.APP_PORT + ']');
});