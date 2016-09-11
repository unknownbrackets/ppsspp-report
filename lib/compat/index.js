var report = require('./report');
var list = require('./list');
var info = require('./info');
var Plates = require('plates');
var async = require('async');
var multer = require('multer');
var uploadCache = require('../uploads/cache');

var g_server;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.post('/report/compat', report_compat);

	g_server.app.get('/', list_index);
	g_server.app.get('/games', list_all);
	g_server.app.get('/game/:id_game', game_info);
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
		{
			console.log(err);
			res.end('0');
			return;
		}

		var params = Object.create(req.body);
		if (req.files && req.files.screenshot && req.files.screenshot.length != 0) {
			params.screenshot = req.files.screenshot[0];
		}
		if (req.files && req.files.icon && req.files.icon.length != 0) {
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
			res.status(500).end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}

		data.compat_latest = data.compat_latest.map(decodeGameId);
		data.compat_highest_rated = data.compat_highest_rated.map(decodeGameId);

		var map = Plates.Map();
		map.class('compat_latest').to('compat_latest');
		map.class('compat_highest_rated').to('compat_highest_rated');
		map.class('title').to('title');
		map.class('region_version').to('region_version');
		map.class('region').to('region');
		map.class('version').to('version');
		map.class('label').to('compat');
		map.class('label').insert('compat_label');
		map.where('style').is('rating-active').insert('overall_css_percent');
		map.where('href').is('game_url').insert('game_url');

		res.end(Plates.bind(String(g_server.getStatic('./pages/index.html')), data, map));
	});
}

function list_all(req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	var params = {
		page: parseInt(req.query.page || 1, 10),
		region: req.query.region,
		name: req.query.name,
		compat: req.query.compat,
		order: req.query.order,
	};

	async.auto({
		games: list.getAll.bind(list, params),
		count: list.getCount.bind(list, params),
	}, function (err, data)
	{
		if (err)
		{
			console.log(err);
			res.status(500).end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}

		var pages = Math.ceil(data.count / 100);
		data.games = data.games.map(decodeGameId);
		data.page = params.page;
		data.prev_page = params.page > 1 ? params.page - 1 : undefined;
		data.next_page = params.page < pages ? params.page + 1 : undefined;
		data.prev_page_url = makePageLink('/games', data.prev_page, req.query);
		data.current_page_url = makePageLink('/games', data.page, req.query);
		data.next_page_url = makePageLink('/games', data.next_page, req.query);

		var map = Plates.Map();
		map.class('games').to('games');
		map.class('title').to('title');
		map.class('region_version').to('region_version');
		map.class('region').to('region');
		map.class('version').to('version');
		map.class('label').to('compat');
		map.class('label').insert('compat_label');
		map.where('style').is('rating-active').insert('overall_css_percent');
		map.where('href').is('next_page_url').insert('next_page_url');
		map.where('href').is('current_page_url').insert('current_page_url');
		map.where('href').is('prev_page_url').insert('prev_page_url');
		map.where('href').is('game_url').insert('game_url');
		map.class('page').to('page');

		res.end(Plates.bind(String(g_server.getStatic('./pages/games.html')), data, map));
	});
}

function game_info(req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	var params = {
		id_game: req.params.id_game,
		page: parseInt(req.query.page || 1, 10),
	};

	async.auto({
		game: info.getGameData.bind(info, params),
		reports: info.getReports.bind(info, params),
		reports_count: info.getReportCount.bind(info, params),
		configs: ['reports', function (cb, args)
		{
			var config_ids = args.reports.map(function (report)
			{
				return report.id_config;
			})
			info.getConfigs(config_ids, cb);
		}],
		icon: ['game', function (cb, args)
		{
			uploadCache.iconExists(args.game.id_game, cb);
		}],
		screenshots: ['game', function (cb, args)
		{
			uploadCache.getScreenshots(args.game.id_game, cb);
		}],
	}, function (err, data)
	{
		if (err)
		{
			console.log(err);
			res.status(500).end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}
		if (!data.game)
		{
			res.status(404).end(String(g_server.getStatic('./pages/errors/404.html')));
			return;
		}

		data.game = decodeGameId(data.game);
		if (data.game.version && data.game.region)
			data['page-title'] = data.game.title + ' (' + data.game.version + ', ' + data.game.region + ')';
		else
			data['page-title'] = data.game.title;

		data.logs_url = '/logs/game/' + params.id_game;

		data.reports = data.reports.map(function (row)
		{
			row.latest_report_short = row.latest_report.toISOString().replace(/T.*$/, '');
			row.graphics_css_percent = "width: " + (row.graphics_stars * 100 / 3) + "%;";
			row.speed_css_percent = "width: " + (row.speed_stars * 100 / 3) + "%;";
			row.gameplay_css_percent = "width: " + (row.gameplay_stars * 100 / 3) + "%;";

			row.compat_label = 'label label-important';
			switch (row.compat_ident)
			{
			case 'perfect': row.compat_label = 'label label-success'; break;
			case 'playable': row.compat_label = 'label label-info'; break;
			case 'ingame': row.compat_label = 'label label-warning'; break;
			case 'menu': row.compat_label = 'label label-important'; break;
			case 'none': row.compat_label = 'label label-important'; break;
			}

			row.config_data = row.id_config in data.configs ? escape_html(JSON.stringify(data.configs[row.id_config])) : '';
			row.id = 'report-compat-' + row.id_compat;

			return row;
		});

		var pages = Math.ceil(data.reports_count / 100);
		data.page = params.page;
		data.prev_page = params.page > 1 ? params.page - 1 : undefined;
		data.next_page = params.page < pages ? params.page + 1 : undefined;
		data.prev_page_url = makePageLink('/game/' + params.id_game, data.prev_page, req.query);
		data.current_page_url = makePageLink('/game/' + params.id_game, data.page, req.query);
		data.next_page_url = makePageLink('/game/' + params.id_game, data.next_page, req.query);

		if (data.icon)
			data.icon_img = '<img src="' + data.icon + '" alt="" />';
		else
			data.icon_img = '';

		data.screenshot = data.screenshots.map(f => {
			// Kinda ugly...
			const basename = String(f).match(/\/([^\/]+?)\.jpg$/);
			if (basename && basename[1])
				return '<a href="#report-' + basename[1] + '"><img src="' + f + '" alt="User screenshot of game" /></a>';
			else
				return '<img src="' + f + '" alt="User screenshot of game" />';
		});

		var map = Plates.Map();
		map.class('page-title').to('page-title');
		map.where('href').is('logs_url').insert('logs_url');

		map.class('reports').to('reports');
		map.class('icon_img').to('icon_img');
		map.class('screenshot').to('screenshot');
		map.class('latest_report_short').to('latest_report_short');
		map.class('platform').to('platform');
		map.class('cpu').to('cpu');
		map.class('gpu').to('gpu');
		map.class('version').to('version');
		map.class('label').to('compat');
		map.class('label').insert('compat_label');
		map.where('style').is('graphics_css_percent').insert('graphics_css_percent');
		map.where('style').is('speed_css_percent').insert('speed_css_percent');
		map.where('style').is('gameplay_css_percent').insert('gameplay_css_percent');
		map.where('data-config').is('data-config').insert('config_data');
		map.where('data-disc-crc').is('data-disc-crc').insert('disc_crc');
		map.where('id').is('id_compat').insert('id');

		map.where('href').is('next_page_url').insert('next_page_url');
		map.where('href').is('current_page_url').insert('current_page_url');
		map.where('href').is('prev_page_url').insert('prev_page_url');
		map.class('page').to('page');

		res.end(Plates.bind(String(g_server.getStatic('./pages/game.html')), data, map));
	});
}

function makePageLink(path, page, params)
{
	if (page == undefined)
		return '';

	var formatted = [];

	if (page != 1)
		formatted.push('page=' + page);

	for (var k in params)
	{
		if (k != 'page')
			formatted.push(encodeURIComponent(k) + '=' + encodeURIComponent(params[k]));
	}

	if (formatted.length == 0)
		return path;

	return path + '?' + formatted.join('&');
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

	info.version = info.id_game.replace(/^[^_]+_/, '').replace(/[^0-9\.]+/, '');
	info.compat_label = 'label label-important';
	switch (info.compat_ident)
	{
	case 'perfect': info.compat_label = 'label label-success'; break;
	case 'playable': info.compat_label = 'label label-info'; break;
	case 'ingame': info.compat_label = 'label label-warning'; break;
	case 'menu': info.compat_label = 'label label-important'; break;
	case 'none': info.compat_label = 'label label-important'; break;
	}

	info.region_version = (info.region + ' ' + info.version).trim();
	info.overall_css_percent = "width: " + (info.overall_stars * 100 / 3) + "%;";
	info.game_url = '/game/' + info.id_game;

	return info;
}

function escape_html(text)
{
	return text.replace(/&/g, '&amp;').
		replace(/</g, '&lt;').
		replace(/"/g, '&quot;').
		replace(/'/g, '&#039;');
}
