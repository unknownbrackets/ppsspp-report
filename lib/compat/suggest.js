'use strict';

const async = require('async');
const pool = require('../db');
const lookups = require('../lookups');

const interestingSettings = [
	'CPUSpeed',
	'CPUIOTimingMethod',
	'GraphicsDisableSlowFramebufEffects',
	'GraphicsTextureBackoffCache',
	'GraphicsTextureSecondaryCache',
	'GraphicsVertexDecCache',
	'GraphicsGPUBackend',
	'GraphicsRenderingMode',
	'GraphicsFrameSkip',
	'GraphicsMemBlockTransferGPU',
];

function formatConfigs(existing, configData, params)
{
	let configs = {};
	let byTitle = {};
	for (let i = 0; i < configData.length; ++i)
	{
		const id_config = configData[i].id_config;
		const title = configData[i].title;
		if (!(id_config in configs))
		{
			configs[id_config] = [];
			byTitle[id_config] = {};
		}

		configData[i].diff = params['config.' + title] !== configData[i].value;
		configs[id_config].push(configData[i]);
		byTitle[id_config][title] = configData[i];
	}

	for (let i = 0; i < existing.length; ++i)
	{
		existing[i].config = configs[existing[i].id_config];
		existing[i].configLookup = byTitle[existing[i].id_config];
	}
	return existing;
}

function scoreExisting(compat)
{
	let score = 0;
	score += compat.same_platform ? 500 : 0;
	score += compat.same_crc ? 60 : 0;
	score += (5 - compat.id_compat_rating) * 30;
	score += compat.graphics_stars * 20;
	score += compat.speed_stars * 20;
	score += compat.gameplay_stars * 20;
	for (let i = 0; i < compat.config; ++i)
		score += compat.config[i].diff === false ? 1 : 0;

	return score;
}

function findBestExisting(existing)
{
	if (!existing)
		return false;

	let best = existing[0];
	let bestScore = 0;
	for (let i = 0; i < existing.length; ++i)
	{
		let score = scoreExisting(existing[i]);
		if (score > bestScore)
			best = existing[i];
	}
	return best;
}

async function checkExisting(params)
{
	const result = await async.auto({
		id_platform: lookups.getPlatformId.bind(this, params.platform),
		id_game: lookups.getGameId.bind(this, params.game, params.game_title),
		id_compat_rating: lookups.getCompatRatingId.bind(this, params.compat),

		existing: [
			'id_platform', 'id_game', 'id_compat_rating',
			async function (args)
			{
				args.crc = safe(params.crc);
				return pool.execute(`
					SELECT
						v.value AS version_value, rc.id_config, rc.id_compat_rating,
						rc.graphics_stars, rc.speed_stars, rc.gameplay_stars,
						rc.id_platform = :id_platform AS same_platform, rc.disc_crc = :crc AS same_crc
					FROM report_compatibility AS rc
						INNER JOIN versions AS v USING (id_version)
					WHERE rc.id_compat_rating < :id_compat_rating
						AND rc.id_game = :id_game
					ORDER BY rc.id_compat DESC`, args);
			}
		],

		configs: [
			'existing',
			async function (args)
			{
				args.configs = args.existing[0].map(e => e.id_config);
				args.configs = Array.from(new Set(args.configs));
				args.interestingSettings = interestingSettings;

				if (args.configs.length === 0)
					return [];

				return pool.query(`
					SELECT cv.id_config, cs.title, cv.value
					FROM config_values AS cv
						INNER JOIN config_settings AS cs USING (id_config_setting)
					WHERE cv.id_config IN (:configs)
						AND cs.title IN (:interestingSettings)`, args);
			}
		],
	});
	if (result.configs.length === 0)
		return [];

	return formatConfigs(result.existing[0], result.configs[0], params);
}

function query(params)
{
	return checkExisting(params).then(existing => {
		let version = lookups.calcVersionValue(safe(params.version));
		let best = findBestExisting(existing);
		if (!best)
			return [];

		// TODO: This doesn't account for default settings so well.
		const isDiff = (setting) => {
			const data = best.configLookup[setting];
			if (data)
				return data.diff;
			else
				return ('config.' + setting) in params;
		};
		const bestConfigIs = (setting, value, def) => {
			const data = best.configLookup[setting];
			const current = data ? data.value : def;
			return String(value) === String(current);
		};
		const myConfigIs = (setting, value, def) => {
			const current = params['config.' + setting] || def;
			return String(value) === String(current);
		};

		let suggestions = [];
		if (version < best.version_value)
			suggestions.push('Upgrade');
		if (!best.same_crc)
			suggestions.push('VerifyDisc');

		if (isDiff('GraphicsRenderingMode'))
			suggestions.push('Config:GraphicsRenderingMode');
		if (isDiff('GraphicsGPUBackend'))
			suggestions.push('Config:GraphicsGPUBackend');
		if (isDiff('GraphicsVertexDecCache'))
			suggestions.push('Config:GraphicsVertexDecCache');
		if (isDiff('GraphicsTextureBackoffCache'))
			suggestions.push('Config:GraphicsTextureBackoffCache');
		if (isDiff('GraphicsTextureSecondaryCache'))
			suggestions.push('Config:GraphicsTextureSecondaryCache');
		if (isDiff('GraphicsDisableSlowFramebufEffects'))
			suggestions.push('Config:GraphicsDisableSlowFramebufEffects');
		if (isDiff('GraphicsMemBlockTransferGPU'))
			suggestions.push('Config:GraphicsMemBlockTransferGPU');
		if (isDiff('GraphicsFrameSkip'))
			suggestions.push('Config:GraphicsFrameSkip');
		if (isDiff('CPUIOTimingMethod'))
			suggestions.push('Config:CPUIOTimingMethod');
		if (!myConfigIs('CPUSpeed', '0', '0') && bestConfigIs('CPUSpeed', '0', '0'))
			suggestions.push('Config:CPUSpeed:0');

		if (suggestions.length === 0 && version > best.version_value)
			suggestions.push('Downgrade');

		return suggestions;
	});
}

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}

module.exports.query = query;
