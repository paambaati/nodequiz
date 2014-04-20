/**
 * Configuration.
 */

//Module dependencies.
var path = require('path'),
    logger = require('winston');

var config = {};

//Logging configuration.
config.LOG_FILENAME = './logs/app_log.txt';
logger.add(logger.transports.File, {
    filename: config.LOG_FILENAME,
    handleExceptions: true,
    exitOnError: false,
    json: false,
    colorize: false,
    timestamp: true
});
config.logger = logger;

//App configuration.
config.APP_TITLE = 'TheQuiz';
config.APP_PORT = 3000;
config.APP_BASE_PATH = process.env.PWD;

//Basic URL configuration.
config.URL = {
    MAIN: '/',
    LOGIN: '/login',
    SIGNUP: '/signup',
    FORGOT: '/forgot',
    RESET: '/reset',
    ACTIVATE: '/activate',
    LOGOUT: '/logout',
    TIMECLOSED: '/timeclosed',
    QUIZ_MAIN: '/quiz',
    QUIZ_ADMIN: '/quiz/admin',
    QUIZ_START: '/quiz/start',
    QUIZ_NOQUIZ: '/quiz/noquiz',
    QUIZ_STANDINGS: '/quiz/standings',
    QUIZ_STAT_AJAX: '/quiz/get',
    QUIZ_ADMIN_SAVE_AJAX: '/quiz/admin/save',
    QUIZ_ADMIN_SAVE_UPLOAD: '/quiz/admin/upload'
};

//Basic template configuration.
config.TEMPL_LOGIN = 'login.html';
config.TEMPL_RESET = 'reset.html';
config.TEMPL_500 = '500.html';
config.TEMPL_400 = '404.html';
config.TEMPL_200 = '200.html';
config.TEMPL_TIMECLOSED = 'timeclosed.html';
config.TEMPL_QUIZ_MAIN = 'quiz.html';
config.TEMPL_QUIZ_START = 'question.html';
config.TEMPL_QUIZ_END = 'completed.html';
config.TEMPL_QUIZ_NOQUIZ = 'noquiz.html';
config.TEMPL_QUIZ_ADMIN = 'admin.html';
config.TEMPL_QUIZ_STANDINGS = 'standings.html';

//Quiz configuration.
config.QUIZ_START_TIME = [14, 0];
config.QUIZ_STOP_TIME = [16, 0];

//Database configuration.
config.DB_HOST = '127.0.0.1';
config.DB_PORT = 27017;
config.DB_NAME = 'quiz_db';
config.DB_AUTH_TABLE = 'quiz_users';
config.DB_AUTH_SESSIONS = 'quiz_sessions';
config.DB_AUTH_PASSWORD_RESET = 'quiz_resets';
config.DB_QUESTIONS_TABLE = 'quiz_questions';
config.DB_QUIZ_HISTORY = 'quiz_history';
config.DB_MONGO_CONNECT_STRING = 'mongodb://' + config.DB_HOST + ':' + config.DB_PORT + '/' + config.DB_NAME;

//Mail configuration.
config.MAIL_DEBUG = false;
config.MAIL_HOST = 'smtp.mailgun.org';
config.MAIL_PORT = 587;
config.MAIL_SECURE = false;
config.MAIL_USE_TLS = true;
config.MAIL_USERNAME = 'postmaster@inversekarma.in';
config.MAIL_PASSWORD = '1t0p-nn-yw17';
config.MAIL_SENDER = 'Quiz Master <quiz@global-analytics.com>';
config.MAIL_USER_DOMAIN = '@global-analytics.com';
config.MAIL_TEMPLATE = path.join(config.APP_BASE_PATH, './views/mailer.html');
config.MAIL_LOGO = path.join(config.APP_BASE_PATH, './public/images/logo.png');

//Error messages.
config.ERR_AUTH_FAILED = 'Authentication failed, please check your username and password.';
config.ERR_AUTH_INVALID_USERNAME = 'Username is invalid!';
config.ERR_AUTH_INVALID_PASSWORD = 'Invalid password!';
config.ERR_AUTH_NOT_LOGGED_IN = 'You must be logged in to view that page!';
config.ERR_AUTH_ACTIVATION_PENDING = 'You still haven\'t activated this account. Please check your mail!';
config.ERR_SIGNUP_ALREADY_EXISTS = 'Username already exists!';
config.ERR_ACTIVATION_INVALID_KEY = 'Username mapped to activation key is invalid!';
config.ERR_RESET_INVALID_DETAILS = 'One of the values entered is incorrect!';
config.ERR_RESET_INVALID_USERNAME = 'Username not valid. Looks like you forgot your username as well!';
config.ERR_QUIZ_NOQUIZTODAY = 'No quiz found in database';
config.ERR_ADMIN_NOQUESTIONFOUND = 'This question no longer exists in the database.';

//Crypto configuration.
config.MASTER_SALT = 'cycle la illayam kaathu ernakulathula illayam vaathu';
config.RESET_PASSWORD_SALT = 'loln00b';

//Miscellaneous configuration.
config.RESET_VALIDITY = 3; //Hours
config.MISC_AVG_WORDS_PPM = 180;
config.MISC_DEFAULT_ALLOWED_QUESTION_TIME = 10; //Seconds

//Uploads configuration.
config.UPLOAD_DIR = '/uploads/'; //Ensure this directory is inside app_dir/public/

module.exports = config;