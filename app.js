
/**
 * TheQuiz
 * Authors: GP.
 * Version: 1.0
 * Release Date: XX-XXX-2014
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
    mailer = require('./utils/mail'),
    misc = require('./utils/misc');

var app = express();

/**
 * Middlewares.
 */

app.configure(function () {
    app.use(express.logger('dev'));
    app.use(express.json());
    app.use(express.urlencoded());
    app.use(express.cookieParser(config.APP_TITLE));
    app.use(express.session({ secret: config.MASTER_SALT }));
    //app.use(app.router);
    app.use(express.static(path.join(__dirname, 'public')));
    app.use(express.static(path.join(__dirname, 'public/stylesheets')));
    app.set('views', path.join(__dirname, 'views'));
    app.set('view engine', 'swig');
    swig.setDefaults({ autoescape: false});
    app.engine('.html', swig.renderFile);
});

// `last_user` cookie test/set middleware.
// Saves logged in username to cookie. This is used during reset password.
// If a user is resetting password for someone else, this cookie value
// is sent for shaming.
app.use(function (req, res, next) {
    //var original_url = req.originalUrl;
    var cookie = req.cookies.last_user;
    if (cookie === undefined) {
        if (req.session.user) {
            res.cookie('last_user', req.session.user.username, { maxAge: 172800000, httpOnly: true }); //2-day cookie.
        }
    }
    next();
});

// Messaging middleware.
app.use(function (req, res, next) {
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
    //maybe set tab name here as well, which can be passed from other functions.
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
    var error_data = { error: err, stacktrace: err.stack };
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
    }, function (err, user) {
        if (user) {
            if (err) return fn(new Error(config.ERR_AUTH_INVALID_USERNAME));
            hash(pass, user.salt, function (err, hash) {
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
    }, function (err, user) {
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
    }, function (err, count) {
        if (count === 0) {
            next();
        } else {
            req.session.error = config.ERR_SIGNUP_ALREADY_EXISTS;
            res.render(config.TEMPL_LOGIN, { tab: 'signup' });
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
    var User = models.mongoose.model(config.DB_AUTH_TABLE, UserSchema);
    models.User.findOne({
        username: name
    }, function (err, user) {
        if (user) {
            console.log('user found! proceeding to update...');
            models.User.update({ username: name, activated: false }, { activated: true }, { multi: false }, function(err, count) {
                if(err) { throw err; }
                console.log('DB UPDATED PHEW! count = ', count);
                return fn(null, count);
            });
        } else {
            return fn(new Error(config.ERR_ACTIVATION_INVALID_KEY));
        }
    });
}

/**
 * Resets user password and sends an email with the new password
 * to the user's registered email ID.
 *
 * @param {String} username.
 * @param {String} security question.
 * @param {String} security answer.
 * @param {String} domain that the app is running on.
 * @param {String} request's origin IP address.
 * @param {String} value of last_user cookie.
 * @param {Function} callback.
 */

function resetPassword(name, security_question, security_answer, domain, ip, user_cookie, fn) {
    //Better use a new instance because mongoose behaves
    //weirdly when doing an UPDATE on an existing instance.
    var User = models.mongoose.model(config.DB_AUTH_TABLE, UserSchema);
    models.User.findOne({
        username: name,
        security_question: security_question,
        security_answer: security_answer
    }, function (err, user) {
        if (user) {
            console.log('user found! proceeding to reset password...');
            console.log(user._id);
            var new_password = (Math.random() + 1).toString(32).slice(2);
            hash(new_password, function (err, salt, hash) {
                if (err) throw err;
                console.log('new password = ', new_password);
                models.User.update({ username: name }, { salt: salt, hash: hash }, { multi: false }, function(err, count) {
                    if(err) throw err;
                    console.log('DB UPDATED WITH NEW PASSWORD, PHEW! count = ', count);
                    mailer.sendNewPassword(domain, ip, user_cookie, name, new_password);
                    return fn(null, new_password);
                });
            });
        } else {
            return fn(new Error(config.ERR_RESET_INVALID_DETAILS));
        }
    });
}
/**
 * Routes
 */

//DEBUG
//GENERATES TEST DATA
app.get('/dummy', function(req, res) {
    res.render(config.TEMPL_QUIZ_ADMIN);
    /*quiz.getResults('529231a32cf795b844000001', function (err, results) {
        console.log('FINAL RESULTS...');
        console.log(results);
        res.render(config.TEMPL_QUIZ_END, { results: results });
    });*/
    /*quiz.findUserQuestionsForToday('529231a32cf795b844000001', function(err, count){
        res.render(config.TEMPL_QUIZ_START, {
            allowed_time: 15,
            question_index: 1,
            question_total: 10,
            question: {"date" : Date("2013-04-04T10:30:00.000Z"),"title" : "Lorem ipsum dolor sit amet, consectetur adipisicing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.","choices" : {"1" : {"choice_text" : "h121aha"},"2" : {"choice_text" : "he1212he"},"3" : {"choice_text" : "hahhaahhahahha"}}, "answer" : 1 }
        });
    });*/
    /*var new_question = {
        "title" : "and old question?",
        "image" : "/tmp/xsadsa.png",
        "choices" : {
                1 : {
                    "choice_text" : "h121aha"
                },
                2 : {
                    "choice_text" : "he1212he"
                },
                3 : {
                    "choice_text" : "hahhaahhahahha"
                }
            },
        "answer": 1
    };*/

    /*var history = {
        "date" : new Date(),
        "user_id" : "533d051f2566971015a8eb0f",
        "question_id" : "533d4214bb4dc234408e0057",
        "choice_id" : 1,
        "response_time" : 5
    };*/

    /*Question.create(new_question, function(err, count){
        if (err) throw err;
        res.send('updated ' + count + ' records.');*/
        /*QuizHistory.create(history, function(err, count){
            if (err) throw err;
            res.send('updated ' + count + ' records.');
        });*/
    /*});*/
});

app.get(config.URL.QUIZ_START, requiredAuthentication, quiz.timeCheck, function(req, res) {
    quiz.findUserQuestionsForToday(req.session.user._id, function (err, count) {
            quiz.findNextQuestion(count, function (err, question, allowed_time) {
                if(err && err.message == config.ERR_QUIZ_NOQUIZTODAY) {
                    res.redirect(config.URL.QUIZ_NOQUIZ);
                }
                if (question !== null) {
                    //Save answer with answer -1 to mark that the user has seen this question
                    quiz.saveAnswer(req.session.user._id, question._id, '-1', '-1', function (err, record) {
                        req.session.question_id = question._id;
                        req.session.question_render_time = new Date();
                        console.log('rendering question page...');
                        res.render(config.TEMPL_QUIZ_START, {
                            question: question,
                            question_index: count + 1,
                            question_total: 10,//TO-DO: figure out how to get this from DB!!!
                            allowed_time: allowed_time,
                            image: question.image
                        });
                    });
                } else {
                    console.log('no more questions for todays quiz!');
                    //TO-DO: show a quiz completion page with results.
                    res.render(config.TEMPL_QUIZ_END);
                }
            });
    });
});

app.post(config.URL.QUIZ_START, function (req, res) {
    var response_time = (new Date() - req.session.question_render_time.toString().date()) / 1000;
    var answer_choice = req.body.choice;
    quiz.saveAnswer(req.session.user._id, req.session.question_id, answer_choice, response_time, function (err, record) {
        console.log('answer saved on POST was...');
        console.log(record);
        console.log('redirecting back to original url, simulating a refresh...');
        console.log(req.originalUrl);
        res.redirect(req.originalUrl);
    });
});

app.get(config.URL.MAIN, function (req, res) {
    if (req.session.user) {
        res.redirect(config.URL.QUIZ_MAIN);
    } else {
        res.render(config.TEMPL_LOGIN, { tab: 'login' });
    }
});

app.get(config.URL.SIGNUP, function (req, res) {
    console.log('in URL_SIGNUP GET NOW...');
    if (req.session.user) {
        res.redirect(config.URL.MAIN);
    } else {
        res.render(config.TEMPL_LOGIN, { tab: 'signup' });
    }
});

app.post(config.URL.SIGNUP, userExist, function (req, res) {
    console.log(req.body);
    var username = req.body.username;
    var password = req.body.password;
    var password1 = req.body.password1;
    var security_question = req.body.security_question;
    var security_answer = req.body.security_answer;
    console.log('in URL_SIGNUP POST NOW...');
    console.log(username, '----', password, '----', password1);
    //TO-DO: validate all these^^^ fields first

    isUsernameValid(username, function (err, valid) {
        if (err) throw err;
        if (!valid) {
            hash(password, function (err, salt, hash) {
                if (err) throw err;
                var user = new models.User({
                    username: username,
                    salt: salt,
                    hash: hash,
                    security_question: security_question,
                    security_answer: security_answer
                }).save(function (err, newUser) {
                    if (err) throw err;
                    console.log('calling encrypt now...');

                    var encrypt = require('./utils/pass').encrypt;
                    encrypt(username, function (err, activate_key) {
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

                    /*authenticate(newUser.username, password, function (err, user) {
                        if(user) {
                            req.session.regenerate(function () {
                                req.session.user = user;
                                req.session.success = 'Authenticated as ' + user.username + ' click to <a href="/logout">logout</a>. ' + ' You may now access <a href="/restricted">/restricted</a>.';
                                res.redirect(config.URL.MAIN);
                            });
                        }
                    });*/
                });
            });
        } else {
            console.log('dei you\'re already registered');
            req.session.error = config.ERR_SIGNUP_ALREADY_EXISTS;
            res.redirect(config.URL.SIGNUP);
        }
    });
});

app.post(config.URL.FORGOT, function (req, res) {
    var username = req.body.username;
    var security_question = req.body.security_question;
    var security_answer = req.body.security_answer;
    console.log('in POST of /forgot now... for user - ', username);
    isUsernameValid(username, function (err, valid) {
        if (err) throw err;
        if (valid) {
            console.log('valid user alright. now to reset your password....');
            var domain = req.protocol + '://' + req.get('host');
            var ip = req.headers['x-forwarded-for'] ||
                        req.connection.remoteAddress ||
                        req.socket.remoteAddress ||
                        req.connection.socket.remoteAddress;
            var user_cookie = req.cookies.last_user;
            resetPassword(username, security_question, security_answer, domain, ip, user_cookie, function (err, new_password) {
                if (err && err.message == config.ERR_RESET_INVALID_DETAILS) {
                    req.session.error = err.message;
                    res.redirect(config.URL.FORGOT);
                } else if (err) {
                    throw err;
                }
                console.log('reset done in DB. new password = ', new_password);
                res.render(config.TEMPL_200, {
                        message_title: 'Done!',
                        message_1: 'We\'ve sent you an email with your new password!',
                        message_2: 'Check your mailbox yo!'
                    });
            });

        } else {
            req.session.error = config.ERR_RESET_INVALID_USERNAME;
            res.redirect(config.URL.FORGOT);
        }
    });
});

app.post(config.URL.LOGIN, function (req, res) {
    authenticate(req.body.username, req.body.password, function (err, user) {
        if (user) {
            req.session.regenerate(function () {
                req.session.user = user;
                req.session.is_admin = user.admin;
                console.log(req.session.user);
                req.session.success = 'Authenticated as ' + user.username + ' click to <a href="/logout">logout</a>. ' +
                                      ' You may now access <a href="/restricted">/restricted</a>.';
                res.redirect(config.URL.QUIZ_MAIN);
            });
        } else {
            req.session.error = 'Authentication failed, please check your username and password.';
            res.redirect(config.URL.LOGIN);
        }
    });
});

app.get('/activate/:activate_key', function (req, res) {
    console.log('in GET of /activate now...');
    var decrypt = require('./utils/pass').decrypt;
    decrypt(req.params.activate_key, function (err, username) {
        if (err) {
            req.session.error = '... but not really. Looks like your activation key is invalid.' +
                            'Either you\'re trying to break into someone else\'s account (which is really lame) ' +
                            'or.. nope. You\'re lame.';
            throw err;
        }
        console.log('decrypted username - ', username);
        activateUser(username, function (err, count) {
                if (err) {
                    console.log(err);
                    console.log('activation -> error caught in activateUser() function!');
                    req.session.error = 'User no longer exists!';
                    throw err;
                }
                console.log('activateUser - return value - ', count);
                if(count == 1){
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
                }//handle other cases, should I?
        });
    });
});

app.get(config.URL.LOGOUT, function (req, res) {
    req.session.destroy(function () {
        res.redirect(config.URL.MAIN);
    });
});

app.get(config.URL.FORGOT, function (req, res) {
    res.render(config.TEMPL_LOGIN, { tab: 'forgot' });
});

app.get(config.URL.TIMECLOSED, requiredAuthentication, function (req, res) {
    res.render(config.TEMPL_TIMECLOSED, { start_hour: config.QUIZ_START_TIME[0], stop_hour: config.QUIZ_STOP_TIME[0]});
});

app.get(config.URL.QUIZ_NOQUIZ, requiredAuthentication, function (req, res) {
    res.render(config.TEMPL_QUIZ_NOQUIZ);
});

app.get(config.URL.LOGIN, function (req, res) {
     res.render(config.TEMPL_LOGIN, { tab: 'login' });
});

app.get(config.URL.QUIZ_MAIN, requiredAuthentication, function (req, res) {
    var template = (req.session.is_admin) ? config.TEMPL_QUIZ_ADMIN : config.TEMPL_QUIZ_MAIN;
    res.render(template, {'username': req.session.user.username});
});

/**
 * Error handling.
 */

//Use Express' built-in 500 handler.
//app.use(express.errorHandler({ showStack: true, dumpExceptions: true }));

//Use our custom 500 handler.
app.use(errorHandler);

//404 handler.
app.use(function(req, res, next){
    res.status(404);
    res.render(config.TEMPL_400, { url: req.url });
    return;
});

process.on('uncaughtException', function(err) {
    logger.log('error', 'UNCAUGHT EXCEPTION', err.stack);
});

/**
 * Run the app!
 */

http.createServer(app).listen(config.APP_PORT, function () {
  console.log('NodeJS Express server listening on port [' + config.APP_PORT + ']');
});