var listing = {};

// Clean up every 10 minutes, expire after 10 minutes.
var UPDATE_INTERVAL = 10 * 60 * 1000;
var TTL_TIMEOUT_S = 10 * 60;
var MAX_PRIV_PER_PUB = 5;
var FUZZ_TIME_MS = 800;

setInterval(cleanup, UPDATE_INTERVAL);

exports.add = function (pub, priv, port, cb)
{
	if (!listing[pub])
		listing[pub] = [];

	if (typeof port == 'string')
		port = parseInt(port, 10);

	// Lose milliseconds to obscure actual time.
	var fuzz = Math.random() * FUZZ_TIME_MS;
	var now = Math.floor((new Date().getTime() + fuzz) / 1000);

	var list = listing[pub];
	var found = false;
	for (var i = 0; i < list.length; ++i)
	{
		if (list[i].ip == priv) {
			list[i].p = port;
			found = true;
			break;
		}
	}

	if (!found)
	{
		list.push({
			ip: priv,
			p: port,
			t: now,
		});

		if (list.length > MAX_PRIV_PER_PUB)
			listing[pub] = list.slice(-5);
	}

	cb(null, !found);
};

exports.get = function (pub, cb)
{
	if (listing[pub])
		cb(null, listing[pub]);
	else
		cb(null, []);
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
	var expire = Math.floor(new Date().getTime() / 1000) - TTL_TIMEOUT_S;
	var i;
	for (i = 0; i < list.length; ++i)
	{
		if (list[i].t < expire)
			break;
	}

	// If we found nothing to expire, i will be >= list.length.
	if (i >= list.length)
		return list;

	// Okay, now let's repopulate.
	var updated = [];
	for (i = 0; i < list.length; ++i)
	{
		if (list[i].t >= expire)
			updated.push(list[i]);
	}
	return updated;
}