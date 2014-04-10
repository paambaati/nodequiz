/**
 * Quiz statistics & ranking utilities.
 * Authors: GP.
 * Version: 1.1
 * Release Date: 10-Apr-2014
 */

/**
 * Module dependencies.
 */

var async = require('async'),
    config = require('../config/config'),
    models = require('../models'),
    misc = require('../utils/misc'),
    quiz = require('../utils/quiz');

/**
 * Gets the username from the user's unique _id.
 *
 * @param {Function} callback.
 * @api private
 */

function getUsernameFromId(user_id, fn) {
    models.User.findOne({
        _id: user_id
    }, function(err, user) {
        return fn(null, user.username);
    });
}

/**
 * Gets the total number of questions in today's quiz.
 *
 * @param {Function} callback.
 * @api private
 */

function getDailyQuestionsCount(fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var query = {
        date: {
            $gte: start_day
        }
    };
    models.Question.count(query, function(err, count) {
        return fn(null, count);
    });
}

/**
 * Gets all unique users who've attended today's quiz.
 *
 * @param {Function} callback.
 * @api public
 */

function getDailyAttendees(fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var query = {
        date: {
            $gte: start_day
        }
    };
    models.QuizHistory.count(query).distinct('user_id', function(err, count) {
        return fn(null, count);
    });
};

/**
 * Gets the day's average score.
 *
 * @param {Function} callback.
 * @api public
 */

function getDailyAverageScore(fn) {
    var user_points = 0,
        today = new Date().setHours(0, 0, 0, 0);
    getDailyQuestionsCount(function(err, count) {
        getDailyAttendees(function(err, results) {
            async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, today, function(err, results) {
                    user_points += results.total_points;
                    return callback();
                });
            }, function() {
                return fn(null, user_points / results.length);
            });
        });
    });
};

/**
 * Gets the day's total number of perfect scores.
 *
 * @param {Function} callback.
 * @api public
 */

function getDailyPerfectScoresCount(fn) {
    var result_count = 0,
        today = new Date().setHours(0, 0, 0, 0);;
    getDailyAttendees(function(err, results) {
        async.eachSeries(results, function(item, callback) {
            quiz.getResults(item, today, function(err, results) {
                if (results['total_points'] == results['total_questions']) {
                    result_count++;
                }
                return callback();
            });
        }, function() {
            return fn(null, result_count);
        });
    });
}

/**
 * Gets the day's quickest quiz.
 * This function makes sure we pick a user's record for calculating total response time only
 * when the user has taken all questions.
 *
 * @param {Function} callback.
 * @api public
 */

function getDailyQuickestQuiz(fn) {
    var final_result = 0,
        today = new Date().setHours(0, 0, 0, 0);
    getDailyAttendees(function(err, results) {
        async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, today, function(err, results) {
                    if (results['total_points'] == results['total_questions']) {
                        async.eachSeries(results, function(time_item, callback) {
                            final_result += time_item['response_time'];
                            callback();
                        });
                    }
                    return callback();
                });
            },
            function() {
                return fn(null, final_result);
            });
    });
}

/**
 * Gets the top 5 scorers for the specified time period.
 *
 * @param {String} time period for which the data is required. Allowed values are 'weekly', 'monthly', 'alltime'.
 * @param {Function} callback.
 * @api public
 */

function getTop5(time_period, fn) {
    var start_day = new Date(),
        userscore_map = {},
        final_rankings = [],
        sorted_ranks = [];
    switch (time_period) {
        case 'weekly':
            misc.getMonday(function(err, result) {
                start_day = result;
            });
            break;
        case 'monthly':
            start_day = new Date(start_day.getFullYear(), start_day.getMonth(), 1);
            break;
        case 'alltime':
            start_day = null;
            break;
        default:
            start_day = null;
            break;
    }
    if (start_day) {
        start_day.setHours(0, 0, 0, 0);
    }
    var query = (start_day) ? {
        date: {
            $gte: start_day
        }
    } : {};
    models.QuizHistory.find(query).distinct('user_id', function(err, results) {
        async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, start_day, function(err, results) {
                    if (results != null) {
                        getUsernameFromId(item, function(err, username) {
                            var points = results['total_points'];
                            var rtime = results['avg_response_time'];
                            if (userscore_map[points]) {
                                userscore_map[points] = [userscore_map[points],
                                    [username, rtime]
                                ];
                            } else {
                                userscore_map[points] = [username, rtime]
                            }
                            return callback();
                        });
                    } else {
                        return callback();
                    }
                });
            },
            function() {
                console.log(userscore_map);
                //Fookin' ugly dict-sorting logic.
                for (var key in userscore_map) {
                    sorted_ranks[sorted_ranks.length] = key;
                }
                sorted_ranks.sort();
                sorted_ranks.reverse();
                sorted_ranks = sorted_ranks.slice(0, 5);
                for (var i = 0; i < sorted_ranks.length; i++) {
                    final_rankings.push([sorted_ranks[i], userscore_map[sorted_ranks[i]]]);
                }
                return fn(null, final_rankings);
            });
    });
}

/**
 * Module exports.
 */

module.exports = {
    getDailyAttendees: getDailyAttendees,
    getDailyAverageScore: getDailyAverageScore,
    getDailyPerfectScoresCount: getDailyPerfectScoresCount,
    getDailyQuickestQuiz: getDailyQuickestQuiz,
    getTop5: getTop5
}