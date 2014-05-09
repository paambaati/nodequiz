/**
 * Miscellaneous utilities.
 * Author: GP.
 * Version: 1.4
 * Release Date: 09-May-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config');

/**
 * Find max of a 2D array by column.
 * A dict needs to be passed to this function, of the form
 * dict = {
 *          'key1': [[..],[..],...],
 *          'key2': [[..],[..],...],
 *          ...
 * }
 *
 * @param {String} 'max' or 'min'.
 * @param {Object} dictionary of arrays to be sorted.
 * @param {Number} column in array based on which max/min needs to be calculated.
 * @param {Function} callback.
 * @api public
 */

var getMaxOrMinofArray = function(maxormin, array_dict, column, fn) {
    var array = Object.keys(array_dict).map(function(key) {
        return array_dict[key];
    });
    var max = array.reduce(function(previousVal, currentItem, array, arr) {
        if (maxormin == 'max') {
            return Math.max(previousVal, currentItem[column]);
        } else {
            return Math.min(previousVal, currentItem[column]);
        }
    }, Number.NEGATIVE_INFINITY);

    fn(null, array.filter(function(i) {
        return (null, i[1] == max);
    }));
}

/**
 * Gets starting day of this week and returns a Date() object for that day.
 *
 * @param {Function} callback.
 * @api public
 */

var getMonday = function(fn) {
    var today = new Date();
    var day = today.getDay(),
        diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
    fn(null, new Date(today.setDate(diff)));
}

/**
 * Validates signup form.
 *
 * @param {Object} JSON object of request body.
 * @param {Function} callback.
 * @api public
 */

var validateSignUpForm = function(request_body, fn) {
    var username = request_body.username;
    var password = request_body.first_password;
    var password1 = request_body.second_password;
    var security_question = request_body.security_question;
    var security_answer = request_body.security_answer;

    if (username && password && password1 && security_question && security_answer) {
        if (password === password1) {
            return fn(null, true);
        } else {
            return fn(config.ERR_SIGNUP_PASSWORD_MISMATCH, false);
        }
    } else {
        return fn(config.ERR_SIGNUP_DATA_MISSING, false);
    }
}

/**
 * Sanitizes text to counter XSS, by stripping out HTML tags and problematic delimiters.
 *
 * @param {String} Text to clean.
 * @api public
 */

var sanitizeText = function(input_text, fn) {
    input_text = input_text.replace(/&/g, '&amp;').
    replace(/</g, '&lt;'). // it's not neccessary to escape >
    replace(/"/g, '&quot;').
    replace(/'/g, '&#039;');
    return fn(input_text);
}

/**
 * Custom sort comparator for use with Array.sort()
 * Sorts an array of the form -
 * [
 *      [1, x, 2],
 *      [3, y, 4],
 *      [...], ...
 * ]
 *
 * by 1st item first, then if they tie, by the 3rd item second.
 *
 * @param {Object} First array.
 * @param {Object} Second array.
 * @api public
 */

var rankByScoreAndResTime = function (a,b) {
  if (a[0] < b[0])
     return 1;
  if (a[0] > b[0])
    return -1;
  if(a[0]==b[0])
  {
  if (a[2] < b[2])
     return -1;
  if (a[2] > b[2])
    return 1;
  return 0;
  }
}

/**
 * Module exports.
 */

module.exports = {
    getMaxOrMinofArray: getMaxOrMinofArray,
    getMonday: getMonday,
    validateSignUpForm: validateSignUpForm,
    sanitizeText: sanitizeText,
    rankByScoreAndResTime: rankByScoreAndResTime
}