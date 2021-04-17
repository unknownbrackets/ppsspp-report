'use strict';

const cache = require('./cache');

const MAX_AGE = 86400 * 90;

let g_server;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.getSecure('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_.]+/compat-[0-9]+.jpg)', serve_jpeg);
	g_server.getSecure('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_.]+)/icon.png', serve_icon_png);
};

function serve_jpeg(req, res)
{
	res.setHeader('Content-Type', 'image/jpeg');
	res.setHeader('Cache-Control', 'public, max-age=' + MAX_AGE);
	res.setHeader('Expires', new Date(Date.now() + MAX_AGE * 1000).toUTCString());
	cache.getData(req.params.key, function (err, data)
	{
		if (err)
		{
			res.status(404);
			res.end();
		}
		else
			res.end(data);
	});
}

function serve_icon_png(req, res)
{
	res.setHeader('Content-Type', 'image/png');
	res.setHeader('Cache-Control', 'public, max-age=' + MAX_AGE);
	res.setHeader('Expires', new Date(Date.now() + MAX_AGE * 1000).toUTCString());
	cache.getData(req.params.key + '/icon.safe.png', function (err, data)
	{
		if (err)
		{
			res.status(404);
			res.end();
		}
		else
			res.end(data);
	});
}
