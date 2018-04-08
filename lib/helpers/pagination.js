'use strict';

module.exports.format = function (current, max, makeLink) {
	// TODO: Plates doesn't really seem great for this, so not using templates.
	const RANGE = 3;

	// No paging, simple.
	if (max <= 1)
		return '';

	let pages = [];
	const formatPage = function (info)
	{
		const classHtml = ' class="page-item' + (info.css ? ' ' + info.css : '') + '"';
		const hrefHtml = ' href="' + (info.href ? info.href : '#') + '"';

		return '<li' + classHtml + '><a' + hrefHtml + '>' + info.title + '</a></li>';
	};

	if (current > 1)
		pages.push({ css: 'page-item prev', title: 'Prev', href: makeLink(current - 1) });

	// Show "1" and "..." if they don't overlap with the range.
	if (current > RANGE + 1)
		pages.push({ css: 'page-item first', title: '1', href: makeLink(1) });
	if (current > RANGE + 2)
		pages.push({ css: 'page-item disabled', title: '...', href: false });

	const range_start = current - RANGE < 1 ? 1 : current - RANGE;
	const range_end = current + RANGE > max ? max : current + RANGE;
	for (let p = range_start; p <= range_end; ++p)
		pages.push({ css: 'page-item' + (p == current ? ' active' : ''), title: p, href: makeLink(p) });

	// Now show the last page if not overlapping.
	if (max > current + RANGE + 1)
		pages.push({ css: 'page-item disabled', title: '...', href: false });
	if (max > current + RANGE)
		pages.push({ css: 'page-item last', title: max, href: makeLink(max) });

	if (current < max)
		pages.push({ css: 'page-item next', title: 'Next', href: makeLink(current + 1) });

	return '<ul class="pagination">' + pages.map(formatPage).join('') + '</ul>';
};
