jQuery(function ($) {
	var getUrlParameter = function (name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};

	var name = getUrlParameter('name');
	if (name)
		$('input[name="name"]').val(name);

	var compat = getUrlParameter('compat');
	$('[data-filter="compat"] [data-compat]').each(function () {
		var $this = $(this);
		var this_compat = $this.data('compat');
		if (this_compat == compat) {
			$this.addClass('active');
		}
	});
});
