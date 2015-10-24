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
	if (!("local" in req.query))
	{
		res.setHeader('Content-Type', 'application/json');
		res.statusCode = 400;
		res.end(JSON.stringify([]));
	}
	else if (!validIP.test(req.query.local) || !validIP.test(req.ip))
	{
		res.setHeader('Content-Type', 'application/json');
		res.statusCode = 400;
		res.end(JSON.stringify([]));
	}
	else
	{
		matches.add(req.ip, req.query.local, function (err)
		{
			matches.get(req.ip, function (err, list)
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
