var mysql = require('mysql');
var async = require('async');
var crypto = require('crypto');

var pool = mysql.createPool({
	host: process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
	port: process.env.OPENSHIFT_MYSQL_DB_PORT || 3306,
	// TODO: Should this be using a different user?  Must be a better way to securely store this stuff...
	user: process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
	password: process.env.OPENSHIFT_MYSQL_DB_PASSWORD || '',
	database: process.env.OPENSHIFT_MYSQL_DB_NAME || 'ppsspp',
	connectionLimit: 20,
});

module.exports.addMessage = function (conn, parameters, cb)
{
	db(conn, function (err, conn)
	{
		async.series({
			id_version: getVersionId.bind(this, conn, parameters.version),
			id_game: getGameId.bind(this, conn, parameters.game, parameters.game_title),
			id_msg_kind: getMessageKindId.bind(this, conn, parameters.message),
		}, function (err, args)
		{
			args.formatted_message = parameters.value;
			getMessageId(conn, args, function (err, result)
			{
				args.id_msg = result;

				conn.query('\
					INSERT INTO report_message_versions \
						(id_msg, id_version, first_report, latest_report) \
					VALUES (:id_msg, :id_version, NOW(), NOW()) \
						ON DUPLICATE KEY UPDATE \
							latest_report = NOW(), \
							hits = hits + 1', args,
					function (err, result)
					{
						conn.end();
						cb(err);
					});
			})
		});
	});
};

module.exports.getRecentMessageList = function (conn, args, cb)
{
	var clauses = [];
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

function getVersionId(conn, version, cb)
{
	var args = {'version': version};

	conn.query('\
		SELECT id_version \
		FROM versions \
		WHERE title = :version', args,
		function (err, result)
		{
			if (result[0] && result[0].id_version)
			{
				cb(err, result[0].id_version);
				return;
			}

			args.value = calcVersionValue(version);

			conn.query('\
				INSERT IGNORE INTO versions \
					(title, value) \
				VALUES (:version, :value)', args,
				function (err, result)
				{
					getVersionId(conn, version, cb);
				});
		});
}

function getGameId(conn, id_game, title, cb)
{
	var args = {'id_game': id_game, 'title': title};

	conn.query('\
		SELECT id_game \
		FROM games \
		WHERE id_game = :id_game', args,
		function (err, result)
		{
			if (result[0] && result[0].id_game)
			{
				cb(err, result[0].id_game);
				return;
			}

			conn.query('\
				INSERT IGNORE INTO games \
					(id_game, title) \
				VALUES (:id_game, :title)', args,
				function (err, result)
				{
					cb(err, id_game);
				});
		});
}

function getMessageKindId(conn, message, cb)
{
	var args = {'message': message};

	conn.query('\
		SELECT id_msg_kind \
		FROM report_message_kinds \
		WHERE hash = UNHEX(SHA1(:message)) \
			AND message = :message \
		ORDER BY id_msg_kind \
		LIMIT 1', args,
		function (err, result)
		{
			if (result[0] && result[0].id_msg_kind)
			{
				cb(err, result[0].id_msg_kind);
				return;
			}

			// Unfortunately, this could create duplicates.
			// We'll consistently select the right one, though, so they can be
			// garbage collected later.
			conn.query('\
				INSERT IGNORE INTO report_message_kinds \
					(message, hash) \
				VALUES (:message, UNHEX(SHA1(:message)))', args,
				function (err, result)
				{
					getMessageKindId(conn, message, cb);
				});
		});
}

function getMessageId(conn, args, cb)
{
	conn.query('\
		SELECT id_msg \
		FROM report_messages \
		WHERE id_msg_kind = :id_msg_kind \
			AND id_game = :id_game \
			AND formatted_hash = UNHEX(SHA1(:formatted_message)) \
			AND formatted_message = :formatted_message', args,
		function (err, result)
		{
			if (result[0] && result[0].id_msg)
			{
				cb(err, result[0].id_msg);
				return;
			}

			conn.query('\
				INSERT IGNORE INTO report_messages \
					(id_msg_kind, id_game, formatted_hash, formatted_message) \
				VALUES (:id_msg_kind, :id_game, UNHEX(SHA1(:formatted_message)), :formatted_message)', args,
				function (err, result)
				{
					getMessageId(conn, args, cb);
				});
		});
}

function db(conn, cb)
{
	if (conn)
		cb(null, conn);
	else
		pool.getConnection(function (err, conn)
		{
			if (!err)
			{
				conn.config.queryFormat = queryFormat;
				conn.on('error', function (err)
				{
					console.log(err);
					conn.destroy();
				});
			}

			cb(err, conn);
		});
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