'use strict';

var async = require('async');
var matches = require('./matches');
const Address4 = require('ip-address').Address4;
const Address6 = require('ip-address').Address6;

var g_server;

var validPort = /^[0-9]{4,5}$/;
const private4a = new Address4('10.0.0.0/8');
const private4b = new Address4('172.16.0.0/12');
const private4c = new Address4('192.168.0.0/16');
const private6 = new Address6('fc00::/7');

exports.addRoutes = function (server)
{
	g_server = server;

	g_server.app.get('/match/update', match_update);
	g_server.app.get('/match/list', match_list);
};

function getPublicIP(req)
{
	const ip = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip;
	const ip4 = new Address4(ip);
	if (ip4.isValid())
		return ip4.correctForm();

	const ip6 = new Address6(ip);
	if (!ip6.isValid())
		return null;
	if (ip6.is4())
		return ip6.to4();
	if (ip6.isTeredo())
	{
		const teredo = ip6.inspectTeredo();
		return teredo.client4;
	}

	return ip6.getBitsBase16(0, 64);
}

function getLocalIP(req)
{
	if (!('local' in req.query))
		return null;

	const ip = req.query.local;
	const ip4 = new Address4(ip);
	if (ip4.isValid())
	{
		if (ip4.isInSubnet(private4a) || ip4.isInSubnet(private4b) || ip4.isInSubnet(private4c))
			return ip;
	}

	const ip6 = new Address6(ip);
	if (ip6.isValid())
	{
		if (ip6.isInSubnet(private6))
			return ip;
	}

	return null;
}

function match_update(req, res)
{
	const pub_ip = getPublicIP(req);
	const local_ip = getLocalIP(req);
	if (!('local' in req.query) || !('port' in req.query))
	{
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).end(JSON.stringify([]));
	}
	else if (!local_ip || !pub_ip || !validPort.test(req.query.port))
	{
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).end(JSON.stringify([]));
	}
	else
	{
		matches.add(pub_ip, req.query.local, req.query.port, function (err)
		{
			matches.get(pub_ip, function (err, list)
			{
				res.setHeader('Content-Type', 'application/json');
				res.setHeader('Access-Control-Allow-Origin', '*');
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
	const pub_ip = getPublicIP(req);
	if (!pub_ip)
	{
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.status(400).end(JSON.stringify([]));
	}
	else
	{
		matches.get(pub_ip, function (err, list)
		{
			res.setHeader('Content-Type', 'application/json');
			res.setHeader('Access-Control-Allow-Origin', '*');
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
