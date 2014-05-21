/**
 * Middleware routes.
 * Author: GP.
 * Version: 1.1.2
 * Release Date: 21-May-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    getUnreadFeedbackCount = require('../utils/user').getUnreadFeedbackCount;

/*
 * Module exports.
 */

module.exports = function(app) {
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
        res.locals.APP_TITLE = config.APP_TITLE;
        res.locals.URL = config.URL;
        res.locals.USERNAME = (req.session.user) ? req.session.user.username : '';
        res.locals.IS_LDAP = config.AUTH_USE_LDAP;
        res.locals.UPLOAD_DIR = config.UPLOAD_DIR;
        res.locals.IS_ADMIN = (req.session.is_admin) ? true : false;
        res.locals.COMPANY_SHORT_NAME = config.COMPANY_SHORT_NAME;
        res.locals.MAIL_USER_DOMAIN = config.MAIL_USER_DOMAIN;
        res.locals.SECURITY_QUESTIONS = config.SECURITY_QUESTIONS;
        res.locals.IE_START_URL = config.IE_START_URL;
        res.locals.IE_FAVICON_URL = config.IE_FAVICON_URL;
        res.locals.IE_FAQ_URL = config.IE_FAQ_URL;
        next();
    });

    // Admin middleware.
    app.use(config.URL.QUIZ_ADMIN, function(req, res, next) {
        getUnreadFeedbackCount(req.session.last_seen, function(err, unread_count) {
            res.locals.FEEDBACK_UNREAD = unread_count;
            next();
        });
    })
}