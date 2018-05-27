module.exports = function sequentialPromiseMap(array, generator) {
	'use strict';
	if (!Array.isArray(array)) {
		throw new Error('the first argument must be an array');
	}
	if (typeof generator !== 'function') {
		throw new Error('the second argument must be a function');
	}
	let index = 0;
	const results = [],
		items = (array && array.slice()) || [],
		sendSingle = function (item) {
			return generator(item, index++)
				.then(result => results.push(result));
		},
		sendAll = function () {
			if (!items.length) {
				return Promise.resolve(results);
			} else {
				return sendSingle(items.shift())
					.then(sendAll);
			}
		};
	return sendAll();
};
