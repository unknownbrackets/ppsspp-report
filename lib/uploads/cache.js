'use strict';

const fs = require('fs');
let cache = {};
let pending = {};

setInterval(function checkCache()
{
	// Let's go with a low, safe value for now.
	var MAX_CACHE_SIZE = 200;

	var size = Object.keys(cache).length;
	if (size > MAX_CACHE_SIZE)
	{
		cache = {};
		console.log('Cleared cache for uploads (had', size, 'entries.)');
	}
}, 60000);

exports.iconExists = function (id_game, cb)
{
	const filename = './uploads/' + id_game + '/icon.safe.png';
	if (filename in cache)
		return cb(null, true);

	fs.access('./uploads/' + id_game + '/icon.safe.png', function (err)
	{
		cb(null, err ? false : '/uploads/' + id_game + '/icon.png');
	});
};

exports.getScreenshots = function (id_game, cb)
{
	const path = '/uploads/' + id_game;
	fs.readdir('.' + path, function (err, files)
	{
		if (err)
			return cb(null, []);

		return cb(null, files.filter(f => f.indexOf('compat-') == 0).map(f => path + '/' + f));
	});
};

exports.getData = function (key, cb)
{
	if (key in cache)
		return cb(null, cache[key]);

	// Add a promise to read this data if not already reading it.
	if (!(key in pending))
	{
		pending[key] = new Promise((resolve, reject) => {
			fs.readFile('./uploads/' + key, (err, data) => {
				if (err)
					reject(err);
				else
				{
					cache[key] = data;
					delete pending[key];

					resolve(data);
				}
			});
		});
	}

	pending[key].then(data => {
		cb(null, data);
		return data;
	}, err => cb(err));
};
