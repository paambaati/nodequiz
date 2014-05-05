/**
 * Database models.
 * Author: GP.
 * Version: 1.4.1
 * Release Date: 05-May-2014
 */

/**
 * Module dependencies.
 */
var config = require('../config/config'),
    mongoose = require('mongoose');

var Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;

mongoose.connect(config.DB_MONGO_CONNECT_STRING);

var UserSchema = new Schema({
    username: {
        type: String,
        unique: true,
        trim: true,
        required: true
    },
    salt: {
        type: String,
        required: true
    },
    hash: {
        type: String,
        required: true
    },
    security_question: {
        type: String,
        required: true
    },
    security_answer: {
        type: String,
        required: true
    },
    activated: {
        type: Boolean,
        default: false
    },
    admin: {
        type: Boolean,
        default: false
    }
});

UserSchema.index({
    username: -1
});

var PasswordResetSchema = new Schema({
    reset_key: {
        type: String,
        unique: true,
        required: true
    },
    user_id: {
        type: ObjectId,
        required: true
    },
    date: {
        type: Date,
        required: true,
        default: new Date()
    },
    used: {
        type: Boolean,
        required: true,
        default: false
    }
})

PasswordResetSchema.index({
    reset_key: -1
});

var QuestionSchema = new Schema({
    date: {
        type: Date,
        required: true,
        default: new Date()
    },
    title: {
        type: String,
        trim: true,
        required: true
    },
    image: {
        type: String,
        default: null
    },
    image_size: {
        type: Number,
        default: 0
    },
    choices: {},
    answer: {
        type: Number,
        required: true
    },
    allowed_time: {
        type: Number,
        required: true,
        default: 10
    }
});

QuestionSchema.index({
    date: 1
});

var QuizHistorySchema = new Schema({
    date: {
        type: Date,
        required: true,
        default: new Date()
    },
    user_id: {
        type: ObjectId,
        required: true,
        ref: config.DB_AUTH_TABLE
    },
    question_id: {
        type: ObjectId,
        required: true
    },
    choice_id: {
        type: Number,
        required: true,
        default: -1
    },
    response_time: {
        type: Number,
        required: true,
        default: 0
    },
    question: {
        type: ObjectId,
        ref: config.DB_QUESTIONS_TABLE
    }
});

QuizHistorySchema.index({
    date: 1
});

var User = mongoose.model(config.DB_AUTH_TABLE, UserSchema);
var PasswordReset = mongoose.model(config.DB_AUTH_PASSWORD_RESET, PasswordResetSchema);
var Question = mongoose.model(config.DB_QUESTIONS_TABLE, QuestionSchema);
var QuizHistory = mongoose.model(config.DB_QUIZ_HISTORY, QuizHistorySchema);

/**
 * Module exports.
 */

module.exports = {
    mongoose: mongoose,
    UserSchema: UserSchema,
    PasswordResetSchema: PasswordResetSchema,
    QuestionSchema: QuestionSchema,
    QuizHistorySchema: QuizHistorySchema,
    User: User,
    PasswordReset: PasswordReset,
    Question: Question,
    QuizHistory: QuizHistory
}