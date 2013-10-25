var pool = require('./db');

// Update every 30 minutes.
var UPDATE_INTERVAL = 30 * 60 * 1000;

var cache = {};

refresh();
setInterval(refresh, UPDATE_INTERVAL);

function refresh()
{
	pool.getConnection(function (err, conn)
	{
		conn.queryFirst('\
			SELECT * \
			FROM settings', null, function (err, result)
			{
				if (!err)
					cache = result;
				conn.end();
			});
	});
}

module.exports.value = function (key)
{
	if (key in cache)
		return cache[key];
	return null;
};