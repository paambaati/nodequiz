/**
 * Error handler routes.
 * NOTE: Make sure this is the LAST route added.
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

    /**
     * Custom 500 page handler.
     * (Needs to be the penultimate route)
     *
     * @param {Error} full error.
     * @param {Request} request.
     * @param {Response} response.
     * @param {Boolean} allow to move to next middleware.
     */

    app.use(function(err, req, res, next) {
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
    });

    /**
     * Custom 404 page handler.
     * (Needs to be the very last route)
     *
     * @param {Error} full error.
     * @param {Request} request.
     * @param {Response} response.
     * @param {Boolean} allow to move to next middleware.
     */

    app.use(function(req, res, next) {
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
    });
}