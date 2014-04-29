/**
 * TheQuiz
 * Author: GP.
 * Version: 1.8
 * Release Date: 29-Apr-2014
 */

/**
 * Main app dependencies.
 */

var express = require('express'),
    http = require('http'),
    bodyparser = require('body-parser'),
    methodoverride = require('method-override'),
    cookieparser = require('cookie-parser'),
    session = require('express-session'),
    morgan = require('morgan'),
    path = require('path'),
    swig = require('swig'),
    mongoose = require('mongoose'),
    mongostore = require('connect-mongo')({
        session: session
    }),
    config = require('./config/config');

var app = express();

/**
 * Middleware.
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
 * Routes
 */

require('./routes/user')(app);
require('./routes/quiz')(app);

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