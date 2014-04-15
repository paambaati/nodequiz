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
    nodemailer = require('nodemailer');

// SMTP transport object.
var transport = nodemailer.createTransport("SMTP", {
    host: config.MAIL_HOST,
    port: config.MAIL_PORT,
    secureConnection: config.MAIL_SECURE,
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
        from: 'Quiz Master <quiz@global-analytics.com>',
        to: username + '@global-analytics.com',
        subject: '» Activate your GA Quiz Account',
        html: '<h1>jhasjd</h1>',
        text: 'Click to activate this link - ' + domain + '/activate/' + activate_key
    };
    console.log(message.text);
    transport.sendMail(message, function(err, response) {
        if (err) {
            console.log('Email not sent!');
            console.log(err);
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
        from: 'Quiz Master <quiz@global-analytics.com>',
        to: username + '@global-analytics.com',
        subject: '» Your GA Quiz Account\'s New Password',
        html: 'Your password was reset from IP ' + ip + shame,
        text: 'Your reset key is - ' + reset_key +
            '   Click to reset - ' + domain + config.URL.RESET + '/' + reset_key
    };
    console.log(message.html);
    console.log(message.text);
    transport.sendMail(message, function(err, response) {
        if (err) {
            logger.log('error', 'CRITICAL ERROR! EMAIL NOT SENT', {
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