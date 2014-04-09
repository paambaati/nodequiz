/**
 * Quiz statistics & ranking utilities.
 * Authors: GP.
 * Version: 1.0
 * Release Date: 08-Apr-2014
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

function getDailyAverageScore(fn) {
    var user_points = 0,
        scores_count = 0;
    getDailyQuestionsCount(function(err, count) {
        console.log('total questions today = ', count);
        getDailyAttendees(function(err, results) {
            console.log('total attendees today = ', results.length);
            async.eachSeries(results, function(item, callback) {
                quiz.getResults(item, function(err, results) {
                    console.log('getResults returned...');
                    console.log(results);
                    scores_count++;
                    user_points += results.total_points;
                    console.log('user points so far = ', user_points);
                    return callback();
                });
            }, function() {
                console.log('final total points = ', user_points);
                console.log('so average = ', user_points / scores_count);
                //callback();
                //return fn(null, user_points / scores_count);
            });
        });
    });
};

//TO-DO: WIP
/*function getDailyAverageScore(fn) {
    var total_entries = 0,
        correct_entries = 0,
        avg_score = 0,
        qa_map = {};
    var selector = {
        date: {
            $gte: start_day
        }
    };
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);

    //First, pick all questions with their corresponding choices.
    var query = models.Question.find(selector);
    query.select('_id answer');
    query.exec(function(err, qa_results) {
        if (qa_results === undefined) {
            return fn(null, null);
        } else {
            //console.log('actual question-answer map...');
            qa_results.forEach(function(item, index, array) {
                qa_map[item['_id']] = item['answer'];
            });
            //console.log(qa_map);
            //Second, take all user answers and match them with the actual answers.
            query = models.QuizHistory.find(selector);
            query.select('question_id choice_id');
            query.exec(function(err, results) {
                results.forEach(function(item, index, array) {
                    total_entries++;
                    //console.log('from quiz history...');
                    //console.log(item);
                    if (item['choice_id'] == qa_map[item['question_id']]) {
                        correct_entries++;
                    }
                });
                //Third, calculate average.
                console.log('total entries = ', total_entries);
                console.log('correct entries = ', correct_entries);
                return fn(null, results);
            });
        }
    })
};*/

/**
 * Module exports.
 */

module.exports = {
    getDailyAttendees: getDailyAttendees,
    getDailyAverageScore: getDailyAverageScore
}