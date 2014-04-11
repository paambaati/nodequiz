/**
 * Quiz statistics & ranking utilities.
 * Authors: GP.
 * Version: 1.2
 * Release Date: 11-Apr-2014
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
 * Gets the total number of users registered.
 *
 * @param {Function} callback.
 * @api public
 */

function getTotalUserCount(fn) {
    models.User.count(function(err, count) {
        return fn(null, count);
    })
}

/**
 * Gets all unique users who've attended today's quiz.
 *
 * @param {Function} callback.
 * @api private
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
 * @api private
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
                var avg_score = user_points / results.length;
                avg_score = isNaN(avg_score) ? 0 : avg_score;
                return fn(null, avg_score);
            });
        });
    });
};

/**
 * Gets the day's total number of perfect scores.
 *
 * @param {Function} callback.
 * @api private
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
 * @api private
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
        userscore_array = [];
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
                            userscore_array.push([results['total_points'], username, results['avg_response_time']]);
                            return callback();
                        });
                    } else {
                        return callback();
                    }
                });
            },
            function() {
                //First, we sort the rank by descending order of points.
                //Then, we take a slice of the array with the top 5 rank, NOT top 5 items.
                var rank_limit = 5,
                    counter = 1,
                    break_at = 0;
                userscore_array.sort().reverse();
                for (var i = 1; i < userscore_array.length; i++) {
                    counter = (userscore_array[i][0] == userscore_array[i - 1][0]) ? counter : counter + 1;
                    break_at = i + 1;
                    if (counter == rank_limit) break;
                }
                return fn(null, userscore_array.slice(0, break_at));
            });
    });
}

/**
 * Gets all basic daily stats.
 * Basically acts as a wrapper for these 5 methods.
 *
 * @param {Function} callback.
 * @api public
 */

function getAllDailyBasicStats(fn) {
    async.series({
            daily_attendees: function(callback) {
                getDailyAttendees(function(err, daily_attendees) {
                    callback(null, daily_attendees.length);
                });
            },
            total_users_count: function(callback) {
                getTotalUserCount(function(err, total_users_count) {
                    callback(null, total_users_count);
                });
            },
            daily_average: function(callback) {
                getDailyAverageScore(function(err, daily_average) {
                    callback(null, daily_average.toFixed(2));
                });
            },
            daily_perfect_scores: function(callback) {
                getDailyPerfectScoresCount(function(err, daily_perfect_scores) {
                    callback(null, daily_perfect_scores);
                });
            },
            daily_quickest_quiz: function(callback) {
                getDailyQuickestQuiz(function(err, daily_quickest_quiz) {
                    callback(null, daily_quickest_quiz);
                });
            }
        },
        function(err, daily_stats) {
            daily_stats['attendee_percentage'] = Math.round((100 * daily_stats.daily_attendees) / daily_stats.total_users_count) + '%';
            return fn(null, daily_stats);
        });
}

/**
 * Module exports.
 */

module.exports = {
    getTop5: getTop5,
    getTotalUserCount: getTotalUserCount,
    getAllDailyBasicStats: getAllDailyBasicStats
}