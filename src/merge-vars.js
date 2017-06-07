/*global module */
module.exports = function mergeVars(baseObject, replacementObject, keyPrefix) {
	'use strict';
	const matchesPrefix = function (key) {
			return key.indexOf(keyPrefix) === 0;
		},
		merged = {};

	if (baseObject) {
		Object.keys(baseObject).forEach(key => merged[key] = baseObject[key]);
	}
	if (replacementObject) {
		if (keyPrefix) {
			Object.keys(replacementObject).filter(matchesPrefix).forEach(key =>  merged[key.slice(keyPrefix.length)] = replacementObject[key]);
		} else {
			Object.keys(replacementObject).forEach(key =>  merged[key] = replacementObject[key]);
		}
	}
	return merged;
};
