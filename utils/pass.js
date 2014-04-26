/**
 * Cryptography utilities.
 * Author: GP.
 * Version: 1.1
 * Release Date: 27-Apr-2014
 */

/**
 * Module dependencies.
 */

var crypto = require('crypto'),
    hashids = require('hashids'),
    config = require('../config/config');

/**
 * Hashes a salt with optional `salt`, otherwise
 * generate a salt for `pass` and invoke `fn(err, salt, hash)`.
 *
 * @param {String} salt to hash.
 * @param {String} optional salt.
 * @param {Function} callback.
 * @api public
 */

var hash = function(pwd, salt, fn) {
    // byte length.
    var len = 128;
    // iterations. can take ~300 ms for 12000 iterations.
    var iterations = 12000;
    if (3 == arguments.length) {
        crypto.pbkdf2(pwd, salt, iterations, len, fn);
    } else {
        fn = salt;
        crypto.randomBytes(len, function(err, salt) {
            if (err) return fn(err);
            salt = salt.toString('base64');
            crypto.pbkdf2(pwd, salt, iterations, len, function(err, hash) {
                if (err) return fn(err);
                fn(null, salt, hash);
            });
        });
    }
};

/**
 * Encrypts a MongoDB ObjectID.
 *
 * @param {String} ObjectID to encrypt.
 * @param {Function} callback.
 * @api public
 */

var encrypt = function(mongo_id, fn) {
    try {
        var hashid = new hashids(config.MASTER_SALT);
        fn(null, hashid.encryptHex(mongo_id.toString()));
    } catch (err) {
        fn(err, null);
    }
};

/**
 * Decrypts a cipher encrypted using hex hashids.
 *
 * @param {String} string to decrypt.
 * @param {Function} callback.
 * @api public
 */

var decrypt = function(hash_value, fn) {
    try {
        var hashid = new hashids(config.MASTER_SALT);
        fn(null, hashid.decryptHex(hash_value.toString()));
    } catch (err) {
        fn(err, null);
    }
};

/**
 * Generates a unique cipher by encrypting a user's MongoDB ObjectID
 * along with a right-padded 0 to be used as a unique key for password reset.
 *
 * @param {String} ObjectID to encrypt.
 * @param {Function} callback.
 * @api public
 */

var generateResetKey = function(user_id, fn) {
    try {
        var hashid = new hashids(config.RESET_PASSWORD_SALT);
        fn(null, hashid.encryptHex(user_id.toString() + '0'));
    } catch (err) {
        fn(err, null);
    }
};

/**
 * Decrypts the reset key and returns the user ID from the decrypted text
 * after removing the 0 right padding.
 *
 * @param {String} encrypted reset key.
 * @param {Function} callback.
 * @api public
 */

var decryptResetKey = function(reset_key, fn) {
    try {
        var hashid = new hashids(config.RESET_PASSWORD_SALT);
        var decrypted_string = hashid.decryptHex(reset_key.toString());
        fn(null, decrypted_string.slice(0, decrypted_string.length - 1));
    } catch (err) {
        fn(err, null);
    }
}

/**
 * Module exports.
 */

module.exports = {
    hash: hash,
    encrypt: encrypt,
    decrypt: decrypt,
    generateResetKey: generateResetKey,
    decryptResetKey: decryptResetKey
}