/**
 * Quiz question/answer-related utilities.
 * Authors: GP.
 * Version: 1.0
 * Release Date: XX-XXX-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    models = require('../models'),
    misc = require('../utils/misc');

/**
 * Finds all the questions in the quiz history collection for the user for today.
 * Returns a count of all matching quiz history items.
 *
 * @param {String} user ID.
 * @param {Function} callback.
 */

 function findUserQuestionsForToday(user_id, fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    models.QuizHistory.count({
        user_id: user_id,
        date: { $gte: start_day }
    }, function (err, count) {
        if (err) throw err;
        console.log('number of questions user has taken today = ' + count);
        return fn(null, count);
    });
 }

 /**
  * Finds next question to display to user.
  * Returns the full Question document and optimal allowed time to read the question text.
  *
  * @param {String} nth question to display sorted by date.
  * @param {Function} callback.
  */

 function findNextQuestion(index, fn) {
    var start_day = new Date();
    start_day.setHours(0, 0, 0, 0);
    var query = models.Question.find({
                    date: { $gte: start_day }
                });
    query.sort({ date: -1 });
    query.exec(function (err, questions) {
        if (err) throw err;
        console.log('questions today...');
        console.log(questions);
        console.log('required question index....');
        console.log(index);
        if (questions === undefined) {
            //No quiz today!
            return fn(new Error(config.ERR_QUIZ_NOQUIZTODAY), null, null);
        }
        if (index >= questions.length) {
            //No more questions in the quiz!
            return fn(null, null, null);
        } else {
            misc.getAllowedTime(questions[index].title, function(err, allowed_time) {
                return fn(null, questions[index], allowed_time);
            });
        }
    });
 }

/**
 * Checks if quiz can be accessed at server time.
 * If yes, proceed to next middleware.
 * If no, redirect user to `quiz not available at this time` page.
 *
 * @param {String} request.
 * @param {String} response.
 * @param {Boolean} allow to move to next middleware.
 */

function timeCheck(req, res, next) {
    var now = new Date();
    var start_time = new Date();
    start_time.setHours(config.QUIZ_START_TIME[0]);
    start_time.setMinutes(config.QUIZ_START_TIME[1]);
    start_time.setSeconds(0);
    var stop_time = new Date();
    stop_time.setHours(config.QUIZ_STOP_TIME[0]);
    stop_time.setMinutes(config.QUIZ_STOP_TIME[1]);
    stop_time.setSeconds(0);
    if(start_time.getTime() < now.getTime() < stop_time.getTime()) {
        next();
    } else {
        res.redirect(config.URL.TIMECLOSED);
    }
}

/**
 * Upserts answer to Quiz History.
 * Records user ID, question ID, answer selected and the response time.
 *
 * @param {String} user ID.
 * @param {String} question ID.
 * @param {String} answer chosen.
 * @param {Number} response time.
 */

function saveAnswer(user_id, question_id, answer_choice, response_time, fn) {
    var query = { user_id: user_id, question_id: question_id };
    var answer = { date: new Date(), choice_id: answer_choice, response_time: response_time };
    models.QuizHistory.findOneAndUpdate(query, answer, { upsert: true }, function (err, upserted_record) {
        if (err) throw err;
        console.log('done recording the answer!');
        return fn(null, upserted_record);
    });
}

/**
 * Module exports.
 */

module.exports = {
    findUserQuestionsForToday: findUserQuestionsForToday,
    findNextQuestion: findNextQuestion,
    timeCheck: timeCheck,
    saveAnswer: saveAnswer
}