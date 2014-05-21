/**
 * Database models.
 * Author: GP.
 * Version: 1.4.7
 * Release Date: 21-May-2014
 */

/**
 * Module dependencies.
 */
var config = require('../config/config'),
    mongoose = require('mongoose');

var Schema = mongoose.Schema,
    ObjectId = Schema.Types.ObjectId;

mongoose.connect(config.DB_MONGO_CONNECT_STRING);

// Log connection errors. This doesn't help much though.
// mongoose.connection.on('error', function(err) {
//     console.log(err.message.red);
//     config.logger.error('DATABASE ERROR! Could not to the MongoDB database.', {
//         error_message: err.message,
//         stacktrace: err.stack
//     });
// });

var UserSchema = new Schema({
    username: {
        type: String,
        unique: true,
        trim: true,
        lowercase: true,
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
    },
    last_seen: {
        type: Date,
        default: null
    }
});

if (config.AUTH_USE_LDAP) {
    UserSchema = new Schema({
        username: {
            type: String,
            unique: true,
            trim: true,
            lowercase: true,
            required: true
        },
        admin: {
            type: Boolean,
            default: false
        },
        last_seen: {
            type: Date,
            default: null
        }
    });
};

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

var FeedbackSchema = new Schema({
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
    feedback_data: {}
});

FeedbackSchema.index({
    date: -1
});

var User = mongoose.model(config.DB_AUTH_TABLE, UserSchema);
var PasswordReset = mongoose.model(config.DB_AUTH_PASSWORD_RESET, PasswordResetSchema);
var Question = mongoose.model(config.DB_QUESTIONS_TABLE, QuestionSchema);
var QuizHistory = mongoose.model(config.DB_QUIZ_HISTORY, QuizHistorySchema);
var Feedback = mongoose.model(config.DB_USER_FEEDBACK, FeedbackSchema);

/**
 * Module exports.
 */

module.exports = {
    mongoose: mongoose,
    UserSchema: UserSchema,
    PasswordResetSchema: PasswordResetSchema,
    QuestionSchema: QuestionSchema,
    QuizHistorySchema: QuizHistorySchema,
    FeedbackSchema: FeedbackSchema,
    User: User,
    PasswordReset: PasswordReset,
    Question: Question,
    QuizHistory: QuizHistory,
    Feedback: Feedback
}