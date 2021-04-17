'use strict';

const matches = require('./matches');
const { Address4, Address6 } = require('ip-address');

const validPort = /^[0-9]{4,5}$/;
const private4a = new Address4('10.0.0.0/8');
const private4b = new Address4('172.16.0.0/12');
const private4c = new Address4('192.168.0.0/16');
const private6 = new Address6('fc00::/7');

exports.addRoutes = function (server)
{
	server.app.get('/match/update', match_update);
	server.app.get('/match/list', match_list);
};

function getRawPublicIP(req)
{
	return req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.ip;
}

function getPublicIP(req)
{
	const ip = getRawPublicIP(req);
	try
	{
		const ip4 = new Address4(ip);
		return ip4.correctForm();
	}
	catch (e)
	{
		// Ignore, try ipv6.
	}

	try
	{
		const ip6 = new Address6(ip);
		if (ip6.is4())
			return ip6.to4();
		if (ip6.isTeredo())
		{
			const teredo = ip6.inspectTeredo();
			return teredo.client4;
		}

		return ip6.getBitsBase16(0, 64);
	}
	catch (e)
	{
		// Nothing to it.
		return null;
	}
}

function getLocalIP(req)
{
	if (!('local' in req.query))
		return null;

	const ip = req.query.local;
	try
	{
		const ip4 = new Address4(ip);
		if (ip4.isInSubnet(private4a) || ip4.isInSubnet(private4b) || ip4.isInSubnet(private4c))
			return ip;
	}
	catch (e)
	{
		// Ignore, try ipv6.
	}

	try
	{
		const ip6 = new Address6(ip);
		if (ip6.isInSubnet(private6))
			return ip;

		const pub = getRawPublicIP(req);
		if (pub && ip6.isInSubnet(new Address6(pub + '/64')))
			return ip;
	}
	catch (e)
	{
		// Nothing to it.  We don't have a valid local IP.
	}

	return null;
}

async function match_update(req, res)
{
	try
	{
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');

		const pub_ip = getPublicIP(req);
		const local_ip = getLocalIP(req);
		if (!('local' in req.query) || !('port' in req.query))
			res.status(400).end(JSON.stringify([]));
		else if (!local_ip || !pub_ip || !validPort.test(req.query.port))
			res.status(400).end(JSON.stringify([]));
		else
		{
			await matches.add(pub_ip, req.query.local, req.query.port);
			const list = await matches.get(pub_ip);

			res.end(JSON.stringify(list));
		}
	}
	catch (err)
	{
		console.error(err);
		res.status(500).end(JSON.stringify([]));
	}
}

async function match_list(req, res)
{
	try
	{
		res.setHeader('Content-Type', 'application/json');
		res.setHeader('Access-Control-Allow-Origin', '*');

		const pub_ip = getPublicIP(req);
		if (!pub_ip)
			res.status(400).end(JSON.stringify([]));
		else
		{
			const list = await matches.get(pub_ip);
			res.end(JSON.stringify(list));
		}
	}
	catch (err)
	{
		console.error(err);
		res.status(500).end(JSON.stringify([]));
	}
}
