/**
 * Admin routes.
 * Author: GP.
 * Version: 1.1.3
 * Release Date: 17-May-2014
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
    formidable = require('formidable'),
    ua_parser = require('ua-parser');

/*
 * Module exports.
 */

module.exports = function(app) {
    /*
     * GET '/quiz/admin'
     */

    app.get(config.URL.QUIZ_ADMIN, user.requiredAuthentication, user.requiredAdmin, quiz.timeCheck('outside'), function(req, res) {
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
     * GET '/quiz/admin/data'
     */

    app.get(config.URL.QUIZ_ADMIN_DATA, user.requiredAuthentication, user.requiredAdmin, function(req, res) {
        config.logger.info('QUIZ ADMIN - USER DATA - PAGE GET', {
            username: req.session.user.username
        });
        stats.getTotalQuestionCount(function(err, total_questions) {
            stats.getUserDataForAdmin(function(err, results) {
                res.render(config.TEMPL_QUIZ_ADMIN_DATA, {
                    'user_data': results,
                    'total_questions': total_questions
                });
            });
        });
    });

    /*
     * GET '/quiz/admin/feedback'
     */

    app.get(config.URL.QUIZ_ADMIN_FEEDBACK, user.requiredAuthentication, user.requiredAdmin, function(req, res) {
        var username = req.session.user.username;
        config.logger.info('QUIZ ADMIN - FEEDBACK DATA - PAGE GET', {
            username: username
        });
        user.saveLastSeen(username, function(err, record) {
            req.session.last_seen = new Date();
            user.getFeedbackData(function(err, feedback_data) {
                feedback_data.forEach(function(item, index, array) {
                    var ua = item.feedback_data.user_agent,
                        user_agent = ua_parser.parseUA(ua).toString(),
                        os = ua_parser.parseOS(ua).toString(),
                        device = ua_parser.parseDevice(ua).toString();
                    device = (device == 'Other') ? 'Desktop' : device;
                    item.feedback_data['platform'] = [user_agent, os, device].join(' - ');
                });
                res.render(config.TEMPL_QUIZ_ADMIN_FEEDBACK, {
                    'feedback_data': feedback_data,
                    'UNREAD_COUNT': 0
                });
            });
        });
    });

    /*
     * POST '/quiz/admin/save'
     * AJAX
     */

    app.post(config.URL.QUIZ_ADMIN_SAVE_AJAX, user.requiredAuthentication, user.requiredAdmin, quiz.timeCheck('outside'), function(req, res) {
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
    });

    /*
     * DELETE '/quiz/admin/save'
     * AJAX
     */

    app.del(config.URL.QUIZ_ADMIN_SAVE_AJAX, user.requiredAuthentication, user.requiredAdmin, quiz.timeCheck('outside'), function(req, res) {
        config.logger.info('QUIZ ADMIN - FORM DELETE - DELETE QUESTION', {
            username: req.session.user.username,
            request_params: req.body
        });

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
    });

    /*
     * DELETE '/quiz/admin/upload'
     * AJAX
     */

    app.del(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, user.requiredAuthentication, user.requiredAdmin, quiz.timeCheck('outside'), function(req, res) {
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

    app.post(config.URL.QUIZ_ADMIN_SAVE_UPLOAD, user.requiredAuthentication, user.requiredAdmin, quiz.timeCheck('outside'), function(req, res) {
        config.logger.info('QUIZ ADMIN - UPLOAD IMAGE POST', {
            username: req.session.user.username,
            is_admin: req.session.is_admin
        });
        var form = new formidable.IncomingForm();
        form.parse(req, function(err, fields, files) {
            var old_path = files.file.path,
                image_size = files.file.size,
                file_ext = files.file.name.split('.').pop(),
                index = old_path.lastIndexOf('/') + 1,
                file_name = old_path.substr(index),
                new_path = path.join(config.APP_BASE_PATH, '/public/', config.UPLOAD_DIR, file_name + '.' + file_ext);

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
                                'error': false,
                                'file_path': file_name + '.' + file_ext,
                                'image_size': image_size
                            });
                        }
                    });
                });
            });
        });
    });
}