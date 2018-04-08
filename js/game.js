jQuery(function ($) {
	$('[data-config]').each(function () {
		var $col = $(this);
		var config = $col.data('config');
		var crc = $col.data('disc-crc');
		var tags = [];

		// Let's pre-parse the config to make it easier.
		for (var k in config) {
			if (config[k] === 'true')
				config[k] = true;
			else if (config[k] === 'false')
				config[k] = false;
			else if (config[k] === '0')
				config[k] = 0;
		}

		if (!config.CPUCPUCore && !config.CPUJit)
			tags.push('Interpreter');
		else if (config.CPUCPUCore == 2)
			tags.push('IR Jit');

		if (config.CPUSpeed)
			tags.push('Force ' + config.CPUSpeed + ' Mhz');

		if (!config.CPUFuncReplacements)
			tags.push('Replacement disabled');

		if (config.JITDiscardRegsOnJRRA)
			tags.push('Discard Regs on RA');

		if (config.SpeedHacksDisableAlphaTest)
			tags.push('Disable Alpha Test');
		if (config.GraphicsAlwaysDepthWrite)
			tags.push('Force Depth Write');
		if (config.GraphicsSoftwareSkinning === false)
			tags.push('Software Skinning Off');
		if (config.SpeedHacksPrescaleUV === false || config.SpeedHacksPrescaleUVCoords === false)
			tags.push('Prescale UV Off');
		if (config.GraphicsMemBlockTransferGPU === false || config.GraphicsBlockTransferGPU === false)
			tags.push('Block Transfer Off');
		if (config.GraphicsDisableSlowFramebufEffects)
			tags.push('Disable Slow Effects');
		if (config.GraphicsDisableStencilTest)
			tags.push('Disable Stencil Test');
		if (config.GraphicsMipMap === false)
			tags.push('Mipmaps Off');
		if (config.GraphicsHardwareTransform === false)
			tags.push('HW Transform Off');
		if (config.GraphicsHardwareTessellation)
			tags.push('HW Tessellation');
		if (config.GraphicsTextureBackoffCache)
			tags.push('Lazy Texture Caching');
		if (config.GraphicsTextureSecondaryCache)
			tags.push('Secondary Texture Cache');
		if (config.GraphicsVertexCache || config.GraphicsVertexDecCache)
			tags.push('Vertex Cache');

		if (!config.GraphicsForceMaxEmulatedFPS)
			tags.push('Force Max FPS Off');
		else if (config.GraphicsForceMaxEmulatedFPS != 60)
			tags.push('Force Max ' + config.GraphicsForceMaxEmulatedFPS + ' FPS');

		if (config.GraphicsGPUBackend == 1)
			tags.push('Direct3D 9');
		else if (config.GraphicsGPUBackend == 2)
			tags.push('Direct3D 11');
		else if (config.GraphicsGPUBackend == 3)
			tags.push('Vulkan');

		if (config.GraphicsRenderingMode == 0)
			tags.push('Skip Buffer Effects');
		else if (config.GraphicsRenderingMode == 2 || config.GraphicsRenderingMode == 3)
			tags.push('Read Framebuffers From Memory');

		if (config.GraphicsInternalResolution)
			tags.push(config.GraphicsInternalResolution + 'x PSP Res');
		if (config.GraphicsAndroidHwScale > 1)
			tags.push(config.GraphicsAndroidHwScale + 'x PSP HW Scale');

		if (config.GraphicsTexScalingLevel == 0)
			tags.push('Auto Texture Scaling');
		else if (config.GraphicsTexScalingLevel > 1)
			tags.push(config.GraphicsTexScalingLevel + 'x Texture Scaling');

		if (config.GraphicsPostShader && config.GraphicsPostShader != 'Off')
			tags.push(config.GraphicsPostShader + ' Shader');

		if (config.GraphicsFrameSkip) {
			if (config.GraphicsAutoFrameSkip) {
				tags.push('Auto Frameskip ' + config.GraphicsFrameSkip);
			} else {
				tags.push('Frameskip ' + config.GraphicsFrameSkip);
			}
		}

		if (config.CPUIOTimingMethod == 1)
			tags.push('Host IO Timing');
		else if (config.CPUIOTimingMethod == 2)
			tags.push('UMD Timing');

		if (config.CPUSeparateCPUThread)
			tags.push('Multithreading');
		if (!config.CPUSeparateIOThread)
			tags.push('IO Threading Off');
		if (config.GraphicsTimerHack)
			tags.push('Timer Hack');

		if (crc && crc != '00000000')
			tags.push('CRC ' + crc);

		var $ul = $('<ul class="unstyled"></ul>');
		for (var i = 0; i < tags.length; ++i) {
			$ul.append($('<li class="label"></li>').text(tags[i]));
		}
		$col.append($ul);
	});
});
