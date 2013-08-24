var mysql = require('mysql');
var async = require('async');
var crypto = require('crypto');

var VERSION_TITLE_LENGTH = 32;
var GAME_TITLE_LENGTH = 255;
var GAME_ID_LENGTH = 18;
var MESSAGE_KIND_LENGTH = 1024;
var FORMATTED_MESSAGE_LENGTH = 4096;
var GPU_SHORT_DESC_LENGTH = 96;
var GPU_LONG_DESC_LENGTH = 16384;
var CPU_SUMMARY_LENGTH = 1024;
var PLATFORM_TITLE_LENGTH = 32;

var pool = mysql.createPool({
	host: process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
	port: process.env.OPENSHIFT_MYSQL_DB_PORT || 3306,
	// TODO: Should this be using a different user?  Must be a better way to securely store this stuff...
	user: process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
	password: process.env.OPENSHIFT_MYSQL_DB_PASSWORD || '',
	database: process.env.OPENSHIFT_MYSQL_DB_NAME || 'ppsspp',
	connectionLimit: 20,
	createConnection: createConnection,
});

var caches = {
	cpu: {},
	gpu: {},
	platform: {},
	version: {},
	game: {},
	kind: {},
};

// Make sure the caches don't get out of control every minute or so.
setInterval(function checkCaches() {
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

module.exports.addMessage = function (conn, parameters, cb)
{
	db(conn, function (err, conn)
	{
		async.auto({
			id_version: getVersionId.bind(this, conn, parameters.version),
			id_gpu: getGpuId.bind(this, conn, parameters.gpu, parameters.gpu_full),
			id_cpu: getCpuId.bind(this, conn, parameters.cpu),
			id_platform: getPlatformId.bind(this, conn, parameters.platform),
			id_game: getGameId.bind(this, conn, parameters.game, parameters.game_title),
			id_msg_kind: getMessageKindId.bind(this, conn, parameters.message),

			id_msg: [
				'id_version', 'id_gpu', 'id_cpu', 'id_platform', 'id_game', 'id_msg_kind',
				function (cb, args)
				{
					args.formatted_message = parameters.value;
					getMessageId(conn, args, cb);
				}
			],

			log_hits: [
				'id_msg',
				function (cb, args)
				{
					async.series({
						id_version: addMessageHit.bind(this, conn, 'report_message_versions', 'id_version', args),
						id_gpu: addMessageHit.bind(this, conn, 'report_message_gpus', 'id_gpu', args),
						id_cpu: addMessageHit.bind(this, conn, 'report_message_cpus', 'id_cpu', args),
						id_platform: addMessageHit.bind(this, conn, 'report_message_platforms', 'id_platform', args),
					}, cb);
				}
			]
		}, function (err, result)
		{
			conn.end();
			cb(err, result);
		});
	});
};

module.exports.getRecentMessageList = function (conn, args, cb)
{
	var clauses = [];

	if (args.status != undefined)
	{
		switch (args.status)
		{
		case "any":
			break;

		case "new":
		case "resolved":
		case "reoccurring":
			clauses.push("m.status IN ('" + args.status + "')");
			break;

		default:
			clauses.push("m.status IN ('new', 'reoccurring')");
		}
	}
	else
		clauses.push("m.status IN ('new', 'reoccurring')");

	if (args.id_game != undefined)
		clauses.push('g.id_game = ' + mysql.escape(args.id_game));
	if (args.version != undefined)
		clauses.push('v.title = ' + mysql.escape(args.version));
	if (args.id_msg_kind != undefined)
		clauses.push('m.id_msg_kind = ' + mysql.escape(args.id_msg_kind));

	var needsMaxCheck = clauses.length == 0 || (!args.status && clauses.length <= 1);

	db(conn, function (err, conn)
	{
		// TODO: Could simply cache this.
		conn.queryGrab('\
			SELECT MAX(id_msg) \
			FROM report_messages', {}, function (err, max_id_msg)
		{
			if (needsMaxCheck)
				clauses.push('m.id_msg > :max_id_msg - 1000');

			var where = '';
			if (clauses.length == 1)
				where = 'WHERE ' + clauses[0];
			else if (clauses.length > 1)
				where = 'WHERE ' + clauses.join(' AND ');

			conn.query('\
				SELECT \
					g.title, g.id_game, MAX(v.title) AS version, v.id_version, m.id_msg_kind, \
					m.formatted_message AS message, MAX(mv.latest_report) AS latest_report, \
					mk.message AS message_template \
				FROM report_messages AS m \
					INNER JOIN games AS g USING (id_game) \
					INNER JOIN report_message_kinds AS mk USING (id_msg_kind) \
					INNER JOIN report_message_versions AS mv USING (id_msg) \
					INNER JOIN versions AS v USING (id_version) \
				' + where + ' \
				GROUP BY m.id_msg DESC \
				LIMIT 100', {max_id_msg: max_id_msg}, function (err, result)
				{
					conn.end();
					cb(err, result);
				});
		});
	});
};

function calcVersionValue(version)
{
	// For now, assuming a strict format.
	var match = version.match(/^v(\d+)\.(\d+)\.?(\d+)?-(\d+)/);
	if (match && match[2])
	{
		if (!match[3])
			match[3] = 0;
		return Number(match[1]) * 1000000 + Number(match[2]) * 100000 + Number(match[3]) * 10000 + Number(match[4]);
	}
	else
		return 0;
}

function addMessageHit(conn, table, id_col, args, cb)
{
	conn.query('\
		INSERT INTO ' + table + ' \
			(id_msg, ' + id_col + ', first_report, latest_report) \
		VALUES (:id_msg, :' + id_col + ', NOW(), NOW()) \
			ON DUPLICATE KEY UPDATE \
				latest_report = NOW(), \
				hits = hits + 1', args,
		cb);
}

function getVersionId(conn, version, cb)
{
	var args = {'version': safe(version).substr(0, VERSION_TITLE_LENGTH)};
	if (args.version in caches.version)
		return cb(null, caches.version[args.version]);

	args.value = calcVersionValue(args.version);
	conn.queryGrab('\
		CALL create_version(:version, :value)', args, function (err, result)
		{
			if (!err)
				caches.version[args.version] = result;
			return cb(err, result);
		});
}

function getGameId(conn, id_game_unsafe, title, cb)
{
	var args = {
		'id_game': safe(id_game_unsafe).substr(0, GAME_ID_LENGTH),
		'title': safe(title).substr(0, GAME_TITLE_LENGTH)
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
}

function getMessageKindId(conn, message, cb)
{
	var args = {'message': safe(message).substr(0, MESSAGE_KIND_LENGTH)};
	if (args.message in caches.kind)
		return cb(null, caches.kind[args.message]);

	conn.queryGrab('\
		CALL create_report_message_kind(:message)', args, function (err, result)
		{
			if (!err)
				caches.kind[args.message] = result;
			return cb(err, result);
		});
}

function getMessageId(conn, args, cb)
{
	if (!args.id_game || !args.id_msg_kind)
		return cb(new Error('Invalid arguments'), 0);

	args.formatted_message = safe(args.formatted_message).substr(0, FORMATTED_MESSAGE_LENGTH);
	conn.queryGrab('\
		CALL create_report_message(:id_msg_kind, :id_game, :formatted_message, :id_version)', args, cb);
}

function getGpuId(conn, gpu, gpu_full, cb)
{
	var args = {
		'short_desc': safe(gpu).substr(0, GPU_SHORT_DESC_LENGTH),
		'long_desc': safe(gpu_full).substr(0, GPU_LONG_DESC_LENGTH),
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
}

function getCpuId(conn, cpu, cb)
{
	var args = {
		'summary': safe(cpu).substr(0, CPU_SUMMARY_LENGTH),
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
}

function getPlatformId(conn, platform, cb)
{
	var args = {
		'title': safe(platform).substr(0, PLATFORM_TITLE_LENGTH),
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
}

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}

function db(conn, cb)
{
	if (conn)
		cb(null, conn);
	else
		pool.getConnection(cb);
}

function createConnection(info)
{
	var conn = mysql.createConnection(info);
	conn.config.queryFormat = queryFormat;
	conn.on('error', function (err)
	{
		console.log(err);
		conn.destroy();
	});
	conn.queryFirst = function (str, values, cb)
	{
		this.query(str, values, function (err, result)
		{
			if (!err)
			{
				if (result.length == 0)
					result = false;
				// If this is the result of a call, result[0] will be an array.
				else if (Array.isArray(result[0]))
					result = result[0].length != 0 ? result[0][0] : false;
				else
					result = result[0];
			}
			cb(err, result);
		});
	};
	conn.queryGrab = function (str, values, cb)
	{
		this.query(str, values, function (err, result)
		{
			if (!err)
			{
				if (result.length == 0 || (Array.isArray(result[0]) && result[0].length == 0))
					result = false;
				else
				{
					// If this is the result of a call, result[0] will be an array.
					var result0 = Array.isArray(result[0]) ? result[0][0] : result[0];
					var keys = Object.keys(result0);
					result = keys.length != 0 ? result0[keys[0]] : false;
				}
			}
			cb(err, result);
		});
	};
	return conn;
}

function queryFormat(query, values)
{
	if (!values)
		return query;

	return query.replace(/\:(\w+)/g, function (txt, key)
	{
		if (values.hasOwnProperty(key))
			return this.escape(values[key]);
	    return txt;
	}.bind(this));
}