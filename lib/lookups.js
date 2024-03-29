const async = require('async');
const db = require('./db');
const limits = require('./limits');

let caches = {
	cpu: {},
	gpu: {},
	platform: {},
	version: {},
	game: {},
	kind: {},
	config: {},
};

// Make sure the caches don't get out of control every minute or so.
const intervalID = setInterval(function checkCaches()
{
	// Let's go with a low, safe value for now.
	const MAX_CACHE_SIZE = 500;

	for (let k in caches)
	{
		const size = Object.keys(caches[k]).length;
		if (size > MAX_CACHE_SIZE)
		{
			caches[k] = {};
			console.log('Cleared cache for', k, '(had', size, 'entries.)');
		}
	}
}, 60000);
db.onEnd(() => clearInterval(intervalID));

exports.getVersionId = async function (version)
{
	let args = {'version': safe(version).substr(0, limits.VERSION_TITLE_LENGTH)};
	if (args.version in caches.version)
		return caches.version[args.version];

	args.value = exports.calcVersionValue(args.version);
	const result = await db.executeGrab(`
		CALL create_version(:version, :value)`, args);

	caches.version[args.version] = result;
	return result;
};

exports.getGameId = async function (id_game_unsafe, title, module_name, module_crc)
{
	let args = {
		'id_game': safe(id_game_unsafe).substr(0, limits.GAME_ID_LENGTH),
		'title': safe(title).substr(0, limits.GAME_TITLE_LENGTH),
		'module_name': safe(module_name).substr(0, limits.MODULE_NAME_LENGTH),
		'module_crc': safe(module_crc, '0'),
	};
	if (args.id_game in caches.game)
	{
		if (caches.game[args.id_game] === '')
			throw new Error('Homebrew without version ignored');
		return caches.game[args.id_game];
	}

	const result = await db.executeGrab(`
		CALL create_game_crc(:id_game, :title, :module_name, :module_crc)`, args);

	caches.game[args.id_game] = result;
	if (result === '')
		throw new Error('Homebrew without version ignored');
	return result;
};

exports.getMessageKindId = async function (message)
{
	let args = {'message': safe(message).substr(0, limits.MESSAGE_KIND_LENGTH)};
	if (args.message in caches.kind)
		return caches.kind[args.message];

	const result = await db.executeGrab(`
		CALL create_report_message_kind(:message)`, args);

	caches.kind[args.message] = result;
	return result;
};

exports.getMessageId = async function (args)
{
	if (!args.id_game || !args.id_msg_kind)
		throw new Error('Invalid arguments');

	args.formatted_message = safe(args.formatted_message).substr(0, limits.FORMATTED_MESSAGE_LENGTH);
	return db.executeGrab(`
		CALL create_report_message(:id_msg_kind, :id_game, :formatted_message, :id_version)`, args);
};

exports.getGpuId = async function (gpu, gpu_full)
{
	let args = {
		'short_desc': safe(gpu).substr(0, limits.GPU_SHORT_DESC_LENGTH),
		'long_desc': safe(gpu_full).substr(0, limits.GPU_LONG_DESC_LENGTH),
	};
	args.nickname = exports.calcGpuNickname(args.short_desc, args.long_desc);
	if (!args.nickname)
		args.nickname = args.short_desc;
	args.nickname = String(args.nickname).substr(0, limits.GPU_NICKNAME_LENGTH);

	const cacheKey = args.short_desc + args.long_desc;
	if (cacheKey in caches.gpu)
		return caches.gpu[cacheKey];

	const result = await db.executeFirst(`
		CALL create_gpu(:short_desc, :long_desc, :nickname)`, args);

	caches.gpu[cacheKey] = result.v_id_gpu;
	if (!result.existed)
	{
		const exts = exports.calcGpuExtensions(args.long_desc);
		await async.eachSeries(exts, async function (ext)
		{
			const ext_args = { ext, id_gpu: result.v_id_gpu };
			await db.executeGrab(`
				CALL create_gpu_extension(:id_gpu, :ext)`, ext_args);
			return true;
		});
	}

	return result.v_id_gpu;
};

exports.getCpuId = async function (cpu)
{
	const args = {
		'summary': safe(cpu).substr(0, limits.CPU_SUMMARY_LENGTH),
	};
	if (args.summary in caches.cpu)
		return caches.cpu[args.summary];

	const result = await db.executeGrab(`
		CALL create_cpu(:summary)`, args);

	caches.cpu[args.summary] = result;
	return result;
};

exports.getPlatformId = async function (platform)
{
	const args = {
		'title': safe(platform).substr(0, limits.PLATFORM_TITLE_LENGTH),
	};
	if (args.title in caches.platform)
		return caches.platform[args.title];

	const result = await db.executeGrab(`
		CALL create_platform(:title)`, args);

	caches.platform[args.title] = result;
	return result;
};

const defaultConfig = {
	'GraphicsHardwareTessellation': 'false',
	'JITDiscardRegsOnJRRA': 'false',
	'GraphicsTrueColor': 'true',
	'GraphicsMipMap': 'true',
	'GraphicsReplaceTextures': 'true',
	'GraphicsSaveNewTextures': 'false',
	'GraphicsDisableStencilTest': 'false',
	'GraphicsAlwaysDepthWrite': 'false',
	'GraphicsBloomHack': '0',
	'GraphicsMemBlockTransferGPU': 'true',
	'GraphicsDisableSlowFramebufEffects': 'false',
	'GraphicsFragmentTestCache': 'true',
	'GraphicsSoftwareSkinning': 'true',
	// The new default, at least.
	'GraphicsVertexCache': 'false',
	'SpeedHacksDisableAlphaTest': 'false',
	'SpeedHacksPrescaleUV': 'true',
	'SpeedHacksPrescaleUVCoords': 'true',
};

const renamedConfig = {
	'GraphicsBackend': 'GPUBackend',
	'VertexDecCache' : 'VertexCache',
};

exports.getConfigId = async function (parameters)
{
	let values = [];
	let sorted = [];
	for (let k in parameters)
	{
		if (k.substr(0, 7) === 'config.' && k != 'config.GraphicsFrameRate' && k != 'config.GraphicsBackground')
		{
			let key = k.substr(7);
			let val = safe(parameters[k]);

			// Try to keep renamed settings the same.
			if (key in renamedConfig)
				key = renamedConfig[key];

			// Skip values that match our defaults to reduce churn between versions.
			if (!(key in defaultConfig) || defaultConfig[key] != val) {
				values.push({ key, val });
				sorted.push(key + "=" + val);
			}
		}
	}

	sorted.sort();
	const args = {
		settings: sorted.join('&'),
	};
	if (args.settings in caches.config)
		return caches.config[args.settings];

	const result = await db.executeGrab(`
		CALL create_config(:settings)`, args);

	caches.config[args.settings] = result;

	// Still need to populate the actual settings.
	await async.eachSeries(values, async function (setting)
	{
		setting.id_config = result;
		await db.executeGrab(`
			CALL set_config_value(:id_config, :key, :val)`, setting);
		return true;
	});

	return result;
};

exports.getCompatRatingId = async function (rating)
{
	// Probably not worth getting from the db.
	if (rating == 'perfect')
		return 1;
	if (rating == 'playable')
		return 2;
	if (rating == 'ingame')
		return 3;
	if (rating == 'menu')
		return 4;
	if (rating == 'none')
		return 5;

	throw new Error('Unknown rating: ' + rating);
};

exports.calcVersionValue = function (version)
{
	// For now, assuming a strict format.
	let match = version.match(/^v(\d+)\.(\d+)\.?(\d+)?\.?(\d+)?(?:\.1|\.2|\.3)?[-](\d+)/);
	if (!match) {
		match = version.match(/^v(\d+)\.(\d+)\.?(\d+)?\.?(\d+)?(?:\.1|\.2|\.3)?$/);
	}
	if (match && match[2])
	{
		if (!match[3])
			match[3] = 0;
		if (match[5])
			match[4] = Number(match[5]) + (match[4] ? match[4] * 100 : 0);
		if (!match[4])
			match[4] = 0;
		return Number(match[1]) * 10000000 + Number(match[2]) * 100000 + Number(match[3]) * 10000 + Number(match[4]);
	}
	else
		return 0;
};

exports.calcGpuNickname = function (short_desc, long_desc)
{
	if (long_desc.indexOf('Chainfire3D') != -1 || long_desc.indexOf('NVIDIA Adreno') != -1 || short_desc == 'PowerVR' || long_desc.indexOf('NVIDIA VideoCore') != -1 || long_desc.indexOf('NVIDIA PowerVR') != -1 || long_desc.indexOf('Qualcomm Mali') != -1 | long_desc.indexOf('NVIDIA Mali') != -1 || long_desc.indexOf('Qualcomm PowerVR') != -1)
		return 'Chainfire3D';
	if (long_desc.indexOf('BlueStacks') != -1)
		return 'BlueStacks';

	// There have been some weird doubling up of parameters.
	const fix_match = short_desc.match(/^([^,]+)(,\1)+$/);
	if (fix_match)
		short_desc = fix_match[1];

	// The parens confuse us.
	long_desc = long_desc.replace('(R)', '\xAE');
	long_desc = long_desc.replace('(C)', '\xA9');
	long_desc = long_desc.replace(' (TM)', '\u2122');
	long_desc = long_desc.replace('(TM)', '\u2122');
	long_desc = long_desc.replace('(CUDA 2)', 'CUDA 2');
	long_desc = long_desc.replace('(CUDA)', 'CUDA');
	long_desc = long_desc.replace(/[ ]{2,}/g, ' ');

	let m;
	if (short_desc == 'NVIDIA Corporation')
	{
		m = long_desc.match(/^([0-9.]+) \(NVIDIA Corporation ([^/]+)\//);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9.]+) NVIDIA[- ]([0-9. bf]+) \(NVIDIA Corporation ([^/]+)\//);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) NVIDIA[- ]([0-9. bf]+) \(NVIDIA Corporation ([^/]+) OpenGL Engine/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(NVIDIA Corporation (NVIDIA [^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] (?:build )?[0-9.@]+) \(NVIDIA Corporation (NVIDIA [^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'ATI Technologies Inc.')
	{
		m = long_desc.match(/^([0-9.]+) Compatibility Profile Context(?: FireGL)? \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9.]+) Compatibility Profile Context(?: FireGL)? ([0-9.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+ (?:FireGL|BETA|Release|WinXP Release|FireGL Release)) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9.]+ (?:FireGL|BETA|Release|WinXP Release|FireGL Release)) ([0-9.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9.]+ ATI-[0-9.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Vivante Corporation')
	{
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]) \(Vivante Corporation ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'ARM')
	{
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] build [0-9.\-@]+) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] Spreadtrum Build) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] v[0-9a-z.\-@]+) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Qualcomm')
	{
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9] ?V@[0-9.]+ AU@[0-9.]*[^(]+\(CL@[0-9]*\)) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? ?V@[0-9.]+ [^Q]+) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? (?:AU_LINUX_ANDROID_[A-Z_]+[0-9.]+)?\s+\(CL[0-9]*\)) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? [0-9.]+) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
	}
	else if (short_desc == 'Intel Corporation')
	{
		m = long_desc.match(/^([0-9.]+) \(Intel Corporation ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Intel')
	{
		m = long_desc.match(/^([0-9.]+) - (Build (?:cl)?[0-9.-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [0-9.]+) - (Build (?:cl)?[0-9.-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) - (Build CL-[0-9.-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [0-9.]+) - (Build CL-[0-9.-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) (INTEL-[0-9.]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
	}
	else if (short_desc == 'Google Inc.')
	{
		m = long_desc.match(/^OpenGL (ES [0-9.]+) \((ANGLE [0-9.]+)\) \(Google Inc. ANGLE \((.+? Direct3D[^)]+)\)/);
		if (m)
			return m[2] + ' ' + m[1] + ' ' + m[3];
	}
	else if (short_desc == 'Apple Inc.')
	{
		m = long_desc.match(/^OpenGL (ES [0-9.]+) Apple A[0-9] GPU - ([0-9.]+) \(Apple Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
	}
	else if (short_desc == 'Intel Inc.')
	{
		m = long_desc.match(/^([0-9.]+) - (Build [0-9.]+) \(Intel Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) (INTEL-[0-9.]+) \(Intel Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9.]+) (APPLE-[0-9.]+) \(Intel Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
	}
	else if (short_desc == 'Intel Open Source Technology Center' || short_desc == 'X.Org' || short_desc == 'Tungsten Graphics, Inc' || short_desc == 'VMware, Inc.' || short_desc == 'X.Org R300 Project' || short_desc == 'nouveau')
	{
		m = long_desc.match(new RegExp('^([0-9\\.]+ Mesa [0-9\\.]+(?:-devel|-rc[0-9]+)?(?: \\(git-[0-9a-f]+[^)]+\\))?) \\(' + short_desc.replace('.', '\\.') + ' ([^)]+)\\)'));
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(new RegExp('^OpenGL (ES [0-9\\.]+ Mesa [0-9\\.]+(?:-devel|-rc[0-9]+)?(?: \\(git-[0-9a-f]+[^)]+\\))?) \\(' + short_desc.replace('.', '\\.') + ' ([^)]+)\\)'));
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	// There have been some mis-transmissions, let's just catch them.
	else if (short_desc == 'Imagination Technologies' || (short_desc.substr(0, 2) == 'Im' && short_desc.length > 64))
	{
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] build (?:MAIN)?[0-9.@RCJB]+) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] IMGSGX[0-9.@-]+) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9.]+) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Marvell Technology Group Ltd')
	{
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(Marvell Technology Group Ltd ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Hisilicon Technologies')
	{
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(Hisilicon Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Broadcom')
	{
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(Broadcom ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}

	return null;
};

exports.calcGpuExtensions = function (long_desc)
{
	const match = safe(long_desc).match(/\(extensions: (.+)\)/);
	if (!match || !match[1])
		return [];

	const names = match[1].split(/\s+/);
	return names.filter(function (name)
	{
		return name != '';
	});
};

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
