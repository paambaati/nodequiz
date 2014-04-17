/**
 * Email utilities.
 * Author: GP.
 * Version: 1.2
 * Release Date: 17-Apr-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    nodemailer = require('nodemailer'),
    swig = require('swig');

// SMTP transport for debugging. Not sure if I should be distributing this.
var transport = nodemailer.createTransport('SMTP', {
    service: 'Gmail',
    auth: {
        XOAuth2: {
            user: 'exchequer598@gmail.com',
            clientId: '1097162541020.apps.googleusercontent.com',
            clientSecret: '6ea8NmVKD7zUa6obgc8HCzps',
            refreshToken: '1/luLonngmJ5wnWvfUYwSSuuTOUlKIsKrTPWTVMk08zbg'
        }
    }
});

// SMTP transport object.
var transport = nodemailer.createTransport('SMTP', {
    host: config.MAIL_HOST,
    port: config.MAIL_PORT,
    secureConnection: config.MAIL_SECURE,
    ignoreTLS: !config.MAIL_USE_TLS,
    debug: config.MAIL_DEBUG,
    auth: {
        user: config.MAIL_USERNAME,
        pass: config.MAIL_PASSWORD
    }
});

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
    var activation_link = domain + config.URL.ACTIVATE + '/' + activate_key;
    activation_link = (domain.lastIndexOf('http://') !== 0) ? 'http://' + activation_link : activation_link;
    var message = {
        from: config.MAIL_SENDER,
        to: username + config.MAIL_USER_DOMAIN,
        subject: '» ' + config.APP_TITLE + ' - Activate your Account',
        attachments: [{
            filename: 'logo.png',
            filePath: config.MAIL_LOGO,
            cid: 'app_logo'
        }],
        html: swig.renderFile(config.MAIL_TEMPLATE, {
            app_title: config.APP_TITLE,
            main_link: 'http://' + domain,
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
    var reset_link = domain + config.URL.RESET + '/' + reset_key;
    reset_link = (domain.lastIndexOf('http://') !== 0) ? 'http://' + reset_link : reset_link;
    var shame = (user_cookie === undefined) ? '' : ' by user ' + user_cookie;
    var message = {
        from: config.MAIL_SENDER,
        to: username + config.MAIL_USER_DOMAIN,
        subject: '» ' + config.APP_TITLE + ' - Reset Your Password',
        attachments: [{
            filename: 'logo.png',
            filePath: config.MAIL_LOGO,
            cid: 'app_logo'
        }],
        html: swig.renderFile(config.MAIL_TEMPLATE, {
            app_title: config.APP_TITLE,
            main_link: 'http://' + domain,
            mail_mode: 'reset_password',
            reset_link: 'http://' + domain + config.URL.RESET + '/' + reset_key,
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