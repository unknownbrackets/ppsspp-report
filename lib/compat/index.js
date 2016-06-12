var report = require('./report');
var list = require('./list');
var Plates = require('plates');
var async = require('async');
var multer = require('multer');

var g_server;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.post('/report/compat', report_compat);

	g_server.app.get('/', list_index);
};

function report_compat(req, res)
{
	var upload = multer({dest: 'uploads/'}).fields([
		{name: 'screenshot', maxCount: 1},
		{name: 'icon', maxCount: 1},
	]);
	upload(req, res, function (err)
	{
		if (err)
			console.log(err);

		var params = Object.create(req.body);
		if (req.files.screenshot && req.files.screenshot.length != 0) {
			params.screenshot = req.files.screenshot[0];
		}
		if (req.files.icon && req.files.icon.length != 0) {
			params.icon = req.files.icon[0];
		}
		report.addCompat(params, function (err, result)
		{
			if (err)
				console.log(err);

			res.setHeader('Content-Type', 'text/plain; charset=utf-8');
			res.end(!err && result ? '1' : '0');
		});
	});
}

function list_index(req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	async.auto({
		compat_latest: list.getLatest.bind(list, {}),
		compat_highest_rated: list.getHighestRated.bind(list, {})
	}, function (err, data)
	{
		if (err)
		{
			console.log(err);
			res.end(String(g_server.getStatic('./pages/errors/500.html')));
		}

		data.compat_latest = data.compat_latest.map(decodeGameId);
		data.compat_highest_rated = data.compat_highest_rated.map(decodeGameId);

		var map = Plates.Map();
		map.class('compat_latest').to('compat_latest');
		map.class('compat_highest_rated').to('compat_highest_rated');
		map.class('title').to('title');
		map.class('region').to('region');
		map.class('version').to('version');
		map.class('label').to('compat');
		map.class('label').insert('compat_label');
		map.where('style').is('rating-active').insert('overall_css_percent');

		res.end(Plates.bind(String(g_server.getStatic('./pages/index.html')), data, map));
	});
}

function decodeGameId(info)
{
	info.format = info.id_game[0] == 'U' ? 'umd' : 'download';
	switch (info.id_game[2])
	{
	case 'A': info.region = 'Asia'; break;
	case 'E': info.region = 'Europe'; break;
	case 'H': info.region = 'Southeast Asia'; break;
	case 'I': info.region = 'Internal'; break;
	case 'J': info.region = 'Japan'; break;
	case 'K': info.region = 'Hong Kong'; break;
	case 'U': info.region = 'USA'; break;
	case 'X': info.region = 'Sample'; break;
	default: info.region = 'Homebrew'; break;
	}

	info.version = info.id_game.replace(/^[^_]+_/, '');
	info.compat_label = 'label label-important';
	switch (info.compat_ident)
	{
	case 'perfect': info.compat_label = 'label label-success'; break;
	case 'playable': info.compat_label = 'label label-info'; break;
	case 'ingame': info.compat_label = 'label label-warning'; break;
	case 'menu': info.compat_label = 'label label-important'; break;
	case 'none': info.compat_label = 'label label-important'; break;
	}

	info.overall_css_percent = "width: " + (info.overall_stars * 100 / 3) + "%;";

	return info;
}
