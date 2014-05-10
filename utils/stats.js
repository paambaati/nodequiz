/**
 * Quiz statistics & ranking utilities.
 * Author: GP.
 * Version: 1.4.4
 * Release Date: 09-May-2014
 */

/**
 * Module dependencies.
 */

var async = require('async'),
    date_format = require('date-format-lite'),
    config = require('../config/config'),
    models = require('../models/models'),
    misc = require('../utils/misc'),
    quiz = require('../utils/quiz');

/**
 * Gets the username from the user's _id.
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
 * Gets the user's _id from his/her username.
 *
 * @param {Function} callback.
 * @api private
 */

function getUserIdFromName(username, fn) {
    models.User.findOne({
        username: username
    }, function(err, user) {
        return fn(null, user._id);
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
 * Gets the last date the user took a quiz.
 *
 * @param {String} username.
 * @param {Function} callback.
 * @api private
 */

function getLastQuizDate(username, fn) {
    getUserIdFromName(username, function(err, user_id) {
        var to_find = {
            user_id: user_id
        };
        var query = models.QuizHistory.find(to_find);
        query.sort({
            date: -1
        });
        query.select('date');
        query.limit(1);
        query.exec(function(err, results) {
            return fn(null, results);
        });
    });
}

/**
 * Gets the total number of registered non-admin users.
 *
 * @param {Function} callback.
 * @api public
 */

function getTotalUserCount(fn) {
    models.User.where({
        'admin': false
    }).count(function(err, count) {
        return fn(null, count);
    });
}

/**
 * Gets the total number of questions.
 *
 * @param {Function} callback.
 * @api public
 */

function getTotalQuestionCount(fn) {
    models.Question.count(function(err, count) {
        return fn(null, count);
    });
}

/**
 * Gets all unique non-admin users who've attended today's quiz.
 *
 * @param {Function} callback.
 * @api private
 */

function getDailyAttendees(fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var to_find = {
        date: {
            $gte: start_day
        }
    };
    var query = models.QuizHistory.count(to_find).distinct('user_id');
    query.populate('user_id', null, {
        admin: {
            $ne: true
        }
    });
    query.exec(function(err, results) {
        return fn(null, results);
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
 * Gets the day's quickest fully-correct quiz.
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
 * Gets the top `n` scorers for the specified time period.
 * Returns a nested array of the form
 * [
 *    [score, username, avg response time, rank],
 *    ["],...
 * ]
 *
 * @param {String} time period for which the data is required. Allowed values are 'weekly', 'monthly', 'alltime'.
 * @param {Number} `n` number of top scorers to be fetched - optional, default = 5.
 * @param {Function} callback.
 * @api public
 */

function getTopRanks(time_period, rank_limit, fn) {
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
                rank_limit = rank_limit || 5;
                userscore_array.sort(misc.rankByScoreAndResTime);
                return fn(null, userscore_array.slice(0, rank_limit));
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
 * Gets today's toughest and easiest questions.
 * Both are calculated by most number of wrong/correct answers and then
 * sorted by maximum/minimum total response time.
 *
 * @param {Function} callback.
 * @api public
 */

function getTodaysToughestAndEasiestQuestion(fn) {
    var start_day = new Date(),
        question_map = {
            'easiest': {},
            'toughest': {}
        },
        final_result = {};
    start_day.setHours(0, 0, 0, 0)
    var to_find = {
        date: {
            $gte: start_day
        }
    };
    var history_query = models.QuizHistory.find(to_find);
    history_query.sort({
        _id: 1
    });
    history_query.populate('question'); //Mongo equivalent of a RDBMS JOIN. Isn't she beautiful?!
    history_query.select('question choice_id response_time');
    history_query.exec(function(err, questions) {
        var correct_answer = false,
            question_id = null;
        if (questions !== undefined) {
            questions.forEach(function(item, index, array) {
                question_id = item.question._id;
                if (item.question.answer != item.choice_id) {
                    if (question_map.toughest[question_id]) {
                        question_map.toughest[question_id][0]++;
                        question_map.toughest[question_id][1] += item.response_time;
                    } else {
                        question_map.toughest[question_id] = [1, item.response_time, item.question.title];
                    }
                } else {
                    if (question_map.easiest[question_id]) {
                        question_map.easiest[question_id][0]++;
                        question_map.easiest[question_id][1] += item.response_time;
                    } else {
                        question_map.easiest[question_id] = [1, item.response_time, item.question.title];
                    }
                }
            });
        } else {
            return fn(null, null);
        }
        misc.getMaxOrMinofArray('max', question_map.toughest, 1, function(err, result) {
            final_result['toughest'] = result;
            misc.getMaxOrMinofArray('max', question_map.easiest, 1, function(err, result) {
                final_result['easiest'] = result;
            });
        });
        return fn(null, final_result);
    });
}

/**
 * Gets a user's score history (total points and average response time)
 * starting from a particular date and returns a dictionary object of the form
 * {
 *  'scores': [[timestamp1, total score], [timestamp2, total score], ...],
 *  'times':  [[timestamp1, average response time], [timestamp2, average response time], ...]
 * }
 *
 * @param {String} user ID.
 * @param {Date} starting day from when data needs to be collected.
 * @param {Function} callback.
 * @api public
 */

function getPersonalScoreHistory(user_id, start_day, fn) {
    var result_map = {
        'scores': [],
        'times': []
    };
    start_day.setHours(0, 0, 0, 0);
    var to_find = {
        date: {
            $gte: start_day
        },
        user_id: user_id
    };
    var history_query = models.QuizHistory.find(to_find);
    history_query.sort({
        date: 1
    });
    history_query.populate('question');
    history_query.select('question choice_id response_time date');
    history_query.exec(function(err, questions) {
        var correct_answer = false,
            timestamp = null,
            date_exists = null,
            array_counter = -1,
            map_length = 0;
        if (questions !== undefined) {
            questions.forEach(function(item, index, array) {
                if (item.question.answer == item.choice_id) {
                    timestamp = item.date;
                    map_length = result_map.scores.length;
                    timestamp.setHours(0, 0, 0, 0);
                    timestamp = timestamp.getTime();
                    date_exists = (map_length) ? (result_map.scores[map_length - 1][0] == timestamp) : false;
                    if (date_exists) {
                        result_map.scores[array_counter][1]++;
                        result_map.times[array_counter][1] = (result_map.times[array_counter][1] + item.response_time) / 2;
                    } else {
                        result_map.scores.push([timestamp, 1]);
                        result_map.times.push([timestamp, item.response_time]);
                        array_counter++;
                    }
                }
            });
        } else {
            return fn(null, null);
        }
        return fn(null, result_map);
    });
}

/**
 * Gets a user's overall rank.
 *
 * @param {String} username.
 * @param {Function} callback.
 * @api public
 */

function getPersonalRank(username, fn) {
    var rank = -1;
    getTopRanks('alltime', null, function(err, ranks) {
        for (var i = 0; i < ranks.length; i++) {
            if (ranks[i][1] == username) {
                rank = i + 1;
                break;
            }
        }
        return fn(null, rank);
    });
}

/**
 * Gets all user data for admins.
 *
 * @param {Function} callback.
 * @api public
 */

function getUserDataForAdmin(fn) {
    var index = 0;
    getTopRanks(null, null, function(err, results) {
        async.eachSeries(results, function(item, callback) {
            getLastQuizDate(item[1], function(err, result) {
                //Format to ISU-8601 so that the timeago plugin can format this.
                results[index].push(result[0]['date'].format('isoUtcDateTime'));
                index++;
                return callback();
            });
        }, function() {
            return fn(null, results);
        });
    });
}

/**
 * Module exports.
 */

module.exports = {
    getTopRanks: getTopRanks,
    getTotalUserCount: getTotalUserCount,
    getTotalQuestionCount: getTotalQuestionCount,
    getAllDailyBasicStats: getAllDailyBasicStats,
    getTodaysToughestAndEasiestQuestion: getTodaysToughestAndEasiestQuestion,
    getPersonalScoreHistory: getPersonalScoreHistory,
    getPersonalRank: getPersonalRank,
    getUserDataForAdmin: getUserDataForAdmin
}