const pool = require('./db');

// Update every 30 minutes.
const UPDATE_INTERVAL = 30 * 60 * 1000;

let cache = {};

refresh();
const intervalID = setInterval(refresh, UPDATE_INTERVAL);
pool.onEnd(() => clearInterval(intervalID));

async function refresh()
{
	try
	{
		const result = await pool.executeFirst(`
			SELECT *
			FROM settings`, null);
		cache = result;
	}
	catch (err)
	{
		console.error('Error updating settings', err);
	}

}

function value(key)
{
	if (key in cache)
		return cache[key];
	return null;
}

function isVersionBlocked(version)
{
	const blocked = String(value('blocked_version_strings')).split(',');
	return blocked.indexOf(String(version)) != -1;
}

module.exports.value = value;
module.exports.isVersionBlocked = isVersionBlocked;
