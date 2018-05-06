var data = require('./data');
var Plates = require('plates');
var multer = require('multer');

var g_server;

module.exports.addRoutes = function (server)
{
	g_server = server;
	server.app.post('/report/message', report_message);

	server.app.get('/temp/recent', temp_recent);
	server.app.get('/temp/recent*', temp_recent);

	server.getSecure('/logs', logs);
	server.getSecure('/logs/version/:version', logs_version);
	server.getSecure('/logs/game/:id_game', logs_game);
	server.getSecure('/logs/kind/:id_msg_kind', logs_kind);
	server.getSecure('/logs/platform/:id_platform', logs_platform);
	server.getSecure('/logs/cpu/:id_cpu', logs_cpu);
	server.getSecure('/logs/gpu/:id_gpu', logs_gpu);

	server.getSecure('/logs/kinds', logs_kind_index);
};

function report_message(req, res)
{
	var upload = multer().fields([]);
	upload(req, res, function (err)
	{
		if (err)
			console.log(err);

		data.addMessage(req.body, function (err)
		{
			if (err)
				console.log(err);
		});
	});

	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.end('1');
}

function temp_recent(req, res)
{
	var dest = '/logs' + (req.params[0] ? req.params[0] : '');
	if (process.env.OPENSHIFT_EXTERNAL_URL)
		dest = process.env.OPENSHIFT_EXTERNAL_URL + dest;
	res.redirect(301, dest);
	res.end();
}

function logs_common(args, req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	if ("status" in req.query)
		args.status = req.query.status;

	data.getRecentMessageList(args, function (err, results)
	{
		if (err)
		{
			console.log(err);
			res.status(500).end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}

		var map = Plates.Map();
		map.class('messages').to('messages');
		map.where('title').is('id_game').insert('id_game');
		map.where('title').is('platform-info').insert('platform_info');
		map.class('title-text').to('title');
		map.class('title-text').use('title_uri').as('href');
		map.class('version-text').to('version');
		map.class('version-text').use('version_uri').as('href');
		map.class('latest_report-text').to('latest_report_short');
		map.where('title').is('latest_report').insert('latest_report');
		map.class('message-text').to('message');
		map.class('message-text').use('message_uri').as('href');

		map.tag('title').insert('title');
		map.class('page-title').use('page-title');

		var title = '';
		results = results.map(function (row)
		{
			row.latest_report_short = row.latest_report.toISOString().replace(/T.*$/, '');
			row.latest_report = row.latest_report.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
			row.title_uri = '/logs/game/' + encodeURIComponent(row.id_game);
			row.version_uri = '/logs/version/' + encodeURIComponent(row.version);
			row.message_uri = '/logs/kind/' + encodeURIComponent(row.id_msg_kind);
			row.platform_info = row.platforms + "\n" + row.gpus + "\n" + row.cpus;

			for (var k in row)
			{
				if (typeof row[k] == 'string')
					row[k] = escape_html(row[k]);
			}

			if (title == '')
			{
				if (args.id_game)
					title = row.title;
				else if (args.id_msg_kind)
					title = row.message_template;
				else if (args.version)
					title = row.version;
				else if (args.id_platform)
					title = row.platforms;
				else if (args.id_cpu)
					title = row.cpus;
				else if (args.id_gpu)
					title = row.gpus;
			}

			return row;
		});

		var page_title = title == '' ? 'Recent logs' : 'Recent logs - ' + title;
		var html_title = title == '' ? '' : title + ' - ';
		res.end(Plates.bind(String(g_server.getStatic('./pages/logs.html')), {'messages': results, 'title': html_title, 'page-title': page_title}, map));
	});
}

function logs(req, res)
{
	logs_common({}, req, res);
}

function logs_version(req, res)
{
	logs_common({version: req.params.version}, req, res);
}

function logs_game(req, res)
{
	logs_common({id_game: req.params.id_game}, req, res);
}

function logs_kind(req, res)
{
	logs_common({id_msg_kind: req.params.id_msg_kind}, req, res);
}

function logs_platform(req, res)
{
	logs_common({id_platform: req.params.id_platform}, req, res);
}

function logs_cpu(req, res)
{
	logs_common({id_cpu: req.params.id_cpu}, req, res);
}

function logs_gpu(req, res)
{
	logs_common({id_gpu: req.params.id_gpu}, req, res);
}

function logs_kind_index(req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	var args = {};
	if ("status" in req.query)
		args.status = req.query.status;

	data.getKindList(args, function (err, results)
	{
		if (err)
		{
			res.status(500).end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}

		var map = Plates.Map();
		map.class('kinds').to('kinds');
		map.class('message-text').to('message');
		map.class('message-text').use('message_uri').as('href');
		map.class('games-text').to('games');

		results = results.map(function (row)
		{
			row.message_uri = '/logs/kind/' + encodeURIComponent(row.id_msg_kind);

			for (var k in row)
			{
				if (typeof row[k] == 'string')
					row[k] = escape_html(row[k]);
			}

			return row;
		});

		res.end(Plates.bind(String(g_server.getStatic('./pages/logs_kinds.html')), {'kinds': results}, map));
	});
}

function escape_html(text)
{
	return text.replace(/&/g, '&amp;').
		replace(/</g, '&lt;').
		replace(/"/g, '&quot;').
		replace(/'/g, '&#039;');
}
