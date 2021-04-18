'use strict';

const async = require('async');
const bufferEq = require('buffer-equal-constant-time');
const fs = require('fs/promises');
const lookups = require('../lookups');
const pool = require('../db');
const settings = require('../settings');
const { convertImage } = require('./image');

module.exports.addCompat = async function (parameters)
{
	if (settings.isVersionBlocked(safe(parameters.version)))
		throw new Error('Bad version');

	// TODO: Should we reject old versions too?

	if (parameters.verify && parameters.verify != parameters.compat)
		throw new Error('Compat failed verification');

	const invalid_game_id = String(parameters.game).length > 1 && String(parameters.game).substr(-1) === '_';
	const invalid_game_title = String(parameters.game_title).length === 0;
	if (invalid_game_id && invalid_game_title)
		throw new Error('Rejected PPSSSPP v1.11.x path-generated game ID ' + parameters.game);

	let conn = null;
	try
	{
		const result = await async.auto({
			id_version: lookups.getVersionId.bind(this, parameters.version),
			id_gpu: lookups.getGpuId.bind(this, parameters.gpu, parameters.gpu_full),
			id_cpu: lookups.getCpuId.bind(this, parameters.cpu),
			id_platform: lookups.getPlatformId.bind(this, parameters.platform),
			id_game: lookups.getGameId.bind(this, parameters.game, parameters.game_title),
			id_config: lookups.getConfigId.bind(this, parameters),
			id_compat_rating: lookups.getCompatRatingId.bind(this, parameters.compat),

			log_hits: [
				'id_version', 'id_gpu', 'id_cpu', 'id_platform', 'id_game', 'id_config', 'id_compat_rating',
				async function (args)
				{
					conn = await pool.getConnection();

					// TODO: Genre later.
					args.id_genre = 0;
					args.graphics_stars = safe(parameters.graphics);
					args.speed_stars = safe(parameters.speed);
					args.gameplay_stars = safe(parameters.gameplay);
					args.crc = safe(parameters.crc);

					return conn.execute(`
						CALL report_compat_hit(@id_compat, :id_compat_rating, :id_game, :id_version, :id_gpu, :id_cpu, :id_platform, :id_config, 0, :graphics_stars, :speed_stars, :gameplay_stars, :crc)`, args);
				}
			],

			id_compat: [
				'log_hits',
				async function ()
				{
					return conn.executeGrab(`
						SELECT @id_compat`, {});
				}
			],
		});

		if (result.id_compat)
		{
			const shot = parameters.screenshot;
			if (shot && shot.path && shot.size != 0)
				await moveUploaded(shot, result.id_game, 'compat-' + result.id_compat + '.jpg', 'jpg');

			const icon = parameters.icon;
			if (icon && icon.path && icon.size != 0)
				await moveUploadedIcon(icon, result.id_game, 'icon-' + result.id_compat + '.png');
		}
	}
	finally
	{
		if (conn !== null)
			conn.release();
	}
};

async function makeGamePath(upload, id_game)
{
	const gamePath = upload.destination + id_game;
	try
	{
		await fs.mkdir(gamePath);
		return gamePath;
	}
	catch (err)
	{
		// It's okay if it already existed.
		if (err.code == 'EEXIST')
			return gamePath;
		throw err;
	}
}

async function moveUploaded(upload, id_game, basename, type)
{
	try
	{
		const gamePath = await makeGamePath(upload, id_game);
		if (type)
			await convertImage(upload.path, gamePath + '/' + basename, type);
		else
			await fs.rename(upload.path, gamePath + '/' + basename);
	}
	catch (err)
	{
		console.error(err);
	}

	// Always try to get rid of the old file.
	try
	{
		if (type)
			await fs.unlink(upload.path);
	}
	catch (err)
	{
		console.error(err);
	}
}

async function moveUploadedIcon(upload, id_game, basename)
{
	try
	{
		const gamePath = await makeGamePath(upload, id_game);
		const iconPath = gamePath + '/icon.png';
		const safeIconPath = gamePath + '/icon.safe.png';

		try
		{
			// Is our new one the same?  Let's avoid duplicates.
			const existingIconData = await fs.readFile(iconPath);
			const newData = await fs.readFile(upload.path);

			// If it is new, let's save it separately.  We'll sort it out later.
			if (!bufferEq(existingIconData, newData))
				await moveUploaded(upload, id_game, basename, null);
			else
				await fs.unlink(upload.path);
		}
		catch (err)
		{
			// If the iconPath didn't exist, let's put ours in.
			if (err.code == 'ENOENT')
			{
				await fs.rename(upload.path, iconPath);
				await convertImage(iconPath, safeIconPath, 'png');
			}
			else
				throw err;
		}
	}
	catch (err)
	{
		console.error(err);
	}
}

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
