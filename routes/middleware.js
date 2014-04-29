/**
 * Middleware routes.
 * Author: GP.
 * Version: 1.0
 * Release Date: 29-Apr-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config');

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
        res.locals.app_title = config.APP_TITLE;
        res.locals.URL = config.URL;
        res.locals.username = (req.session.user) ? req.session.user.username : '';
        res.locals.UPLOAD_DIR = config.UPLOAD_DIR;
        res.locals.IS_ADMIN = (req.session.is_admin) ? true : false;
        res.locals.COMPANY_SHORT_NAME = config.COMPANY_SHORT_NAME;
        res.locals.MAIL_USER_DOMAIN = config.MAIL_USER_DOMAIN;
        next();
    });
}