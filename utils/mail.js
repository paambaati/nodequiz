/**
 * Email utilities.
 * Author: GP.
 * Version: 1.1
 * Release Date: 07-Apr-2014
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
    debug: true,
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
            activation_link: 'http://' + domain + config.URL.ACTIVATE + '/' + activate_key
        })
    };
    transport.sendMail(message, function(err, response) {
        if (err) {
            logger.log('error', 'CRITICAL ERROR! USERNAME ACTIVATION EMAIL NOT SENT', {
                'username': message.to,
                'activate_key': activate_key,
                'stack': err.stack
            });
        } else {
            console.log('Message sent!');
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
            logger.log('error', 'CRITICAL ERROR! PASSWORD RESET EMAIL NOT SENT', {
                'username': message.to,
                'reset_key': reset_key,
                'ip': ip,
                'user_cookie': user_cookie,
                'stack': err.stack
            });
        } else {
            console.log('Message sent!');
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