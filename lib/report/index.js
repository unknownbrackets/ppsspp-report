var data = require('./data');
var Plates = require('plates');

var g_server;

module.exports.addRoutes = function (server)
{
	g_server = server;
	server.app.post('/report/message', report_message);
	server.app.get('/temp/recent', temp_recent);
};

function report_message(req, res)
{
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.send('1');

	data.addMessage(null, req.body, function (err)
	{
	});
}

function temp_recent(req, res)
{
	res.setHeader('Content-Type', 'text/html; charset=utf-8');

	data.getRecentMessageList(null, function (err, results)
	{
		var map = Plates.Map();
		map.class('messages').to('messages');
		map.where('title').is('id_game').insert('id_game');
		if (results.length)
		{
			for (var k in results[0])
				map.class(k).to(k);
		}
		res.send(Plates.bind(String(g_server.cache_get('temp_recent.html')), {'messages': results}, map));
	});
}