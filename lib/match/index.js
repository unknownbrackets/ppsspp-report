var async = require('async');
var matches = require('./matches');

var g_server;

var validIP = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.get('/match/update', match_update);
};

function match_update(req, res)
{
	var pub_ip = req.headers['X-Real-IP'] || req.ip;
	if (!("local" in req.query))
	{
		res.setHeader('Content-Type', 'application/json');
		res.statusCode = 400;
		res.end(JSON.stringify([]));
	}
	else if (!validIP.test(req.query.local) || !validIP.test(pub_ip))
	{
		res.setHeader('Content-Type', 'application/json');
		res.statusCode = 400;
		res.end(JSON.stringify([]));
	}
	else
	{
		matches.add(pub_ip, req.query.local, function (err)
		{
			matches.get(pub_ip, function (err, list)
			{
				res.setHeader('Content-Type', 'application/json');
				if (err)
				{
					console.log(err);
					res.statusCode = 500;
					res.end(JSON.stringify([]));
				}
				else
					res.end(JSON.stringify(list));
			});
		});
	}
}
