/*global require, module, process */
const readline = require('readline');

module.exports = function ask(question, PromiseImpl) {
	'use strict';
	return new PromiseImpl(function (resolve, reject) {
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});
		rl.question(question + ' ', function (answer) {
			rl.close();
			if (answer) {
				resolve(answer);
			} else {
				reject(question + ' must be provided');
			}
		});
	});
};
