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

	if (args.game != undefined)
		clauses.push('g.id_game = ' + mysql.escape(args.game));
	if (args.version != undefined)
		clauses.push('v.title = ' + mysql.escape(args.version));
	if (args.id_msg_kind != undefined)
		clauses.push('m.id_msg_kind = ' + mysql.escape(args.id_msg_kind));

	var where = '';
	if (clauses.length == 1)
		where = 'WHERE ' + clauses[0];
	else if (clauses.length > 1)
		where = 'WHERE ' + clauses.join(' AND ');

	db(conn, function (err, conn)
	{
		conn.query('\
			SELECT \
				g.title, g.id_game, MAX(v.title) AS version, v.id_version, m.id_msg_kind, \
				m.formatted_message AS message, MAX(mv.latest_report) AS latest_report \
			FROM report_messages AS m \
				INNER JOIN games AS g USING (id_game) \
				INNER JOIN report_message_versions AS mv USING (id_msg) \
				INNER JOIN versions AS v USING (id_version) \
			' + where + ' \
			GROUP BY m.id_msg DESC \
			LIMIT 100', function (err, result)
			{
				conn.end();
				cb(err, result);
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
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_version \
		FROM versions \
		WHERE title = :version', args);

	grab(function (err, id_version)
		{
			if (id_version !== false)
				return cb(err, id_version);

			args.value = calcVersionValue(args.version);
			conn.query('\
				INSERT IGNORE INTO versions \
					(title, value) \
				VALUES (:version, :value)', args,
				function (err, result)
				{
					grab(cb);
				});
		});
}

function getGameId(conn, id_game_unsafe, title, cb)
{
	var args = {
		'id_game': safe(id_game_unsafe).substr(0, GAME_ID_LENGTH),
		'title': safe(title).substr(0, GAME_TITLE_LENGTH)
	};
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_game \
		FROM games \
		WHERE id_game = :id_game', args);

	grab(function (err, id_game)
		{
			if (id_game !== false)
				return cb(err, id_game);

			conn.query('\
				INSERT IGNORE INTO games \
					(id_game, title) \
				VALUES (:id_game, :title)', args,
				function (err, result)
				{
					grab(cb);
				});
		});
}

function getMessageKindId(conn, message, cb)
{
	var args = {'message': safe(message).substr(0, MESSAGE_KIND_LENGTH)};
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_msg_kind \
		FROM report_message_kinds \
		WHERE hash = UNHEX(SHA1(:message)) \
			AND message = :message \
		ORDER BY id_msg_kind \
		LIMIT 1', args);

	grab(function (err, id_msg_kind)
		{
			if (id_msg_kind !== false)
				return cb(err, id_msg_kind);

			// Unfortunately, this could create duplicates.
			// We'll consistently select the right one, though, so they can be
			// garbage collected later.
			conn.query('\
				INSERT IGNORE INTO report_message_kinds \
					(message, hash) \
				VALUES (:message, UNHEX(SHA1(:message)))', args,
				function (err, result)
				{
					grab(cb);
				});
		});
}

function getMessageId(conn, args, cb)
{
	if (!args.id_game || !args.id_msg_kind)
		return cb(new Error('Invalid arguments'), 0);

	args.formatted_message = safe(args.formatted_message).substr(0, FORMATTED_MESSAGE_LENGTH);

	// Want status too, so we can fix it.
	conn.queryFirst('\
		SELECT id_msg, status \
		FROM report_messages \
		WHERE id_msg_kind = :id_msg_kind \
			AND id_game = :id_game \
			AND formatted_hash = UNHEX(SHA1(:formatted_message)) \
			AND formatted_message = :formatted_message \
		LIMIT 1', args,
		function (err, result)
		{
			if (err)
				return cb(err, 0);

			if (result !== false)
			{
				if (result.status == 'resolved')
				{
					args.id_msg = result.id_msg;
					args.status = 'reoccurring';
					// Warning: not really a join.  Just want the id_version's value.
					conn.query('\
						UPDATE report_messages AS m \
							INNER JOIN versions AS v \
						SET m.status = :status \
						WHERE m.id_msg = :id_msg \
							AND v.id_version = :id_version \
							AND v.value > m.resolved_version_value', args,
						function (err, result)
						{
							cb(err, result.id_msg);
						});
				}
				else
					cb(err, result.id_msg);

				return;
			}

			conn.query('\
				INSERT IGNORE INTO report_messages \
					(id_msg_kind, id_game, formatted_hash, formatted_message) \
				VALUES (:id_msg_kind, :id_game, UNHEX(SHA1(:formatted_message)), :formatted_message)', args,
				function (err, result)
				{
					if (err)
						return cb(err, 0);

					conn.queryGrab('\
						SELECT id_msg \
						FROM report_messages \
						WHERE id_msg_kind = :id_msg_kind \
							AND id_game = :id_game \
							AND formatted_hash = UNHEX(SHA1(:formatted_message)) \
							AND formatted_message = :formatted_message \
						LIMIT 1', args, cb);
				});
		});
}

function getGpuId(conn, gpu, gpu_full, cb)
{
	var args = {
		'short_desc': safe(gpu).substr(0, GPU_SHORT_DESC_LENGTH),
		'long_desc': safe(gpu_full).substr(0, GPU_LONG_DESC_LENGTH),
		'hash_str': safe(gpu) + safe(gpu_full)
	};
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_gpu \
		FROM gpus \
		WHERE short_desc = :short_desc \
			AND long_desc = :long_desc \
			AND hash = UNHEX(SHA1(:hash_str))', args);

	grab(function (err, id_gpu)
		{
			if (id_gpu !== false)
				return cb(err, id_gpu);

			conn.query('\
				INSERT IGNORE INTO gpus \
					(short_desc, long_desc, hash) \
				VALUES (:short_desc, :long_desc, UNHEX(SHA1(:hash_str)))', args,
				function (err, result)
				{
					grab(cb);
				});
		});
}

function getCpuId(conn, cpu, cb)
{
	var args = {
		'summary': safe(cpu).substr(0, CPU_SUMMARY_LENGTH),
	};
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_cpu \
		FROM cpus \
		WHERE summary = :summary \
			AND hash = UNHEX(SHA1(:summary))', args);

	grab(function (err, id_cpu)
		{
			if (id_cpu !== false)
				return cb(err, id_cpu);

			conn.query('\
				INSERT IGNORE INTO cpus \
					(summary, hash) \
				VALUES (:summary, UNHEX(SHA1(:summary)))', args,
				function (err, result)
				{
					grab(cb);
				});
		});
}

function getPlatformId(conn, platform, cb)
{
	var args = {
		'title': safe(platform).substr(0, PLATFORM_TITLE_LENGTH),
	};
	var grab = conn.queryGrab.bind(conn, '\
		SELECT id_platform \
		FROM platforms \
		WHERE title = :title', args);

	grab(function (err, id_platform)
		{
			if (id_platform !== false)
				return cb(err, id_platform);

			conn.query('\
				INSERT IGNORE INTO platforms \
					(title) \
				VALUES (:title)', args,
				function (err, result)
				{
					grab(cb);
				});
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
				result = result.length != 0 ? result[0] : false;
			cb(err, result);
		});
	};
	conn.queryGrab = function (str, values, cb)
	{
		this.query(str, values, function (err, result)
		{
			if (!err)
			{
				if (result.length != 0)
				{
					var keys = Object.keys(result[0]);
					result = keys.length != 0 ? result[0][keys[0]] : false;
				}
				else
					result = false;
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