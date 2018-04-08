var vows = require('vows');
var assert = require('assert');
var lookups = require('../lib/lookups');

vows.describe('Version parsing').addBatch({
	'A major stable version': {
		topic: lookups.calcVersionValue('v2.0'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.2'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v3.0'));
		},
	},

	'A minor stable version': {
		topic: lookups.calcVersionValue('v1.3'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.2'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.3.1'));
		},
	},

	'A patch stable version': {
		topic: lookups.calcVersionValue('v1.2.2'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.1'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.3.0'));
		},
	},

	'A revision stable version': {
		topic: lookups.calcVersionValue('v1.2.2.1'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.2'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.2.2.2'));
		},
	},

	'An unstable major version': {
		topic: lookups.calcVersionValue('v2.0-286-gabcdef0'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v2.0'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v2.1'));
		},
	},

	'An unstable minor version': {
		topic: lookups.calcVersionValue('v1.2-286-gabcdef0'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.2.1'));
		},
	},

	'An unstable patch version': {
		topic: lookups.calcVersionValue('v1.2.2-286-gabcdef0'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.2'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.2.3'));
		},
	},

	'An unstable revision version': {
		topic: lookups.calcVersionValue('v1.2.2.1-286-gabcdef0'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.2.2.1'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.2.3'));
		},
	},

	'A "super minor" version': {
		topic: lookups.calcVersionValue('v1.3.0.1'),

		'should parse': function (value) {
			assert.notEqual(value, 0);
		},

		'should be greater than last stable': function (value) {
			assert.isTrue(value > lookups.calcVersionValue('v1.3'));
		},

		'should be less than next stable': function (value) {
			assert.isTrue(value < lookups.calcVersionValue('v1.3.1'));
		},
	},
}).export(module);
