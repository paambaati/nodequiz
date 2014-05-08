/**
 * Quiz routes.
 * Author: GP.
 * Version: 1.1
 * Release Date: 08-May-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    user = require('../utils/user'),
    quiz = require('../utils/quiz'),
    stats = require('../utils/stats'),
    date = require('date'),
    date_format = require('date-format-lite');

/*
 * Module exports.
 */

module.exports = function(app) {

    /*
     * GET '/quiz'
     */

    app.get(config.URL.QUIZ_MAIN, user.requiredAuthentication, function(req, res) {
        config.logger.info('QUIZ - WELCOME - PAGE GET', {
            username: req.session.user.username,
            is_admin: req.session.is_admin
        });
        if (req.session.is_admin) {
            res.redirect(config.URL.QUIZ_ADMIN);
        } else {
            res.render(config.TEMPL_QUIZ_MAIN);
        }
    });

    /**
     * GET '/quiz/noquiz'
     */

    app.get(config.URL.QUIZ_NOQUIZ, user.requiredAuthentication, function(req, res) {
        res.render(config.TEMPL_QUIZ_NOQUIZ);
    });

    /*
     * GET '/quiz/start'
     */

    app.get(config.URL.QUIZ_START, user.requiredAuthentication, quiz.timeCheck('inside'), function(req, res) {
        config.logger.info('START QUIZ - PAGE GET', {
            username: req.session.user.username
        });
        quiz.findUserQuestionsForToday(req.session.user._id, function(err, count) {
            quiz.findNextQuestion(count, function(err, question, total_questions) {
                if (err && err.message == config.ERR_QUIZ_NOQUIZTODAY) {
                    res.redirect(config.URL.QUIZ_NOQUIZ);
                }
                if (question !== null) {
                    config.logger.info('START QUIZ - SHOWING QUESTION', {
                        username: req.session.user.username,
                        question_id: question._id
                    });
                    //Save answer with answer -1 to mark that the user has seen this question
                    quiz.saveAnswer(req.session.user._id, question._id, '-1', '0', function(err, record) {
                        req.session.question_id = question._id;
                        req.session.question_render_time = new Date();
                        req.session.question_allowed_time = question.allowed_time;
                        res.render(config.TEMPL_QUIZ_START, {
                            question: question,
                            question_index: count + 1,
                            total_questions: total_questions,
                            image: question.image
                        });
                    });
                } else {
                    var today = new Date();
                    today.setHours(0, 0, 0, 0);
                    quiz.getResults(req.session.user._id, today, function(err, results) {
                        config.logger.info('START QUIZ - QUIZ COMPLETED. SHOWING RESULTS', {
                            username: req.session.user.username
                        });
                        res.render(config.TEMPL_QUIZ_END, {
                            results: results
                        });
                    });
                }
            });
        });
    });

    /*
     * POST '/quiz/start'
     */

    app.post(config.URL.QUIZ_START, function(req, res) {
        var response_time = (new Date() - req.session.question_render_time.toString().date()) / 1000;
        var answer_choice = req.body.choice;
        config.logger.info('START QUIZ - FORM POST - SAVING ANSWER DOC IN DB', {
            username: req.session.user.username,
            question_id: req.session.question_id,
            answer_chosen: answer_choice,
            response_time: response_time
        });
        if (response_time > req.session.question_allowed_time) {
            config.logger.warn('FRAUD DETECTED - RESPONSE TIME > ALLOWED TIME', {
                allowed_time: req.session.question_allowed_time,
                response_time: response_time
            });
        }
        quiz.saveAnswer(req.session.user._id, req.session.question_id, answer_choice, response_time, function(err, record) {
            res.redirect(req.originalUrl);
        });
    });

    /*
     * GET '/quiz/standings'
     */

    app.get(config.URL.QUIZ_STANDINGS, user.requiredAuthentication, function(req, res) {
        config.logger.info('QUIZ STANDINGS - PAGE GET');
        stats.getTotalUserCount(function(err, total_users_count) {
            res.render(config.TEMPL_QUIZ_STANDINGS, {
                'total_users_count': total_users_count
            });
        });
    });

    /*
     * POST '/quiz/get?stat=xxx'
     * AJAX
     */

    app.get(config.URL.QUIZ_STAT_AJAX, user.requiredAuthentication, function(req, res) {
        config.logger.info('QUIZ STANDINGS - AJAX GET', {
            username: req.session.user.username,
            requested_statistic: req.query.stat
        });
        if (req.query.stat == 'basic') {
            stats.getAllDailyBasicStats(function(err, daily_stats) {
                res.json(daily_stats);
            });
        } else if (req.query.stat == 'top5') {
            stats.getTopRanks(req.query.period, 5, function(err, top5rankers) {
                /*//Sleep for 2 seconds
                var stop = new Date().getTime();
                while (new Date().getTime() < stop + 2000) {;
                }
                //End sleep*/
                res.json(top5rankers);
            });
        } else if (req.query.stat == 'easytough') {
            stats.getTodaysToughestAndEasiestQuestion(function(err, result) {
                res.json(result);
            });
        } else if (req.query.stat == 'myhistory') {
            var start_day = new Date();
            start_day.setDate(start_day.getDate() - 30);
            stats.getPersonalScoreHistory(req.session.user._id, start_day, function(err, results) {
                res.json(results);
            });
        } else if(req.query.stat == 'myrank') {
            stats.getPersonalRank(req.session.user.username, function(err, result) {
                res.json(result);
            });
        }
    });
}