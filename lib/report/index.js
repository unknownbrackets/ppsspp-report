var data = require('./data');
var Plates = require('plates');

var g_server;

module.exports.addRoutes = function (server)
{
	g_server = server;
	server.app.post('/report/message', report_message);

	server.app.get('/temp/recent', temp_recent);
	server.app.get('/temp/recent*', temp_recent);

	server.app.get('/logs', logs);
	server.app.get('/logs/version/:version', logs_version);
	server.app.get('/logs/game/:id_game', logs_game);
	server.app.get('/logs/kind/:id_msg_kind', logs_kind);
};

function report_message(req, res)
{
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.end('1');

	data.addMessage(null, req.body, function (err)
	{
		if (err)
			console.log(err);
	});
}

function temp_recent(req, res)
{
	res.redirect(301, '/logs' + (req.params[0] ? req.params[0] : ''));
	res.end();
}

function logs_common(args, req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	if ("status" in req.query)
		args.status = req.query.status;

	data.getRecentMessageList(null, args, function (err, results)
	{
		if (err)
		{
			res.end(String(g_server.getStatic('./pages/errors/500.html')));
			return;
		}

		var map = Plates.Map();
		map.class('messages').to('messages');
		map.where('title').is('id_game').insert('id_game');
		map.class('title-text').to('title');
		map.class('title-text').use('title_uri').as('href');
		map.class('version-text').to('version');
		map.class('version-text').use('version_uri').as('href');
		map.class('latest_report-text').to('latest_report_short');
		map.where('title').is('latest_report').insert('latest_report');
		map.class('message-text').to('message');
		map.class('message-text').use('message_uri').as('href');

		map.tag('title').insert('title');

		var title = '';
		results = results.map(function (row)
		{
			row.latest_report_short = row.latest_report.toISOString().replace(/T.*$/, '');
			row.latest_report = row.latest_report.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
			row.title_uri = '/logs/game/' + encodeURIComponent(row.id_game);
			row.version_uri = '/logs/version/' + encodeURIComponent(row.version);
			row.message_uri = '/logs/kind/' + encodeURIComponent(row.id_msg_kind);

			for (var k in row)
			{
				if (typeof row[k] == 'string')
					row[k] = escape_html(row[k]);
			}

			if (title == '')
			{
				if (args.id_game)
					title = row.title + ' - ';
				else if (args.id_msg_kind)
					title = row.message_template + ' - ';
				else if (args.version)
					title = row.version + ' - ';
			}

			return row;
		});

		res.end(Plates.bind(String(g_server.getStatic('./pages/logs.html')), {'messages': results, 'title': title}, map));
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

function escape_html(text)
{
	return text.replace(/&/g, '&amp;').
		replace(/</g, '&lt;').
		replace(/"/g, '&quot;').
		replace(/'/g, '&#039;');
}