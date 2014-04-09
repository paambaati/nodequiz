
/**
 * Miscellaneous utilities.
 * Authors: GP.
 * Version: 1.0
 * Release Date: 05-Apr-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config');

/**
 * Counts number of words in a given string and returns
 * the optimal allowed time (in seconds) to read it.
 *
 * Average words PPM can be changed in config.
 *
 * @param {String} string to calculate allowed time for.
 * @param {Function} callback.
 * @api public
 */

var getAllowedTime = function(text, fn) {
    try {
        text = text.replace(/(^\s*)|(\s*$)/gi,''); //exclude  start and end white-space
        text = text.replace(/[ ]{2,}/gi,' '); //2 or more space to 1
        text = text.replace(/\n /,'\n'); //exclude newline with a start spacing
        var word_count = text.split(' ').length;
        var allowed_time = (word_count * 60) / config.MISC_AVG_WORDS_PPM;
        allowed_time = (allowed_time <= 10) ? config.MISC_DEFAULT_ALLOWED_QUESTION_TIME : Math.round(allowed_time);
        fn(null, allowed_time);
    } catch (err) {
        fn(null, config.MISC_DEFAULT_ALLOWED_QUESTION_TIME);
    }
}

/**
 * Gets starting day of this week and returns a Date() object for that day.
 *
 * @param {Function} callback.
 * @api public
 */

function getMonday(fn) {
    var today = new Date();
    var day = today.getDay(),
        diff = today.getDate() - day + (day == 0 ? -6:1); // adjust when day is sunday
    return fn(null, new Date(today.setDate(diff)));
}

/**
 * Module exports.
 */

module.exports = {
  getAllowedTime: getAllowedTime,
  getMonday: getMonday
}