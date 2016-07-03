var async = require('async');
var matches = require('./matches');

var g_server;

var validIP = /^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/;
var validPort = /^[0-9]{4,5}$/;

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.get('/match/update', match_update);
	g_server.app.get('/match/list', match_list);
};

function match_update(req, res)
{
	var pub_ip = req.headers['x-real-ip'] || req.ip;
	if (!('local' in req.query) || !('port' in req.query))
	{
		res.setHeader('Content-Type', 'application/json');
		res.status(400).end(JSON.stringify([]));
	}
	else if (!validIP.test(req.query.local) || !validIP.test(pub_ip) || !validPort.test(req.query.port))
	{
		res.setHeader('Content-Type', 'application/json');
		res.status(400).end(JSON.stringify([]));
	}
	else
	{
		matches.add(pub_ip, req.query.local, req.query.port, function (err)
		{
			matches.get(pub_ip, function (err, list)
			{
				res.setHeader('Content-Type', 'application/json');
				if (err)
				{
					console.log(err);
					res.status(500).end(JSON.stringify([]));
				}
				else
					res.end(JSON.stringify(list));
			});
		});
	}
}

function match_list(req, res)
{
	var pub_ip = req.headers['x-real-ip'] || req.ip;
	if (!validIP.test(pub_ip))
	{
		res.setHeader('Content-Type', 'application/json');
		res.status(400).end(JSON.stringify([]));
	}
	else
	{
		matches.get(pub_ip, function (err, list)
		{
			res.setHeader('Content-Type', 'application/json');
			if (err)
			{
				console.log(err);
				res.status(500).end(JSON.stringify([]));
			}
			else
				res.end(JSON.stringify(list));
		});
	}
}
