/**
 * Email utilities.
 * Author: GP.
 * Version: 1.2.2
 * Release Date: 20-May-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    nodemailer = require('nodemailer'),
    swig = require('swig');

/**
 * Common variables.
 */

// SMTP transport object.
var mail_options = {
    host: config.MAIL_HOST,
    debug: config.MAIL_DEBUG
}

if (!config.DB_SERVER_NOAUTH) {
    mail_options[port] = config.MAIL_PORT;
    mail_options[secureConnection] = config.MAIL_SECURE;
    mail_options[ignoreTLS] = !config.MAIL_USE_TLS;
    mail_options[auth] = {
        user: config.MAIL_USERNAME,
        pass: config.MAIL_PASSWORD
    }
}
var transport = nodemailer.createTransport('SMTP', mail_options);

//Mailer logo.
var attachment = [{
    filename: config.MAIL_LOGO.substring(config.MAIL_LOGO.lastIndexOf('/') + 1, config.MAIL_LOGO.length),
    filePath: config.MAIL_LOGO,
    cid: 'app_logo'
}];

/**
 * Sends an email with the activation link to `username`.
 *
 * @param {String} domain on which our app is running.
 * @param {String} username. `@global-analytics.com` is auto-appended.
 * @param {String} encrypted activation key.
 * @param {Error} error trace.
 * @api public
 */

var sendActivationLink = function(domain, username, activate_key, err) {
    domain = (domain.lastIndexOf('http://') !== 0) ? 'http://' + domain : domain;
    domain = (domain.substr(-1) == '/') ? domain + '/' : domain;
    var activation_link = domain + config.URL.ACTIVATE + '/' + activate_key;
    var message = {
        from: config.MAIL_SENDER,
        to: username + config.MAIL_USER_DOMAIN,
        subject: '» ' + config.APP_TITLE + ' - Activate your Account',
        attachments: attachment,
        html: swig.renderFile(config.MAIL_TEMPLATE, {
            app_title: config.APP_TITLE,
            main_link: domain,
            faq_link: domain + config.URL.FAQ.slice(1),
            mail_mode: 'activation',
            activation_link: activation_link
        })
    };
    transport.sendMail(message, function(err, response) {
        if (err) {
            config.logger.error('ACTIVATION EMAIL - ACTIVATION EMAIL NOT SENT', {
                'username': message.to,
                'activate_key': activate_key,
                'stack': err.stack
            });
        } else {
            config.logger.info('ACTIVATION EMAIL - SUCCESSFULLY SENT', {
                'username': message.to,
                'activate_key': activate_key
            });
        }
    });
};

/**
 * Sends an email with the reset key to `username`.
 *
 * @param {String} domain on which our app is running.
 * @param {String} IP address from the request.
 * @param {String} value of last_user cookie.
 * @param {String} username. `@global-analytics.com` is auto-appended.
 * @param {String} reset key in plaintext.
 * @param {Error} error trace.
 * @api public
 */

var mailResetKey = function(domain, ip, user_cookie, username, reset_key, err) {
    domain = (domain.lastIndexOf('http://') !== 0) ? 'http://' + domain : domain;
    domain = (domain.substr(-1) == '/') ? domain + '/' : domain;
    var reset_link = domain + config.URL.RESET + '/' + reset_key;
    var shame = (user_cookie === undefined) ? '' : ' by user ' + user_cookie;
    var message = {
        from: config.MAIL_SENDER,
        to: username + config.MAIL_USER_DOMAIN,
        subject: '» ' + config.APP_TITLE + ' - Reset Your Password',
        attachments: attachment,
        html: swig.renderFile(config.MAIL_TEMPLATE, {
            app_title: config.APP_TITLE,
            main_link: domain,
            faq_link: domain + config.URL.FAQ.slice(1),
            mail_mode: 'reset_password',
            reset_link: reset_link,
            validity_period: config.RESET_VALIDITY,
            ip_address: ip,
            shame_name: shame
        })
    };
    transport.sendMail(message, function(err, response) {
        if (err) {
            config.logger.error('RESET EMAIL - PASSWORD RESET EMAIL NOT SENT', {
                'username': message.to,
                'reset_key': reset_key,
                'ip': ip,
                'user_cookie': user_cookie,
                'stack': err.stack
            });
        } else {
            config.logger.info('RESET EMAIL - SUCCESSFULLY SENT', {
                'username': message.to,
                'reset_key': reset_key
            });
        }
    });
};

/**
 * Module exports.
 */

module.exports = {
    sendActivationLink: sendActivationLink,
    mailResetKey: mailResetKey
}
