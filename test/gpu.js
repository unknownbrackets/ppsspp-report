var vows = require('vows');
var assert = require('assert');
var lookups = require('../lib/lookups');

vows.describe('GPU info parsing').addBatch({
	'Adreno versions': {
		'for a 3xx git build': {
			topic: lookups.calcGpuNickname('Qualcomm', 'OpenGL ES 3.0 V@95.0 AU@  (GIT@I68fa98814b) (Qualcomm Adreno (TM) 330), OpenGL ES GLSL ES 3.00 (extensions: GL_AMD_compressed_ATC_texture GL_AMD_performance_monitor GL_AMD_program_binary_Z400 GL_EXT_debug_label GL_EXT_debug_marker GL_EXT_discard_framebuffer GL_EXT_robustness GL_EXT_texture_format_BGRA8888 GL_EXT_texture_type_2_10_10_10_REV GL_NV_fence GL_OES_compressed_ETC1_RGB8_texture GL_OES_depth_texture GL_OES_depth24 GL_OES_EGL_image GL_OES_EGL_sync GL_OES_EGL_image_external GL_OES_element_index_uint GL_OES_fbo_render_mipmap GL_OES_fragment_precision_high GL_OES_get_program_binary GL_OES_packed_depth_stencil GL_OES_depth_texture_cube_map GL_OES_rgb8_rgba8 GL_OES_standard_derivatives GL_OES_texture_3D GL_OES_texture_float GL_OES_texture_half_float GL_OES_texture_half_float_linear GL_OES_texture_npot GL_OES_vertex_half_float GL_OES_vertex_type_10_10_10_2 GL_OES_vertex_array_object GL_QCOM_alpha_test GL_QCOM_binning_control GL_QCOM_driver_control GL_QCOM_perfmon_global_mode GL_QCOM_extended_get GL_QCOM_extended_get2 GL_QCOM_tiled_rendering GL_QCOM_writeonly_rendering GL_EXT_sRGB GL_EXT_sRGB_write_control GL_EXT_texture_sRGB_decode GL_EXT_texture_filter_anisotropic GL_EXT_multisampled_render_to_texture GL_EXT_color_buffer_float GL_EXT_color_buffer_half_float GL_EXT_disjoint_timer_query )'),

			'should parse': function (value) {
				assert.equal(value, 'Adreno\u2122 330 ES 3.0 V@95.0 AU@ (GIT@I68fa98814b)');
			},
		},

		'for an unnamed 3xx git build': {
			topic: lookups.calcGpuNickname('Qualcomm', 'OpenGL ES 3.0 V@100.0 AU@  (GIT@) (Qualcomm Adreno (TM) 306), OpenGL ES GLSL ES 3.00 (extensions: GL_AMD_compressed_ATC_texture GL_AMD_performance_monitor GL_AMD_program_binary_Z400 GL_EXT_debug_label GL_EXT_debug_marker GL_EXT_discard_framebuffer GL_EXT_robustness GL_EXT_texture_format_BGRA8888 GL_EXT_texture_type_2_10_10_10_REV GL_NV_fence GL_OES_compressed_ETC1_RGB8_texture GL_OES_depth_texture GL_OES_depth24 GL_OES_EGL_image GL_OES_EGL_sync GL_OES_EGL_image_external GL_OES_element_index_uint GL_OES_fbo_render_mipmap GL_OES_fragment_precision_high GL_OES_get_program_binary GL_OES_packed_depth_stencil GL_OES_depth_texture_cube_map GL_OES_rgb8_rgba8 GL_OES_standard_derivatives GL_OES_texture_3D GL_OES_texture_float GL_OES_texture_half_float GL_OES_texture_half_float_linear GL_OES_texture_npot GL_OES_vertex_half_float GL_OES_vertex_type_10_10_10_2 GL_OES_vertex_array_object GL_QCOM_alpha_test GL_QCOM_binning_control GL_QCOM_driver_control GL_QCOM_perfmon_global_mode GL_QCOM_extended_get GL_QCOM_extended_get2 GL_QCOM_tiled_rendering GL_QCOM_writeonly_rendering GL_EXT_sRGB GL_EXT_sRGB_write_control GL_EXT_texture_sRGB_decode GL_EXT_texture_filter_anisotropic GL_EXT_multisampled_render_to_texture GL_EXT_color_buffer_float GL_EXT_color_buffer_half_float GL_EXT_disjoint_timer_query )'),

			'should parse': function (value) {
				assert.equal(value, 'Adreno\u2122 306 ES 3.0 V@100.0 AU@ (GIT@)');
			},
		},

		'for a 4xx git build': {
			topic: lookups.calcGpuNickname('Qualcomm', 'OpenGL ES 3.0V@95.0 (GIT@I86da836d38) (Qualcomm Adreno (TM) 420), OpenGL ES GLSL ES 3.10 (extensions: GL_EXT_debug_marker GL_OES_EGL_image GL_OES_EGL_image_external GL_OES_EGL_sync GL_OES_vertex_half_float GL_OES_framebuffer_object GL_OES_rgb8_rgba8 GL_OES_compressed_ETC1_RGB8_texture GL_AMD_compressed_ATC_texture GL_KHR_texture_compression_astc_ldr GL_OES_texture_npot GL_EXT_texture_filter_anisotropic GL_EXT_texture_format_BGRA8888 GL_OES_texture_3D GL_EXT_color_buffer_float GL_EXT_color_buffer_half_float GL_QCOM_alpha_test GL_OES_depth24 GL_OES_packed_depth_stencil GL_OES_depth_texture GL_OES_depth_texture_cube_map GL_EXT_sRGB GL_OES_texture_float GL_OES_texture_float_linear GL_OES_texture_half_float GL_OES_texture_half_float_linear GL_EXT_texture_type_2_10_10_10_REV GL_EXT_texture_sRGB_decode GL_OES_element_index_uint GL_EXT_copy_image GL_EXT_geometry_shader GL_EXT_tessellation_shader GL_OES_texture_stencil8 GL_EXT_shader_io_blocks GL_OES_shader_image_atomic GL_OES_sample_variables GL_EXT_texture_border_clamp GL_EXT_multisampled_render_to_texture GL_OES_shader_multisample_interpolation GL_EXT_draw_buffers_indexed GL_EXT_gpu_shader5 GL_EXT_robustness GL_EXT_texture_buffer GL_OES_texture_storage_multisample_2d_array GL_OES_sample_shading GL_OES_get_program_binary GL_EXT_debug_label GL_KHR_blend_equation_advanced GL_KHR_blend_equation_advanced_coherent GL_QCOM_tiled_rendering GL_ANDROID_extension_pack_es31a GL_EXT_primitive_bounding_box GL_OES_standard_derivatives GL_OES_vertex_array_object GL_KHR_debug )'),

			'should parse': function (value) {
				assert.equal(value, 'Adreno\u2122 420 ES 3.0 V@95.0 (GIT@I86da836d38)');
			},
		},
	},

	'Mali versions': {
		'for T880': {
			topic: lookups.calcGpuNickname('ARM', 'OpenGL ES 3.1 v1.r8p0-01dev0.aa829512e3c4ac5a9261cd1b826d668c (ARM Mali-T880), OpenGL ES GLSL ES 3.10 (extensions: GL_EXT_debug_marker GL_ARM_rgba8 GL_ARM_mali_shader_binary GL_OES_depth24 GL_OES_depth_texture GL_OES_depth_texture_cube_map GL_OES_packed_depth_stencil GL_OES_rgb8_rgba8 GL_EXT_read_format_bgra GL_OES_compressed_paletted_texture GL_OES_compressed_ETC1_RGB8_texture GL_OES_standard_derivatives GL_OES_EGL_image GL_OES_EGL_image_external GL_OES_EGL_sync GL_OES_texture_npot GL_OES_vertex_half_float GL_OES_required_internalformat GL_OES_vertex_array_object GL_OES_mapbuffer GL_EXT_texture_format_BGRA8888 GL_EXT_texture_rg GL_EXT_texture_type_2_10_10_10_REV GL_OES_fbo_render_mipmap GL_OES_element_index_uint GL_OES_texture_compression_astc GL_KHR_texture_compression_astc_ldr GL_KHR_texture_compression_astc_hdr GL_KHR_debug GL_EXT_occlusion_query_boolean GL_EXT_disjoint_timer_query GL_EXT_blend_minmax GL_EXT_discard_framebuffer GL_OES_get_program_binary GL_OES_texture_3D GL_EXT_texture_storage GL_EXT_multisampled_render_to_texture GL_OES_surfaceless_context GL_OES_texture_stencil8 GL_EXT_shader_pixel_local_storage GL_ARM_shader_framebuffer_fetch GL_ARM_shader_framebuffer_fetch_depth_stencil GL_ARM_mali_program_binary GL_EXT_sRGB GL_EXT_sRGB_write_control GL_EXT_texture_sRGB_decode GL_KHR_blend_equation_advanced GL_KHR_blend_equation_advanced_coherent GL_OES_texture_storage_multisample_2d_array GL_OES_shader_image_atomic GL_EXT_robustness GL_EXT_draw_buffers_indexed GL_OES_draw_buffers_indexed GL_EXT_texture_border_clamp GL_OES_texture_border_clamp GL_EXT_texture_cube_map_array GL_OES_texture_cube_map_array GL_OES_sample_variables GL_OES_sample_shading GL_OES_shader_multisample_interpolation GL_EXT_shader_io_blocks GL_OES_shader_io_blocks GL_EXT_tessellation_shader GL_OES_tessellation_shader GL_EXT_primitive_bounding_box GL_OES_primitive_bounding_box GL_EXT_geometry_shader GL_OES_geometry_shader GL_ANDROID_extension_pack_es31a GL_EXT_gpu_shader5 GL_OES_gpu_shader5 GL_EXT_texture_buffer GL_OES_texture_buffer GL_EXT_copy_image GL_OES_copy_image GL_EXT_color_buffer_half_float GL_EXT_color_buffer_float )'),

			'should parse': function (value) {
				assert.equal(value, 'Mali-T880 ES 3.1 v1.r8p0-01dev0.aa829512e3c4ac5a9261cd1b826d668c');
			},
		}
	},
}).export(module);
