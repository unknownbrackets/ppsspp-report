'use strict';

const cache = require('./cache');

let g_server;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.get('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_\.]+/compat-[0-9]+\.jpg)', serve_jpeg);
	g_server.app.get('/uploads/:key([A-Za-z_0-9][A-Za-z_0-9_\.]+)/icon.png', serve_icon_png);
};

function serve_jpeg(req, res)
{
	res.setHeader('Content-Type', 'image/jpeg');
	res.end(cache.getDataSync(req.params.key));
}

function serve_icon_png(req, res)
{
	res.setHeader('Content-Type', 'image/png');
	res.end(cache.getDataSync(req.params.key + '/icon.safe.png'));
}
