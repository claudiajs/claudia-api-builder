/*global module */
module.exports = function lowercaseKeys(object) {
	'use strict';
	const result = {};
	if (object && typeof object === 'object' && !Array.isArray(object)) {
		Object.keys(object).forEach(key => result[key.toLowerCase()] = object[key]);
	}
	return result;
};
