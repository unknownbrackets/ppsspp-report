'use strict';

const cache = require('./cache');

const MAX_AGE = 86400 * 90;

exports.addRoutes = function (server)
{
	server.getSecure('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_.]+/compat-[0-9]+.jpg)', serve_jpeg);
	server.getSecure('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_.]+)/icon.png', serve_icon_png);
};

async function serve_jpeg(req, res)
{
	res.setHeader('Content-Type', 'image/jpeg');
	res.setHeader('Cache-Control', 'public, max-age=' + MAX_AGE);
	res.setHeader('Expires', new Date(Date.now() + MAX_AGE * 1000).toUTCString());

	try
	{
		const data = await cache.getData(req.params.key);
		res.end(data);
	}
	catch (err)
	{
		res.status(404);
		res.end();
	}
}

async function serve_icon_png(req, res)
{
	res.setHeader('Content-Type', 'image/png');
	res.setHeader('Cache-Control', 'public, max-age=' + MAX_AGE);
	res.setHeader('Expires', new Date(Date.now() + MAX_AGE * 1000).toUTCString());

	try
	{
		const data = await cache.getData(req.params.key + '/icon.safe.png');
		res.end(data);
	}
	catch (err)
	{
		res.status(404);
		res.end();
	}
}
