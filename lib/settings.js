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
				conn.release();
			});
	});
}

function value(key)
{
	if (key in cache)
		return cache[key];
	return null;
}

function isVersionBlocked(version)
{
	var blocked = String(value('blocked_version_strings')).split(',');
	return blocked.indexOf(String(version)) != -1;
}

module.exports.value = value;
module.exports.isVersionBlocked = isVersionBlocked;
