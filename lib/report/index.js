var data = require('./data');
var Plates = require('plates');

var g_server;

module.exports.addRoutes = function (server)
{
	g_server = server;
	server.app.post('/report/message', report_message);
	server.app.get('/temp/recent', temp_recent);
	server.app.get('/temp/recent/version/:version', temp_recent_version);
	server.app.get('/temp/recent/game/:id_game', temp_recent_game);
};

function report_message(req, res)
{
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.send('1');

	data.addMessage(null, req.body, function (err)
	{
	});
}

function temp_recent_common(args, req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	data.getRecentMessageList(null, args, function (err, results)
	{
		var map = Plates.Map();
		map.class('messages').to('messages');
		map.where('title').is('id_game').insert('id_game');
		map.class('title-text').to('title');
		map.class('title-text').use('title_uri').as('href');
		map.class('version-text').to('version');
		map.class('version-text').use('version_uri').as('href');
		map.class('latest_report-text').to('latest_report');
		map.class('message-text').to('message');

		results = results.map(function (row)
		{
			row.latest_report = row.latest_report.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
			row.title_uri = '/temp/recent/game/' + encodeURIComponent(row.id_game);
			row.version_uri = '/temp/recent/version/' + encodeURIComponent(row.version);
			return row;
		});

		res.send(Plates.bind(String(g_server.cache_get('temp_recent.html')), {'messages': results}, map));
	});
}

function temp_recent(req, res)
{
	temp_recent_common({}, req, res);
}

function temp_recent_version(req, res)
{
	temp_recent_common({version: req.params.version}, req, res);
}

function temp_recent_game(req, res)
{
	temp_recent_common({game: req.params.id_game}, req, res);
}