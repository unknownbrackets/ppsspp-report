var pool = require('../db');

module.exports.getGameData = function (parameters, cb)
{
	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, []);

		conn.queryFirst('\
			SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars \
			FROM games AS g \
				LEFT JOIN compatibility AS cmp USING (id_game) \
				LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating) \
			WHERE g.id_game = :id_game \
			LIMIT 5', parameters, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};

module.exports.getReports = function (parameters, cb)
{
	var clauses = [
		"rcmp.id_game = :id_game",
	];

	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, []);

		var makeWhere = function (additional)
		{
			var where = '';
			var all = clauses.concat(additional || []);
			if (all.length === 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		};

		parameters.offset = (parameters.page - 1) * 50;
		conn.query('\
			SELECT \
				cmpr.title AS compat, cmpr.identifier AS compat_ident, cpu.summary AS cpu, \
				gpu.nickname AS gpu, p.title AS platform, v.title AS version, \
				rcmp.latest_report, rcmp.graphics_stars, rcmp.speed_stars, rcmp.gameplay_stars, \
				rcmp.id_config, rcmp.disc_crc, rcmp.id_compat \
			FROM report_compatibility AS rcmp \
				LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating) \
				INNER JOIN cpus AS cpu USING (id_cpu) \
				INNER JOIN gpus AS gpu USING (id_gpu) \
				INNER JOIN platforms AS p USING (id_platform) \
				INNER JOIN versions AS v USING (id_version) \
			' + makeWhere() + ' \
			ORDER BY rcmp.latest_report DESC \
			LIMIT :offset, 50', parameters, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};

module.exports.getReportCount = function (parameters, cb)
{
	var clauses = [
		"rcmp.id_game = :id_game",
	];

	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, 0);

		var makeWhere = function (additional)
		{
			var where = '';
			var all = clauses.concat(additional || []);
			if (all.length === 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		};

		conn.queryGrab('\
			SELECT COUNT(rcmp.id_compat) AS c \
			FROM report_compatibility AS rcmp \
				INNER JOIN cpus AS cpu USING (id_cpu) \
				INNER JOIN gpus AS gpu USING (id_gpu) \
				INNER JOIN platforms AS p USING (id_platform) \
				INNER JOIN versions AS v USING (id_version) \
			' + makeWhere(), parameters, function (err, c)
		{
			conn.release();
			cb(err, c);
		});
	});
};

module.exports.getOtherVersions = function (parameters, cb)
{
	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, []);

		conn.query(`
			SELECT
				g.id_game, g.title, cmpr.title AS compat, cmpr.identifier AS compat_ident,
				cmp.overall_stars
			FROM games AS g
				INNER JOIN game_families AS f1 USING (id_game)
				INNER JOIN game_families AS f2 USING (id_game_primary)
				LEFT JOIN compatibility AS cmp
					ON cmp.id_game = g.id_game
				LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating)
			WHERE f2.id_game = :id_game
			ORDER BY g.id_game`, parameters, function (err, results)
			{
				conn.release();
				cb(err, results);
			});
	});
};

module.exports.getGenres = function (parameters, cb) {
	pool.getConnection(function (err, conn) {
		if (err)
			return cb(err, []);

		conn.query(`
			SELECT gr.title
			FROM genres AS gr
				INNER JOIN game_genres AS ggr USING (id_genre)
			WHERE ggr.id_game = :id_game
			ORDER BY gr.id_genre`, parameters, function (err, results) {
				conn.release();
				cb(err, results ? results.map(r => r.title) : results);
			});
	});
};

module.exports.getConfigs = function (config_ids, cb)
{
	if (config_ids.length === 0)
		return cb(null, {});

	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, []);

		conn.query('\
			SELECT id_config, title, value \
			FROM config_values \
				INNER JOIN config_settings USING (id_config_setting) \
			WHERE id_config IN (:config_ids)', {config_ids: config_ids}, function (err, results)
		{
			conn.release();

			var configs = {};
			if (results)
			{
				for (var i = 0; i < results.length; ++i)
				{
					var result = results[i];
					if (!(result.id_config in configs))
						configs[result.id_config] = {};

					configs[result.id_config][result.title] = result.value;
				}
			}

			cb(err, configs);
		});
	});
};
