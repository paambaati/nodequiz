/**
 * Database models.
 * Authors: GP.
 * Version: 1.0
 * Release Date: 05-Apr-2014
 */

/**
 * Module dependencies.
 */
var config = require('./config/config'),
    mongoose = require('mongoose');

var Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;

mongoose.connect(config.DB_MONGO_CONNECT_STRING);

var UserSchema = new Schema({
    username: { type: String, unique: true, trim: true, required: true },
    salt: { type: String, required: true },
    hash: { type: String, required: true },
    security_question: { type: String, required: true },
    security_answer: { type: String, required: true },
    activated: { type: Boolean, default: false },
    admin: { type: Boolean, default: false }
});

var QuestionSchema = new Schema({
    date: { type: Date, required: true, default: new Date() },
    title: { type: String, trim: true, required: true },
    image: { type: String, default: null },
    choices: {},
    answer: { type: Number, required: true }
});

QuestionSchema.index({ date: -1});

var QuizHistorySchema = new Schema({
    date: { type: Date, required: true, default: new Date() },
    user_id: { type: ObjectId, required: true },
    question_id: { type: ObjectId, required: true },
    choice_id: { type: Number, required: true, default: -1 },
    response_time: { type: Number, required: true, default: -1 },
    question: { type: ObjectId, ref: config.DB_QUESTIONS_TABLE }
});

QuizHistorySchema.index({ date: -1});

var User = mongoose.model(config.DB_AUTH_TABLE, UserSchema);
var Question = mongoose.model(config.DB_QUESTIONS_TABLE, QuestionSchema);
var QuizHistory = mongoose.model(config.DB_QUIZ_HISTORY, QuizHistorySchema);

/**
 * Module exports.
 */

module.exports = {
    mongoose: mongoose,
    UserSchema: UserSchema,
    QuestionSchema: QuestionSchema,
    QuizHistorySchema: QuizHistorySchema,
    User: User,
    Question: Question,
    QuizHistory: QuizHistory
}