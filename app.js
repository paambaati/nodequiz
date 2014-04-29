/**
 * TheQuiz
 * Author: GP.
 * Version: 1.8.1
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
 * Settings.
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

/**
 * Routes
 */

require('./routes/middleware')(app);
require('./routes/user')(app);
require('./routes/quiz')(app);

/**
 * Error handling.
 */

/**
 * Custom 500 page handler.
 *
 * @param {Error} full error.
 * @param {Request} request.
 * @param {Response} response.
 * @param {Boolean} allow to move to next middleware.
 */

function errorHandler500(err, req, res, next) {
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
 * Custom 404 page handler.
 *
 * @param {Error} full error.
 * @param {Request} request.
 * @param {Response} response.
 * @param {Boolean} allow to move to next middleware.
 */

function errorHandler404(req, res, next) {
    config.logger.error('404 - PAGE NOT FOUND', {
        username: (req.session.user) ? req.session.user.username : 'AnonymousUser',
        accessed_url: req.originalUrl,
        referer_url: req.headers.referer
    });
    res.status(404);
    res.render(config.TEMPL_400, {
        url: req.url
    });
    return;
}

//Use our custom 500 handler.
app.use(errorHandler500);

//404 handler.
app.use(errorHandler404);

/**
 * Run the app!
 */

app.listen(config.APP_PORT, function() {
    config.logger.info('START - NodeJS Express server started listening on port [' + config.APP_PORT + ']');
});