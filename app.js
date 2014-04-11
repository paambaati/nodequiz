/**
 * TheQuiz
 * Authors: GP.
 * Version: 1.4
 * Release Date: 10-Apr-2014
 */

/**
 * Module dependencies.
 */

var express = require('express'),
    http = require('http'),
    path = require('path'),
    date = require('date'),
    swig = require('swig'),
    mongoose = require('mongoose'),
    date_format = require('date-format-lite'),
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

app.configure(function() {
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.cookieParser(config.APP_TITLE));
    app.use(express.session({
        secret: config.MASTER_SALT
    }));
    //app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(path.join(__dirname, 'public/stylesheets')));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'swig');
    swig.setDefaults({
        autoescape: false
    });
    app.engine('.html', swig.renderFile);
});

// `last_user` cookie test/set middleware.
// Saves logged in username to cookie. This is used during reset password.
// If a user is resetting password for someone else, this cookie value
// is sent for shaming.
app.use(function(req, res, next) {
    //var original_url = req.originalUrl;
    var cookie = req.cookies.last_user;
    if (cookie === undefined) {
        if (req.session.user) {
            res.cookie('last_user', req.session.user.username, {
                maxAge: 172800000,
                httpOnly: true
            }); //2-day cookie.
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
    res.locals.UPLOAD_DIR = config.UPLOAD_DIR;
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
    var error_data = {
        error: err,
        stacktrace: err.stack
    };
    if (req.session.error) {
        error_data.message = req.session.error;
    }
    res.render(config.TEMPL_500, error_data);
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
            hash(pass, user.salt, function(err, hash) {
                if (err) return fn(err);
                if (hash == user.hash) return fn(null, user);
                fn(new Error(config.ERR_AUTH_INVALID_PASSWORD));
            });
        } else {
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
            if (err) return fn(new Error(config.ERR_AUTH_INVALID_USERNAME));
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
 * @param {String} username.
 * @param {Function} callback.
 */

function activateUser(name, fn) {
    //Better use a new instance because mongoose behaves
    //weirdly when doing an UPDATE on an existing instance.
    var User = models.mongoose.model(config.DB_AUTH_TABLE, models.UserSchema);
    models.User.findOne({
        username: name
    }, function(err, user) {
        if (user) {
            console.log('user found! proceeding to update...');
            User.update({
                username: name,
                activated: false
            }, {
                activated: true
            }, {
                multi: false
            }, function(err, count) {
                if (err) {
                    throw err;
                }
                console.log('DB UPDATED PHEW! count = ', count);
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
            console.log('new password = ', new_password);
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
                console.log('DB UPDATED WITH NEW PASSWORD, PHEW! count = ', count);
                var PasswordReset = models.mongoose.model(config.DB_AUTH_PASSWORD_RESET, models.PasswordResetSchema);
                var query = {
                    reset_key: reset_key
                };
                var to_update = {
                    used: true
                }
                PasswordReset.findOneAndUpdate(query, to_update, {}, function(err, updated_record) {
                    if (err) throw err;
                    console.log('reset key entry updated..');
                    return fn(null, true);
                });
            });
        });
    });
}

/**
 * Routes
 */

//DEBUG
//GENERATES TEST DATA
app.get('/dummy', function(req, res) {
    /*stats.getDailyAttendees(function(err, result) {
        res.json({
            'result': result
        });
    });*/
    /*stats.getDailyAverageScore(function(err, result) {
        console.log('DAILY AVERAGE == ', result);
    });*/
    /*stats.getDailyQuickestQuiz(function(err, result) {
        console.log('DAILY QUICKEST QUIZ  == ', result);
    });*/
    res.render(config.TEMPL_QUIZ_STANDINGS);
});

app.get(config.URL.QUIZ_START, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    quiz.findUserQuestionsForToday(req.session.user._id, function(err, count) {
        quiz.findNextQuestion(count, function(err, question, allowed_time) {
            if (err && err.message == config.ERR_QUIZ_NOQUIZTODAY) {
                res.redirect(config.URL.QUIZ_NOQUIZ);
            }
            if (question !== null) {
                //Save answer with answer -1 to mark that the user has seen this question
                quiz.saveAnswer(req.session.user._id, question._id, '-1', '-1', function(err, record) {
                    req.session.question_id = question._id;
                    req.session.question_render_time = new Date();
                    res.render(config.TEMPL_QUIZ_START, {
                        question: question,
                        question_index: count + 1,
                        question_total: 10, //TO-DO: figure out how to get this from DB!!!
                        allowed_time: allowed_time,
                        image: question.image
                    });
                });
            } else {
                var today = new Date();
                today.setHours(0, 0, 0, 0);
                quiz.getResults(req.session.user._id, today, function(err, results) {
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
    quiz.saveAnswer(req.session.user._id, req.session.question_id, answer_choice, response_time, function(err, record) {
        res.redirect(req.originalUrl);
    });
});

app.get(config.URL.MAIN, function(req, res) {
    if (req.session.user) {
        res.redirect(config.URL.QUIZ_MAIN);
    } else {
        res.render(config.TEMPL_LOGIN, {
            tab: 'login'
        });
    }
});

app.get(config.URL.SIGNUP, function(req, res) {
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
    console.log('in URL_SIGNUP POST NOW...');
    console.log(username, '----', password, '----', password1);

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
                }).save(function(err, newUser) {
                    if (err) throw err;
                    var encrypt = require('./utils/pass').encrypt;
                    encrypt(username, function(err, activate_key) {
                        if (err) throw err;
                        var domain = req.protocol + '://' + req.get('host');
                        mailer.sendActivationLink(domain, username, activate_key);
                        console.log('encrypted activation key - ', activate_key);
                    });

                    res.render(config.TEMPL_200, {
                        message_title: 'Done!',
                        message_1: 'We\'ve sent you an email with the activation link!',
                        message_2: 'Check your mailbox yo!'
                    });
                });
            });
        } else {
            req.session.error = config.ERR_SIGNUP_ALREADY_EXISTS;
            res.redirect(config.URL.SIGNUP);
        }
    });
});

app.post(config.URL.FORGOT, function(req, res) {
    var username = req.body.username;
    var security_question = req.body.security_question;
    var security_answer = req.body.security_answer;
    console.log('in POST of /forgot now... for user - ', username);
    isUsernameValid(username, function(err, valid) {
        if (err) throw err;
        if (valid) {
            console.log('valid user alright. now to reset your password....');
            var domain = req.protocol + '://' + req.get('host');
            var ip = req.headers['x-forwarded-for'] ||
                req.connection.remoteAddress ||
                req.socket.remoteAddress ||
                req.connection.socket.remoteAddress;
            var user_cookie = req.cookies.last_user;
            sendResetKey(username, security_question, security_answer, domain, ip, user_cookie, function(err, reset_key) {
                if (err && err.message == config.ERR_RESET_INVALID_DETAILS) {
                    req.session.error = err.message;
                    res.redirect(config.URL.FORGOT);
                } else if (err) {
                    throw err;
                }
                console.log('key generated. reset key = ', reset_key);
                res.render(config.TEMPL_200, {
                    message_title: 'Done!',
                    message_1: 'We\'ve sent you an email with your reset key that is valid for <strong>' + config.RESET_VALIDITY + '</strong> hours!',
                    message_2: 'Check your mailbox yo!'
                });
            });

        } else {
            req.session.error = config.ERR_RESET_INVALID_USERNAME;
            res.redirect(config.URL.FORGOT);
        }
    });
});

app.get(config.URL.RESET + '/:reset_key', function(req, res) {
    var reset_key = req.params.reset_key;
    validateResetKey(reset_key, function(err, status) {
        if (err) throw err;
        res.render(config.TEMPL_RESET, {
            'reset_key': reset_key
        });
    });
});

app.post(config.URL.RESET, function(req, res) {
    var reset_key = req.body.reset_key;
    var new_password = req.body.new_password1;
    validateResetKey(reset_key, function(err, status) {
        if (err) throw err;
        if (status == 'success') {
            resetPassword(reset_key, new_password, function(err, succeeded) {
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
    authenticate(req.body.username, req.body.password, function(err, user) {
        if (user) {
            req.session.regenerate(function() {
                req.session.user = user;
                req.session.is_admin = user.admin;
                req.session.success = 'Authenticated as ' + user.username;
                res.redirect(config.URL.QUIZ_MAIN);
            });
        } else {
            req.session.error = config.ERR_AUTH_FAILED;
            res.redirect(config.URL.LOGIN);
        }
    });
});

app.get(config.URL.ACTIVATE + '/:activate_key', function(req, res) {
    console.log('in GET of /activate now...');
    var decrypt = require('./utils/pass').decrypt;
    decrypt(req.params.activate_key, function(err, username) {
        if (err) {
            req.session.error = '... but not really. Looks like your activation key is invalid.' +
                'Either you\'re trying to break into someone else\'s account (which is really lame) ' +
                'or.. nope. You\'re lame.';
            throw err;
        }
        console.log('decrypted username - ', username);
        activateUser(username, function(err, count) {
            if (err) {
                console.log(err);
                console.log('activation -> error caught in activateUser() function!');
                req.session.error = 'User no longer exists!';
                throw err;
            }
            console.log('activateUser - return value - ', count);
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
            } //handle other cases, should I?
        });
    });
});

//Ajax URLs

app.get(config.URL.QUIZ_STAT_AJAX, /*requiredAuthentication,*/ function(req, res) {
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
    }
});

//General URLs

app.get(config.URL.LOGOUT, function(req, res) {
    req.session.destroy(function() {
        res.redirect(config.URL.MAIN);
    });
});

app.get(config.URL.FORGOT, function(req, res) {
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

app.get(config.URL.QUIZ_NOQUIZ, requiredAuthentication, function(req, res) {
    res.render(config.TEMPL_QUIZ_NOQUIZ);
});

app.get(config.URL.LOGIN, function(req, res) {
    res.render(config.TEMPL_LOGIN, {
        tab: 'login'
    });
});

app.get(config.URL.QUIZ_MAIN, requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
    var template = (req.session.is_admin) ? config.TEMPL_QUIZ_ADMIN : config.TEMPL_QUIZ_MAIN;
    res.render(template, {
        'username': req.session.user.username
    });
});

app.get(config.URL.QUIZ_STANDINGS, requiredAuthentication, function(req, res) {
    res.render(config.TEMPL_QUIZ_STANDINGS);
});

/**
 * Error handling.
 */

//Use Express' built-in 500 handler.
//app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

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

/*process.on('uncaughtException', function(err) {
    config.logger.log('error', 'UNCAUGHT EXCEPTION! ', err.stack);
});*/

/**
 * Run the app!
 */

http.createServer(app).listen(config.APP_PORT, function() {
    console.log('NodeJS Express server listening on port [' + config.APP_PORT + ']');
});