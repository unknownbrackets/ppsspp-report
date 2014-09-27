var async = require('async');
var pool = require('../db');
var settings = require('../settings');
var limits = require('../limits');
var lookups = require('../lookups');

module.exports.addCompat = function (parameters, cb)
{
	var min_ver = settings.value('min_version_value');
	if (min_ver)
	{
		var value = lookups.calcVersionValue(safe(parameters.version).substr(0, limits.VERSION_TITLE_LENGTH));
		// TODO: Should we reject old versions?
		//if (value < min_ver)
		//	return cb(null, null);
	}

	pool.getConnection(function (err, conn)
	{
		async.auto({
			id_version: lookups.getVersionId.bind(this, conn, parameters.version),
			id_gpu: lookups.getGpuId.bind(this, conn, parameters.gpu, parameters.gpu_full),
			id_cpu: lookups.getCpuId.bind(this, conn, parameters.cpu),
			id_platform: lookups.getPlatformId.bind(this, conn, parameters.platform),
			id_game: lookups.getGameId.bind(this, conn, parameters.game, parameters.game_title),
			id_config: lookups.getConfigId.bind(this, conn, parameters),
			id_compat_rating: lookups.getCompatRatingId.bind(this, conn, parameters.compat),

			log_hits: [
				'id_version', 'id_gpu', 'id_cpu', 'id_platform', 'id_game', 'id_config', 'id_compat_rating',
				function (cb, args)
				{
					// TODO: Genre later.
					args.id_genre = 0;
					args.graphics_stars = safe(parameters.graphics);
					args.speed_stars = safe(parameters.speed);
					args.gameplay_stars = safe(parameters.gameplay);
					conn.query('\
						CALL report_compat_hit(:id_compat_rating, :id_game, :id_version, :id_gpu, :id_cpu, :id_platform, :id_config, 0, :graphics_stars, :speed_stars, :gameplay_stars)', args, cb);
				}
			]
		}, function (err, result)
		{
			conn.release();
			cb(err, result);
		});
	});
};

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
