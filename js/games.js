jQuery(function ($) {
	var getUrlParameter = function (name) {
		name = name.replace(/[\[]/, '\\[').replace(/[\]]/, '\\]');
		var regex = new RegExp('[\\?&]' + name + '=([^&#]*)');
		var results = regex.exec(location.search);
		return results === null ? '' : decodeURIComponent(results[1].replace(/\+/g, ' '));
	};
	var addUrlParams = function (url, pairs) {
		var params = $.param(pairs);
		if (params.length !== 0) {
			if (url.indexOf('?') === -1)
				return url + '?' + params;
			return url + '&' + params;
		}
		return url;
	}

	var name = getUrlParameter('name');
	var region = getUrlParameter('region');
	var order = getUrlParameter('order');
	var compat = getUrlParameter('compat');

	var filterParams = {};
	if (name)
		filterParams.name = name;
	if (region)
		filterParams.region = region;
	if (order)
		filterParams.order = order;
	if (compat)
		filterParams.compat = compat;

	if (name)
		$('input[name="name"]').val(name);

	$('[data-filter="compat"] [data-compat]').each(function () {
		var $this = $(this);
		var this_compat = $this.data('compat');
		if (this_compat == compat) {
			$this.addClass('active');
		}

		var params = Object.assign({}, filterParams);
		delete params.compat;
		$this.attr('href', addUrlParams($this.attr('href'), params));
	});

	$('[data-filter="region"]').val(region || '');
	$('[data-filter="region"]').change(function () {
		var params = Object.assign({}, filterParams);
		if (this.value !== '')
			params.region = this.value;
		else
			delete params.region;
		document.location = addUrlParams($(this).data('href'), params);
	});

	$('.navbar-search').submit(function (ev) {
		var $this = $(this);
		var params = Object.assign({}, filterParams);
		params.name = this.elements.name.value;
		if (params.name === '')
			delete params.name;
		delete params.compat;
		delete params.region;
		document.location = addUrlParams($this.attr('action'), params);
		ev.preventDefault();
	});

	$('.filter-expand').click(function () {
		var $next = $(this.nextElementSibling);
		$next.toggleClass('filter-hidden');
	});

	if (!compat)
		$('[data-filter="compat"]').addClass('filter-hidden');
	if (!region)
		$('[data-filter="region"]').addClass('filter-hidden');
});
