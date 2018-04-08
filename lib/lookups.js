var limits = require('./limits');
var async = require('async');

var caches = {
	cpu: {},
	gpu: {},
	platform: {},
	version: {},
	game: {},
	kind: {},
	config: {},
};

// Make sure the caches don't get out of control every minute or so.
setInterval(function checkCaches()
{
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

exports.getVersionId = function (conn, version, cb)
{
	var args = {'version': safe(version).substr(0, limits.VERSION_TITLE_LENGTH)};
	if (args.version in caches.version)
		return cb(null, caches.version[args.version]);

	args.value = exports.calcVersionValue(args.version);
	conn.queryGrab('\
		CALL create_version(:version, :value)', args, function (err, result)
		{
			if (!err)
				caches.version[args.version] = result;
			return cb(err, result);
		});
};

exports.getGameId = function (conn, id_game_unsafe, title, cb)
{
	var args = {
		'id_game': safe(id_game_unsafe).substr(0, limits.GAME_ID_LENGTH),
		'title': safe(title).substr(0, limits.GAME_TITLE_LENGTH)
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
};

exports.getMessageKindId = function (conn, message, cb)
{
	var args = {'message': safe(message).substr(0, limits.MESSAGE_KIND_LENGTH)};
	if (args.message in caches.kind)
		return cb(null, caches.kind[args.message]);

	conn.queryGrab('\
		CALL create_report_message_kind(:message)', args, function (err, result)
		{
			if (!err)
				caches.kind[args.message] = result;
			return cb(err, result);
		});
};

exports.getMessageId = function (conn, args, cb)
{
	if (!args.id_game || !args.id_msg_kind)
		return cb(new Error('Invalid arguments'), 0);

	args.formatted_message = safe(args.formatted_message).substr(0, limits.FORMATTED_MESSAGE_LENGTH);
	conn.queryGrab('\
		CALL create_report_message(:id_msg_kind, :id_game, :formatted_message, :id_version)', args, cb);
};

exports.getGpuId = function (conn, gpu, gpu_full, cb)
{
	var args = {
		'short_desc': safe(gpu).substr(0, limits.GPU_SHORT_DESC_LENGTH),
		'long_desc': safe(gpu_full).substr(0, limits.GPU_LONG_DESC_LENGTH),
	};
	args.nickname = exports.calcGpuNickname(args.short_desc, args.long_desc);
	if (!args.nickname)
		args.nickname = args.short_desc;
	args.nickname = String(args.nickname).substr(0, 128);

	var cacheKey = args.short_desc + args.long_desc;
	if (cacheKey in caches.gpu)
		return cb(null, caches.gpu[cacheKey]);

	var addExtensions = function (id_gpu)
	{
		var exts = exports.calcGpuExtensions();

		async.eachSeries(exts, function (ext, callback)
		{
			var ext_args = {ext: ext, id_gpu: id_gpu};
			conn.queryFirst('\
				CALL create_gpu_extension(:id_gpu, :ext)', ext_args, callback);
		}, function (err, results)
		{
			return cb(err, id_gpu);
		});
	};

	conn.queryFirst('\
		CALL create_gpu(:short_desc, :long_desc, :nickname)', args, function (err, result)
		{
			if (!err)
				caches.gpu[cacheKey] = result.v_id_gpu;

			if (!err && !result.existed)
				addExtensions(result.v_id_gpu);
			else
				return cb(err, result ? result.v_id_gpu : undefined);
		});
};

exports.getCpuId = function (conn, cpu, cb)
{
	var args = {
		'summary': safe(cpu).substr(0, limits.CPU_SUMMARY_LENGTH),
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
};

exports.getPlatformId = function (conn, platform, cb)
{
	var args = {
		'title': safe(platform).substr(0, limits.PLATFORM_TITLE_LENGTH),
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
	'SpeedHacksDisableAlphaTest': 'false',
	'SpeedHacksPrescaleUV': 'true',
	'SpeedHacksPrescaleUVCoords': 'true',
};

const renamedConfig = {
	'GraphicsBackend': 'GPUBackend',
	'VertexDecCache' : 'VertexCache',
};

exports.getConfigId = function (conn, parameters, cb)
{
	var values = [];
	var sorted = [];
	for (var k in parameters)
	{
		if (k.substr(0, 7) === 'config.' && k != 'config.GraphicsFrameRate' && k != 'config.GraphicsBackground')
		{
			var key = k.substr(7);
			var val = safe(parameters[k]);

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
	var args = {
		settings: sorted.join('&'),
	};
	if (args.settings in caches.config)
		return cb(null, caches.config[args.settings]);

	conn.queryGrab('\
		CALL create_config(:settings)', args, function (err, result)
		{
			if (!err)
			{
				caches.config[args.settings] = result;

				// Still need to populate the actual settings.
				async.eachSeries(values, function (setting, callback)
				{
					setting.id_config = result;
					conn.queryGrab('\
						CALL set_config_value(:id_config, :key, :val)', setting, callback);
				});
			}
			return cb(err, result);
		});
};

exports.getCompatRatingId = function (conn, rating, cb)
{
	// Probably not worth getting from the db.
	if (rating == 'perfect')
		return cb(null, 1);
	if (rating == 'playable')
		return cb(null, 2);
	if (rating == 'ingame')
		return cb(null, 3);
	if (rating == 'menu')
		return cb(null, 4);
	if (rating == 'none')
		return cb(null, 5);

	return cb('Unknown rating: ' + rating, 0);
};

exports.calcVersionValue = function (version)
{
	// For now, assuming a strict format.
	var match = version.match(/^v(\d+)\.(\d+)\.?(\d+)?\.?(\d+)?(?:\.1|\.2|\.3)?[-](\d+)/);
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
	var fix_match = short_desc.match(/^([^,]+)(,\1)+$/);
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

	var m;
	if (short_desc == 'NVIDIA Corporation')
	{
		m = long_desc.match(/^([0-9\.]+) \(NVIDIA Corporation ([^\/]+)\//);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9\.]+) NVIDIA[- ]([0-9\. bf]+) \(NVIDIA Corporation ([^\/]+)\//);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) NVIDIA[- ]([0-9\. bf]+) \(NVIDIA Corporation ([^\/]+)\ OpenGL Engine/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9]) \(NVIDIA Corporation (NVIDIA [^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] (?:build )?[0-9\.@]+) \(NVIDIA Corporation (NVIDIA [^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'ATI Technologies Inc.')
	{
		m = long_desc.match(/^([0-9\.]+) Compatibility Profile Context(?: FireGL)? \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9\.]+) Compatibility Profile Context(?: FireGL)? ([0-9\.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+ (?:FireGL|BETA|Release|WinXP Release|FireGL Release)) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9\.]+ (?:FireGL|BETA|Release|WinXP Release|FireGL Release)) ([0-9\.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9\.]+ ATI-[0-9\.]+) \(ATI Technologies Inc\. ([^)]+)\)/);
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
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] build [0-9\.\-@]+) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] Spreadtrum Build) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] v[0-9a-z\.\-@]+) \(ARM ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Qualcomm')
	{
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9] ?V@[0-9\.]+ AU@[0-9\.]*[^\(]+\(CL@[0-9]*\)) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? ?V@[0-9\.]+ [^Q]+) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? (?:AU_LINUX_ANDROID_[A-Z_]+[0-9\.]+)?\s+\(CL[0-9]*\)) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
		m = long_desc.match(/^OpenGL (ES [23]\.[0-9]:? [0-9\.]+) \(Qualcomm ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1].replace('0V@', '0 V@');
	}
	else if (short_desc == 'Intel Corporation')
	{
		m = long_desc.match(/^([0-9\.]+) \(Intel Corporation ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
	}
	else if (short_desc == 'Intel')
	{
		m = long_desc.match(/^([0-9\.]+) - (Build (?:cl)?[0-9\.\-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [0-9\.]+) - (Build (?:cl)?[0-9\.\-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) - (Build CL-[0-9\.\-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^OpenGL (ES [0-9\.]+) - (Build CL-[0-9\.\-]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) (INTEL-[0-9\.]+) \(Intel ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
	}
	else if (short_desc == 'Google Inc.')
	{
		m = long_desc.match(/^OpenGL (ES [0-9\.]+) \((ANGLE [0-9\.]+)\) \(Google Inc. ANGLE \((.+? Direct3D[^)]+)\)/);
		if (m)
			return m[2] + ' ' + m[1] + ' ' + m[3];
	}
	else if (short_desc == 'Apple Inc.')
	{
		m = long_desc.match(/^OpenGL (ES [0-9\.]+) Apple A[0-9] GPU - ([0-9\.]+) \(Apple Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
	}
	else if (short_desc == 'Intel Inc.')
	{
		m = long_desc.match(/^([0-9\.]+) - (Build [0-9\.]+) \(Intel Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) (INTEL-[0-9\.]+) \(Intel Inc. ([^)]+)\)/);
		if (m)
			return m[3].replace(/[ ]+$/, '') + ' ' + m[1] + ' ' + m[2];
		m = long_desc.match(/^([0-9\.]+) (APPLE-[0-9\.]+) \(Intel Inc. ([^)]+)\)/);
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
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] build (?:MAIN)?[0-9\.@RCJB]+) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^OpenGL (ES [234]\.[0-9] IMGSGX[0-9\.@\-]+) \(Imagination Technologies ([^)]+)\)/);
		if (m)
			return m[2].replace(/[ ]+$/, '') + ' ' + m[1];
		m = long_desc.match(/^([0-9\.]+) \(Imagination Technologies ([^)]+)\)/);
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
	var match = safe(long_desc).match(/\(extensions: (.+)\)/);
	if (!match || !match[1])
		return [];

	var names = match[1].split(/\s+/);
	return names.filter(function (name)
	{
		return name != "";
	});
};

function safe(s, def)
{
	if (typeof s == 'undefined')
		return typeof def == 'undefined' ? '' : def;
	return String(s);
}
