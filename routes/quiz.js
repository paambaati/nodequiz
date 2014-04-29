/**
 * Quiz routes.
 * Author: GP.
 * Version: 1.0
 * Release Date: 29-Apr-2014
 */

/**
 * Module dependencies.
 */

var config = require('../config/config'),
    user = require('../utils/user'),
    quiz = require('../utils/quiz'),
    stats = require('../utils/stats'),
    path = require('path'),
    fs = require('fs'),
    date = require('date'),
    dateformat = require('date-format-lite'),
    formidable = require('formidable');

/*
 * Module exports.
 */

module.exports = function(app) {

    /*
     * GET '/quiz'
     */

    app.get(config.URL.QUIZ_MAIN, user.requiredAuthentication, quiz.timeCheck('inside'), function(req, res) {
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
        res.render(config.TEMPL_QUIZ_STANDINGS);
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
            stats.getTop5(req.query.period, function(err, top5rankers) {
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
        }
    });

    /*
     * GET '/quiz/admin'
     */

    app.get(config.URL.QUIZ_ADMIN, user.requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
        config.logger.info('QUIZ ADMIN - PAGE GET', {
            username: req.session.user.username,
            is_admin: req.session.is_admin
        });
        quiz.getAllQuestions(function(err, questions) {
            config.logger.info('QUIZ ADMIN - PAGE GET - RENDERING %s QUESTIONS.', questions.length);
            res.render(config.TEMPL_QUIZ_ADMIN, {
                questions: questions
            });
        });
    });

    /*
     * POST '/quiz/admin/save'
     * AJAX
     */

    app.post(config.URL.QUIZ_ADMIN_SAVE_AJAX, user.requiredAuthentication, function(req, res) {
        config.logger.info('QUIZ ADMIN - FORM POST - SAVE QUESTION', {
            username: req.session.user.username,
            request_params: req.body
        });

        var question_json = {
            'date': new Date(),
            'choices': {}
        },
            choice_counter = 1,
            form_name_counter = 0,
            req_body = req.body,
            question_id = null;
        if (req.session.is_admin) {
            for (var item in req_body) {
                //All form elements will be submitted as element-name-n where n is the nth form on the admin page.
                //We strip it from each element. Silly, I know.
                var new_item = item.substring(0, item.lastIndexOf('-'));
                form_name_counter = item.substring(item.lastIndexOf('-') + 1, item.length);
                if (item.lastIndexOf('choice') === 0 && req_body[item].trim() !== '') {
                    question_json['choices'][choice_counter] = {
                        'choice_text': req_body[item]
                    };
                    choice_counter++;
                } else {
                    question_json[new_item] = (req_body[item]) ? req_body[item] : null;
                }
            }

            question_id = req_body['question_id-' + form_name_counter] ? req_body['question_id-' + form_name_counter] : null;
            delete question_json['question_id'];

            quiz.saveQuestion(question_id, question_json, function(err, question_id) {
                if (err) {
                    config.logger.error('QUIZ ADMIN - FORM POST - SAVE FAILED!', {
                        username: req.session.user.username,
                        question_json: question_json,
                        question_id: question_id,
                        error: err
                    });
                    res.status(500);
                    res.json({
                        'error': err,
                        'response': 'Question not saved!'
                    });
                } else {
                    config.logger.info('QUIZ ADMIN - FORM POST - QUESTION DOC SAVED IN DB', {
                        username: req.session.user.username,
                        question_json: question_json,
                        question_id: question_id
                    });
                    res.json({
                        'error': false,
                        'question_id': question_id
                    });
                }
            });
        } else {
            res.status(403);
            res.json({
                'error': true,
                'response': 'lol nice try'
            });
        }
    });

    /*
     * DELETE '/quiz/admin/save'
     * AJAX
     */

    app.del(config.URL.QUIZ_ADMIN_SAVE_AJAX, user.requiredAuthentication, function(req, res) {
        config.logger.info('QUIZ ADMIN - FORM DELETE - DELETE QUESTION', {
            username: req.session.user.username,
            request_params: req.body
        });

        if (req.session.is_admin) {
            quiz.deleteQuestion(req.body.question_id, function(err, deleted_id) {
                if (err) {
                    config.logger.error('QUIZ ADMIN - FORM DELETE - DELETION FAILED', {
                        username: req.session.user.username,
                        question_id: req.body.question_id,
                        error: err
                    });
                    res.json({
                        'error': true,
                        'response': err.message
                    })
                } else {
                    config.logger.info('QUIZ ADMIN - FORM DELETE - QUESTION DOC DELETED FROM DB', {
                        username: req.session.user.username,
                        deleted_question_id: deleted_id
                    });
                    res.json({
                        'error': false,
                        'deleted_id': deleted_id
                    });
                }
            })
        } else {
            res.status(403);
            res.json({
                'error': true,
                'response': 'lol nice try'
            });
        }
    });

    /*
     * DELETE '/quiz/admin/upload'
     * AJAX
     */

    app.del(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, user.requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
        var file_name = path.join(__dirname, '/public/', config.UPLOAD_DIR, req.body.file_name);
        fs.unlink(file_name, function(err) {
            if (err) {
                config.logger.warn('QUIZ ADMIN - IMAGE DELETE FAILED', {
                    request_body: req.body
                });
            }
            res.send(null);
        });
    });

    /*
     * POST '/quiz/admin/upload'
     * AJAX
     */

    app.post(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, user.requiredAuthentication, quiz.timeCheck('outside'), function(req, res) {
        config.logger.info('QUIZ ADMIN - UPLOAD IMAGE POST', {
            username: req.session.user.username,
            is_admin: req.session.is_admin
        });
        if (req.session.is_admin) {
            var form = new formidable.IncomingForm();
            form.parse(req, function(err, fields, files) {
                var old_path = files.file.path,
                    image_size = files.file.size,
                    file_ext = files.file.name.split('.').pop(),
                    index = files.file.path.lastIndexOf('/') + 1,
                    file_name = files.file.path.substr(index),
                    new_path = path.join(__dirname, '/public/', config.UPLOAD_DIR, file_name + '.' + file_ext);

                config.logger.info('QUIZ ADMIN - UPLOAD IMAGE POST - PARSED PARAMETERS', {
                    old_path: old_path,
                    new_path: new_path,
                    image_size: image_size
                });

                fs.readFile(old_path, function(err, data) {
                    fs.writeFile(new_path, data, function(err) {
                        fs.unlink(old_path, function(err) {
                            if (err) {
                                res.status(500);
                                res.json({
                                    'error': err.message
                                });
                            } else {
                                res.json({
                                    'error': null,
                                    'file_path': file_name + '.' + file_ext,
                                    'image_size': image_size
                                });
                            }
                        });
                    });
                });
            });
        } else {
            res.status(403);
            res.json({
                'error': true,
                'response': 'lol nice try'
            });
        }
    });
}