'use strict';

const async = require('async');
const bufferEq = require('buffer-equal-constant-time');
const fs = require('fs');
const pool = require('../db');
const settings = require('../settings');
const limits = require('../limits');
const lookups = require('../lookups');
const { convertImage } = require('./image');

module.exports.addCompat = function (parameters, cb)
{
	if (settings.isVersionBlocked(safe(parameters.version)))
	{
		return cb(null, false);
	}

	var min_ver = settings.value('min_version_value');
	if (min_ver)
	{
		var value = lookups.calcVersionValue(safe(parameters.version).substr(0, limits.VERSION_TITLE_LENGTH));
		// TODO: Should we reject old versions?
		//if (value < min_ver)
		//	return cb(null, false);
	}

	if (parameters.verify && parameters.verify != parameters.compat)
	{
		console.log('Compat failed verification');
		return cb(null, false);
	}

	const invalid_game_id = String(parameters.game).length > 1 && String(parameters.game).substr(-1) === '_';
	const invalid_game_title = String(parameters.game_title).length === 0;
	if (invalid_game_id && invalid_game_title)
	{
		console.log('Rejected game', parameters.game);
		return cb(null, false);
	}

	pool.getConnection(function (err, conn)
	{
		if (err)
			return cb(err, false);

		async.auto({
			id_version: lookups.getVersionId.bind(this, parameters.version),
			id_gpu: lookups.getGpuId.bind(this, parameters.gpu, parameters.gpu_full),
			id_cpu: lookups.getCpuId.bind(this, parameters.cpu),
			id_platform: lookups.getPlatformId.bind(this, parameters.platform),
			id_game: lookups.getGameId.bind(this, parameters.game, parameters.game_title),
			id_config: lookups.getConfigId.bind(this, parameters),
			id_compat_rating: lookups.getCompatRatingId.bind(this, parameters.compat),

			log_hits: [
				'id_version', 'id_gpu', 'id_cpu', 'id_platform', 'id_game', 'id_config', 'id_compat_rating',
				function (args, cb)
				{
					// TODO: Genre later.
					args.id_genre = 0;
					args.graphics_stars = safe(parameters.graphics);
					args.speed_stars = safe(parameters.speed);
					args.gameplay_stars = safe(parameters.gameplay);
					args.crc = safe(parameters.crc);
					conn.query('\
						CALL report_compat_hit(@id_compat, :id_compat_rating, :id_game, :id_version, :id_gpu, :id_cpu, :id_platform, :id_config, 0, :graphics_stars, :speed_stars, :gameplay_stars, :crc)', args, cb);
				}
			],

			id_compat: [
				'log_hits',
				function (hits, cb)
				{
					conn.queryGrab('\
						SELECT @id_compat', {}, cb);
				}
			],
		}, function (err, result)
		{
			if (!err && result.id_compat)
			{
				var shot = parameters.screenshot;
				if (shot && shot.path && shot.size != 0)
					moveUploaded(shot, result.id_game, 'compat-' + result.id_compat + '.jpg', 'jpg');

				var icon = parameters.icon;
				if (icon && icon.path && icon.size != 0)
					moveUploadedIcon(icon, result.id_game, 'icon-' + result.id_compat + '.png');
			}

			conn.release();
			cb(err, result);
		});
	});
};

function makeGamePath(upload, id_game, success, cb)
{
	var gamePath = upload.destination + id_game;
	fs.mkdir(gamePath, function (err)
	{
		if (!err || err.code == 'EEXIST')
			success(gamePath, cb);
		else
			cb(err);
	});
}

function moveUploaded(upload, id_game, basename, type)
{
	makeGamePath(upload, id_game, function (gamePath, cb)
	{
		if (type)
		{
			convertImage(upload.path, gamePath + '/' + basename, type, function (err)
			{
				if (err)
					return cb(err);
				fs.unlink(upload.path, cb);
			});
		}
		else
			fs.rename(upload.path, gamePath + '/' + basename, cb);
	}, function (err)
	{
		if (err)
			console.log(err);
	});
}

function moveUploadedIcon(upload, id_game, basename)
{
	makeGamePath(upload, id_game, function (gamePath, cb)
	{
		const iconPath = gamePath + '/icon.png';
		const safeIconPath = gamePath + '/icon.safe.png';
		fs.readFile(iconPath, function (err, masterData)
		{
			if (err)
			{
				// Doesn't exist?  Okay, this is the new icon, then.
				if (err.code == 'ENOENT')
					fs.rename(upload.path, iconPath, function (err)
					{
						if (err)
							return cb(err);
						convertImage(iconPath, safeIconPath, 'png', cb);
					});
				else
					cb(err);
			}
			else
			{
				// Is our new one the same?  Let's avoid duplicates.
				fs.readFile(upload.path, function (err, newData)
				{
					if (err)
						return cb(err);

					// If it is new, let's save it separately.  We'll sort it out later.
					if (!bufferEq(masterData, newData))
					{
						moveUploaded(upload, id_game, basename, null);
						cb(null);
					}
					else
						fs.unlink(upload.path, cb);
				});
			}
		});
	}, function (err)
	{
		if (err)
			console.log(err);
	});
}

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
