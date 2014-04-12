/**
 * Miscellaneous utilities.
 * Authors: GP.
 * Version: 1.1
 * Release Date: 12-Apr-2014
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

/*
 * Counts number of words in a given string and returns
 * the optimal allowed time( in seconds) to read it.
 * Average words PPM can be changed in config.
 * @param {String} string to calculate allowed time for.
 * @param {Function} callback.
 * @api public
 */

var getAllowedTime = function(text, fn) {
    try {
        text = text.replace(/ ( ^ \s * ) | (\s * $) /gi, ''); //exclude  start and end white-space
        text = text.replace(/[ ]{2,}/gi, ' '); //2 or more space to 1
        text = text.replace(/\n /, '\n'); //exclude newline with a start spacing
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
            diff = today.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        return fn(null, new Date(today.setDate(diff)));
    }

    /**
     * Module exports.
     */

module.exports = {
    getMaxOrMinofArray: getMaxOrMinofArray,
    getAllowedTime: getAllowedTime,
    getMonday: getMonday
}