'use strict';

const fs = require('fs/promises');
let cache = {};
let pending = {};

setInterval(function checkCache()
{
	// Let's go with a low, safe value for now.
	const MAX_CACHE_SIZE = 200;

	const size = Object.keys(cache).length;
	if (size > MAX_CACHE_SIZE)
	{
		cache = {};
		console.log('Cleared cache for uploads (had', size, 'entries.)');
	}
}, 60000);

exports.iconExists = async function (id_game)
{
	const filename = './uploads/' + id_game + '/icon.safe.png';
	if (filename in cache)
		return true;

	try
	{
		await fs.access('./uploads/' + id_game + '/icon.safe.png');
		return '/uploads/' + id_game + '/icon.png';
	}
	catch (err)
	{
		return false;
	}
};

exports.getScreenshots = async function (id_game)
{
	const path = '/uploads/' + id_game;
	try
	{
		const files = await fs.readdir('.' + path);
		return files.filter(f => f.indexOf('compat-') == 0).map(f => path + '/' + f);
	}
	catch (err)
	{
		return [];
	}
};

exports.getData = async function (key)
{
	if (key in cache)
		return cache[key];

	// Add a promise to read this data if not already reading it.
	if (!(key in pending))
	{
		pending[key] = new Promise(async (resolve, reject) =>
		{
			try
			{
				const data = await fs.readFile('./uploads/' + key);
				cache[key] = data;
				delete pending[key];

				resolve(data);
			}
			catch (err)
			{
				reject(err);
			}
		});
	}

	return pending[key];
};
