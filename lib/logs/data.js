const mysql = require('mysql2');
const async = require('async');
const pool = require('../db');
const settings = require('../settings');
const limits = require('../limits');
const lookups = require('../lookups');

module.exports.addMessage = async function (parameters)
{
	if (settings.isVersionBlocked(parameters.version))
		return null;

	const min_ver = settings.value('min_version_value');
	if (min_ver)
	{
		const value = lookups.calcVersionValue(safe(parameters.version).substr(0, limits.VERSION_TITLE_LENGTH));
		// Reject older versions right away.  Just noise.
		if (value < min_ver)
			return null;
	}

	if (parameters.verify && parameters.verify != parameters.message + parameters.value)
	{
		console.log('Message failed verification');
		return null;
	}

	const invalid_game_id = String(parameters.game).length > 1 && String(parameters.game).substr(-1) === '_';
	const invalid_game_title = String(parameters.game_title).length === 0;
	if (invalid_game_id && invalid_game_title)
	{
		console.log('Rejected game', parameters.game);
		return null;
	}

	return async.auto({
		id_version: lookups.getVersionId.bind(this, parameters.version),
		id_gpu: lookups.getGpuId.bind(this, parameters.gpu, parameters.gpu_full),
		id_cpu: lookups.getCpuId.bind(this, parameters.cpu),
		id_platform: lookups.getPlatformId.bind(this, parameters.platform),
		id_game: lookups.getGameId.bind(this, parameters.game, parameters.game_title, parameters.module_name, parameters.module_crc),
		id_msg_kind: lookups.getMessageKindId.bind(this, parameters.message),
		id_config: lookups.getConfigId.bind(this, parameters),

		id_msg: [
			'id_version', 'id_gpu', 'id_cpu', 'id_platform', 'id_game', 'id_config', 'id_msg_kind',
			async function (args)
			{
				args.formatted_message = parameters.value;
				return lookups.getMessageId(args);
			}
		],

		log_hits: [
			'id_msg',
			function (args, cb)
			{
				pool.execute(`
					CALL report_message_hit(:id_msg, :id_version, :id_gpu, :id_cpu, :id_platform, :id_config)`, args).then(() => cb(), cb);
			}
		]
	});
};

module.exports.getRecentMessageList = async function (args)
{
	let tempClauses = [];
	let tempJoins = [];
	let needsTempDistinct = false;
	let clauses = [];
	let queryArgs = {};

	switch (args.status)
	{
	case 'any':
		break;

	case 'new':
	case 'resolved':
	case 'reoccurring':
		clauses.push("m.status IN ('" + args.status + "')");
		break;

	default:
		clauses.push("m.status IN ('new', 'reoccurring')");
	}

	if (args.id_game !== undefined)
	{
		// Force a temp table, the index usage for this path is not great.
		// MySQL uses a temp table anyway, but not as well as we can.
		tempClauses.push('m.id_game = :id_game');
		queryArgs.id_game = args.id_game;
	}
	if (args.version !== undefined)
	{
		tempClauses.push('v.title = :version');
		queryArgs.version = args.version;
		needsTempDistinct = true;
		tempJoins.push('INNER JOIN report_message_versions AS mv USING (id_msg)');
		tempJoins.push('INNER JOIN versions AS v USING (id_version)');
	}
	if (args.id_msg_kind !== undefined) {
		clauses.push('m.id_msg_kind = :id_msg_kind');
		queryArgs.id_msg_kind = args.id_msg_kind;
	}
	if (args.id_platform !== undefined)
	{
		tempClauses.push('mp.id_platform = :id_platform');
		queryArgs.id_platform = args.id_platform;
		needsTempDistinct = true;
		tempJoins.push('INNER JOIN report_message_platforms AS mp USING (id_msg)');
	}
	if (args.id_cpu !== undefined)
	{
		tempClauses.push('mc.id_cpu = :id_cpu');
		queryArgs.id_cpu = args.id_cpu;
		needsTempDistinct = true;
		tempJoins.push('INNER JOIN report_message_cpus AS mc USING (id_msg)');
	}
	if (args.id_gpu !== undefined)
	{
		tempClauses.push('mg.id_gpu = :id_gpu');
		queryArgs.id_gpu = args.id_gpu;
		needsTempDistinct = true;
		tempJoins.push('INNER JOIN report_message_gpus AS mg USING (id_msg)');
	}

	const needsMaxCheck = (clauses.length == 0 && tempClauses.length == 0) || (!args.status && (clauses.length + tempClauses.length) <= 1);

	// Use a consistent connection for a temp table.
	const conn = await pool.getConnection();
	try
	{
		let extraJoinSQL = '';

		const makeWhere = function (additional)
		{
			let where = '';
			const all = clauses.concat(additional || []);
			if (all.length == 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		};

		if (needsMaxCheck)
		{
			// TODO: Could simply cache this.
			const max_id_msg = await conn.executeGrab(`
				SELECT MAX(id_msg)
				FROM report_messages`, {});
			clauses.push('m.id_msg > :max_id_msg - 1000');
			queryArgs.max_id_msg = max_id_msg;
		}
		// The purpose of this is to reduce the set it's looking at for the other joins.
		else if (tempClauses.length)
		{
			// Gotta drop it first in case another page view left it hanging.
			await conn.execute(`
				DROP TEMPORARY TABLE IF EXISTS temp_messages`);
			await conn.execute(`
				CREATE TEMPORARY TABLE temp_messages (
					PRIMARY KEY (id_msg)
				)
				SELECT ${needsTempDistinct ? 'DISTINCT ' : ''}m.id_msg
				FROM report_messages AS m ${tempJoins.join(`
					`)}
				${makeWhere(tempClauses)}
				ORDER BY m.id_msg DESC
				LIMIT 300`, queryArgs);

			extraJoinSQL = 'INNER JOIN temp_messages USING (id_msg)';
		}

		const [results] = await conn.query(`
			SELECT
				g.title, g.id_game, MAX(v.title) AS version, MAX(v.id_version) AS id_version,
				m.id_msg_kind, m.formatted_message AS message,
				MAX(mv.latest_report) AS latest_report,
				(
					SELECT GROUP_CONCAT(p.title SEPARATOR ', ')
					FROM platforms AS p
						INNER JOIN report_message_platforms AS mp USING (id_platform)
					WHERE mp.id_msg = m.id_msg${(args.id_platform !== undefined ? `
						AND mp.id_platform = :id_platform` : '')}
				) AS platforms,
				(
					SELECT GROUP_CONCAT(cpus.summary SEPARATOR ', ')
					FROM cpus
						INNER JOIN report_message_cpus AS mc USING (id_cpu)
					WHERE mc.id_msg = m.id_msg${(args.id_cpu !== undefined ? `
						AND mc.id_cpu = :id_cpu` : '')}
				) AS cpus,
				(
					SELECT GROUP_CONCAT(gpus.nickname SEPARATOR ', ')
					FROM gpus
						INNER JOIN report_message_gpus AS mg USING (id_gpu)
					WHERE mg.id_msg = m.id_msg${(args.id_gpu !== undefined ? `
						AND mg.id_gpu = :id_gpu` : '')}
				) AS gpus,
				mk.message AS message_template
			FROM report_messages AS m
				${extraJoinSQL}
				INNER JOIN games AS g USING (id_game)
				INNER JOIN report_message_kinds AS mk USING (id_msg_kind)
				INNER JOIN report_message_versions AS mv USING (id_msg)
				INNER JOIN versions AS v USING (id_version)
				INNER JOIN report_message_platforms AS mp USING (id_msg)
			${makeWhere()}
			GROUP BY m.id_msg
			ORDER BY m.id_msg DESC
			LIMIT 100`, queryArgs);
		return results;
	}
	finally
	{
		conn.release();
	}
};

module.exports.getKindList = async function (args)
{
	let clauses = [];

	switch (args.status)
	{
	case 'any':
		break;

	case 'new':
	case 'resolved':
	case 'reoccurring':
		clauses.push("m.status IN (:status)");
		break;

	default:
		clauses.push("m.status IN ('new', 'reoccurring')");
	}

	// Use a consistent connection for a temp table.
	const conn = await pool.getConnection();
	try
	{
		const makeWhere = function (additional)
		{
			let where = '';
			const all = clauses.concat(additional || []);
			if (all.length == 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		};

		// Gotta drop it first in case another page view left it hanging.
		await conn.execute(`
			DROP TEMPORARY TABLE IF EXISTS temp_messages`);
		await conn.execute(`
			CREATE TEMPORARY TABLE temp_messages
			SELECT DISTINCT m.id_msg_kind, m.id_game
			FROM report_messages AS m
			${makeWhere()}`, args);

		const [results] = await conn.query(`
			SELECT mk.id_msg_kind, mk.message, COUNT(m.id_game) AS games
			FROM report_message_kinds AS mk
				INNER JOIN temp_messages AS m USING (id_msg_kind)
			GROUP BY mk.id_msg_kind
			ORDER BY mk.id_msg_kind DESC
			LIMIT 2000`, null);
		return results;
	}
	finally
	{
		conn.release();
	}
};

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
