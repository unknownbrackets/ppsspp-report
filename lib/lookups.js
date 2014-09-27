var limits = require('./limits');
var async = require('async');

var caches = {
	cpu: {},
	gpu: {},
	platform: {},
	version: {},
	game: {},
	kind: {},
	config: {},
};

// Make sure the caches don't get out of control every minute or so.
setInterval(function checkCaches()
{
	// Let's go with a low, safe value for now.
	var MAX_CACHE_SIZE = 500;

	for (var k in caches)
	{
		var size = Object.keys(caches[k]).length;
		if (size > MAX_CACHE_SIZE)
		{
			caches[k] = {};
			console.log('Cleared cache for', k, '(had', size, 'entries.)');
		}
	}
}, 60000);

exports.getVersionId = function (conn, version, cb)
{
	var args = {'version': safe(version).substr(0, limits.VERSION_TITLE_LENGTH)};
	if (args.version in caches.version)
		return cb(null, caches.version[args.version]);

	args.value = exports.calcVersionValue(args.version);
	conn.queryGrab('\
		CALL create_version(:version, :value)', args, function (err, result)
		{
			if (!err)
				caches.version[args.version] = result;
			return cb(err, result);
		});
};

exports.getGameId = function (conn, id_game_unsafe, title, cb)
{
	var args = {
		'id_game': safe(id_game_unsafe).substr(0, limits.GAME_ID_LENGTH),
		'title': safe(title).substr(0, limits.GAME_TITLE_LENGTH)
	};
	if (args.id_game in caches.game)
		return cb(null, caches.game[args.id_game]);

	conn.queryGrab('\
		CALL create_game(:id_game, :title)', args, function (err, result)
		{
			if (!err)
				caches.game[args.id_game] = result;
			return cb(err, result);
		});
};

exports.getMessageKindId = function (conn, message, cb)
{
	var args = {'message': safe(message).substr(0, limits.MESSAGE_KIND_LENGTH)};
	if (args.message in caches.kind)
		return cb(null, caches.kind[args.message]);

	conn.queryGrab('\
		CALL create_report_message_kind(:message)', args, function (err, result)
		{
			if (!err)
				caches.kind[args.message] = result;
			return cb(err, result);
		});
};

exports.getMessageId = function (conn, args, cb)
{
	if (!args.id_game || !args.id_msg_kind)
		return cb(new Error('Invalid arguments'), 0);

	args.formatted_message = safe(args.formatted_message).substr(0, limits.FORMATTED_MESSAGE_LENGTH);
	conn.queryGrab('\
		CALL create_report_message(:id_msg_kind, :id_game, :formatted_message, :id_version)', args, cb);
};

exports.getGpuId = function (conn, gpu, gpu_full, cb)
{
	var args = {
		'short_desc': safe(gpu).substr(0, limits.GPU_SHORT_DESC_LENGTH),
		'long_desc': safe(gpu_full).substr(0, limits.GPU_LONG_DESC_LENGTH),
	};
	var cacheKey = args.short_desc + args.long_desc;
	if (cacheKey in caches.gpu)
		return cb(null, caches.gpu[cacheKey]);

	conn.queryGrab('\
		CALL create_gpu(:short_desc, :long_desc)', args, function (err, result)
		{
			if (!err)
				caches.gpu[cacheKey] = result;
			return cb(err, result);
		});
};

exports.getCpuId = function (conn, cpu, cb)
{
	var args = {
		'summary': safe(cpu).substr(0, limits.CPU_SUMMARY_LENGTH),
	};
	if (args.summary in caches.cpu)
		return cb(null, caches.cpu[args.summary]);

	conn.queryGrab('\
		CALL create_cpu(:summary)', args, function (err, result)
		{
			if (!err)
				caches.cpu[args.summary] = result;
			return cb(err, result);
		});
};

exports.getPlatformId = function (conn, platform, cb)
{
	var args = {
		'title': safe(platform).substr(0, limits.PLATFORM_TITLE_LENGTH),
	};
	if (args.title in caches.platform)
		return cb(null, caches.platform[args.title]);

	conn.queryGrab('\
		CALL create_platform(:title)', args, function (err, result)
		{
			if (!err)
				caches.platform[args.title] = result;
			return cb(err, result);
		});
};

exports.getConfigId = function (conn, parameters, cb)
{
	var values = [];
	var sorted = [];
	for (var k in parameters)
	{
		if (k.substr(0, 7) === 'config.')
		{
			values.push({key: k.substr(7), val: safe(parameters[k])});
			sorted.push(k.substr(7) + "=" + safe(parameters[k]));
		}
	}

	sorted.sort();
	var args = {
		settings: sorted.join("&"),
	};
	if (args.settings in caches.config)
		return cb(null, caches.config[args.settings]);

	conn.queryGrab('\
		CALL create_config(:settings)', args, function (err, result)
		{
			if (!err)
			{
				caches.config[args.settings] = result;

				// Still need to populate the actual settings.
				async.eachSeries(values, function (setting, callback)
				{
					setting.id_config = result;
					conn.queryGrab('\
						CALL set_config_value(:id_config, :key, :val)', setting, callback);
				});
			}
			return cb(err, result);
		});
};

exports.calcVersionValue = function (version)
{
	// For now, assuming a strict format.
	var match = version.match(/^v(\d+)\.(\d+)\.?(\d+)?\.?(\d+)?(?:\.1|\.2|\.3)?[-](\d+)/);
	if (match && match[2])
	{
		if (!match[3])
			match[3] = 0;
		return Number(match[1]) * 1000000 + Number(match[2]) * 100000 + Number(match[3]) * 10000 + Number(match[4]);
	}
	else
		return 0;
}

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}