'use strict';

let listing = {};

// Clean up every 10 minutes, expire after 10 minutes.
const UPDATE_INTERVAL = 10 * 60 * 1000;
const TTL_TIMEOUT_S = 10 * 60;
const MAX_PRIV_PER_PUB = 10;
const FUZZ_TIME_MS = 800;

setInterval(cleanup, UPDATE_INTERVAL);

exports.add = async function (pub, priv, port)
{
	if (!listing[pub])
		listing[pub] = [];

	if (typeof port == 'string')
		port = parseInt(port, 10);

	// Lose milliseconds to obscure actual time.
	const fuzz = Math.random() * FUZZ_TIME_MS;
	const now = Math.floor((new Date().getTime() + fuzz) / 1000);

	let list = listing[pub];
	let found = false;
	for (let i = 0; i < list.length; ++i)
	{
		if (list[i].ip == priv)
		{
			list[i].p = port;
			list[i].t = now;
			found = true;
			break;
		}
	}

	if (!found)
	{
		let len = list.unshift({
			ip: priv,
			p: port,
			t: now,
		});

		if (len > MAX_PRIV_PER_PUB)
			listing[pub] = list.slice(0, MAX_PRIV_PER_PUB);
	}

	return !found;
};

exports.get = async function (pub)
{
	if (listing[pub])
		return listing[pub];
	else
		return [];
};

function cleanup()
{
	Object.keys(listing).forEach(function(pub)
	{
		listing[pub] = cleanupList(listing[pub]);
		if (!listing[pub])
			delete listing[pub];
	});
}

function cleanupList(list)
{
	const expire = Math.floor(new Date().getTime() / 1000) - TTL_TIMEOUT_S;
	let i;
	for (i = 0; i < list.length; ++i)
	{
		if (list[i].t < expire)
			break;
	}

	// If we found nothing to expire, i will be >= list.length.
	if (i >= list.length)
		return list;

	// Okay, now let's repopulate.
	let updated = [];
	for (i = 0; i < list.length; ++i)
	{
		if (list[i].t >= expire)
			updated.push(list[i]);
	}
	return updated;
}
