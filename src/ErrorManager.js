/* Copyright (c) 2010, Sage Software, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * ErrorManager is a singleton that parses and stores SData error responses into localStorage.
 * @alternateClassName ErrorManager
 * @requires utility
 * @singleton
 */
define('argos/ErrorManager', [
    'dojo/_base/json',
    'dojo/_base/lang',
    'dojo/_base/connect',
    'dojo/string',
    './utility'
], function(
    json,
    lang,
    connect,
    string,
    utility
) {
    var errors = [];
    try
    {
        if (window.localStorage)
            errors = json.fromJson(window.localStorage.getItem('errorlog')) || [];
    }
    catch(e)
    {

    }

    return lang.setObject('argos.ErrorManager', {
        /**
         * @cfg {Number}
         * Total amount of errors to keep
         */
        errorCacheSizeMax: 10,

        /**
         * Adds a custom error item and fires the onErrorAdd event
         * @param description Short title or description of the Error. Ex: Duplicate Found, Invalid Email
         * @param error Object The error object that will be JSON-stringified and stored for use.
         */
        addError: function(description, error) {
            var errorItem = {
                    '$key': new Date().getTime(),
                    'Date': moment().format(),
                    'Description': description,
                    'Error': json.toJson(utility.sanitizeForJson(error))
                };

            this.checkCacheSize();
            errors.push(errorItem);
            this.onErrorAdd();
            this.save();
        },

        /**
         * Ensures there is at least 1 open spot for a new error by checking against errorCacheSizeMax
         * and removing as needed.
         */
        checkCacheSize: function() {
            var errLength = errors.length,
                cacheSizeIndex = this.errorCacheSizeMax - 1;

            if (errLength > cacheSizeIndex)
                this.removeError(cacheSizeIndex, errLength - cacheSizeIndex);
        },

        /**
         * Retrieve a error item that has the specified key|value pair
         * @param {String} key Property of error item to check, such as errorDate or url
         * @param {Number/String} value Value of the key to match against
         * @return {Object} Returns the first error item in the match set or null if none found
         */
        getError: function(key, value) {
            var errorList = this.getAllErrors();

            for (var i = 0; i < errorList.length; i++)
            {
                if (errorList[i][key] == value)
                    return errorList[i];
            }

            return null;
        },

        /**
         * Returns a copy of all errors.
         * @return {Object[]} Array of error objects.
         */
        getAllErrors: function() {
            return lang.clone(errors);
        },

        /**
         * Removes the specified index from the error list.
         * @param {Number} index Index of error to remove.
         * @param {Number} amount Number of errors to remove from indexed point, if not provided defaults to 1.
         */
        removeError: function(index, amount) {
            errors.splice(index, amount || 1);
        },

        /**
         * Publishes the `/app/refresh` event to notify that an error has been added
         */
        onErrorAdd: function() {
            connect.publish('/app/refresh', [{
                resourceKind: 'errorlogs'
            }]);
        },

        /**
         * Attempts to save all errors into localStorage under the `errorlog` key.
         */
        save: function() {
            try
            {
                if (window.localStorage)
                    window.localStorage.setItem('errorlog', json.toJson(errors));
            }
            catch(e)
            {

            }
        }
    }
);
});