
/**
 * Configuration.
 */

var config = {};

//App configuration.
config.APP_PORT = 3000;

//Basic URL configuration.
config.URL_MAIN = '/';
config.URL_LOGIN = '/login';
config.URL_SIGNUP = '/signup';
config.URL_FORGOT = '/forgot';
config.URL_LOGOUT = '/logout';
config.URL_QUIZ_MAIN = '/quiz';

//Basic template configuration.
config.TEMPL_LOGIN = 'login.html';
config.TEMPL_500 = '500.html';
config.TEMPL_400 = '404.html';
config.TEMPL_200 = '200.html';
config.TEMPL_QUIZ_MAIN = 'quiz.html';

//Database configuration.
config.DB_HOST = '127.0.0.1';
config.DB_PORT = 27017;
config.DB_NAME = 'quiz_db';
config.DB_AUTH_TABLE = 'quiz_users';
config.DB_MONGO_CONNECT_STRING = 'mongodb://' + config.DB_HOST + ':' + config.DB_PORT + '/' + config.DB_NAME;

//Mail configuration.
config.MAIL_HOST = 'smtp.mailgun.org';
config.MAIL_PORT = 587;
config.MAIL_SECURE = true;
config.MAIL_USERNAME = 'postmaster@inversekarma.in';
config.MAIL_PASWORD = '1t0p-nn-yw17';

//Logging configuration.
config.LOG_FILENAME = './logs/app_log.txt'
logger = require('winston');
logger.add(logger.transports.File, {
    filename: config.LOG_FILENAME,
    handleExceptions: true,
    exitOnError: false,
    json: false,
    colorize: false,
    timestamp: true
});

//Error messages.
config.ERR_AUTH_INVALID_USERNAME = 'Username is invalid!';
config.ERR_AUTH_INVALID_PASSWORD = 'Invalid password!';
config.ERR_AUTH_NOT_LOGGED_IN = 'You must be logged in to view that page!';
config.ERR_SIGNUP_ALREADY_EXISTS = 'Username already exists!';
config.ERR_ACTIVATION_INVALID_KEY = 'Username mapped to activation key is invalid!';
config.ERR_RESET_INVALID_DETAILS = 'One of the values entered is incorrect!';
config.ERR_RESET_INVALID_USERNAME = 'Username not valid. Looks like you forgot your username as well!';

//Crypto configuration.
config.MASTER_SALT = 'cycle la illayam kaathu ernakulathula illayam vaathu';

module.exports = config;