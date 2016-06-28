var async = require('async');
var pool = require('../db');
var settings = require('../settings');
var limits = require('../limits');
var lookups = require('../lookups');

module.exports.getLatest = function (parameters, cb)
{
	pool.getConnection(function (err, conn)
	{
		conn.query('\
			SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars \
			FROM compatibility AS cmp \
				INNER JOIN compat_ratings AS cmpr USING (id_compat_rating) \
				INNER JOIN games AS g USING (id_game) \
			ORDER BY cmp.latest_report DESC \
			LIMIT 5', {}, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};

module.exports.getHighestRated = function (parameters, cb)
{
	pool.getConnection(function (err, conn)
	{
		conn.query('\
			SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars \
			FROM compatibility AS cmp \
				INNER JOIN compat_ratings AS cmpr USING (id_compat_rating) \
				INNER JOIN games AS g USING (id_game) \
			ORDER BY cmp.overall_stars DESC, cmp.id_compat_rating ASC, cmp.latest_report DESC \
			LIMIT 5', {}, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};

module.exports.getCount = function (parameters, cb)
{
	var clauses = [
		"g.id_game NOT IN ('', '_')",
	];

	if (parameters.region != undefined)
		regionFilter(clauses, parameters.region);
	if (parameters.name != undefined)
		clauses.push("g.title LIKE CONCAT('%', :name, '%')");
	if (parameters.compat == 'unknown')
		clauses.push("cmpr.identifier IS NULL");
	else if (parameters.compat != undefined)
		clauses.push("cmpr.identifier = :compat");

	pool.getConnection(function (err, conn)
	{
		var makeWhere = function (additional)
		{
			var where = '';
			var all = clauses.concat(additional || []);
			if (all.length == 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		}

		conn.queryGrab('\
			SELECT COUNT(g.id_game) AS c \
			FROM games AS g \
				LEFT JOIN compatibility AS cmp USING (id_game) \
				LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating) \
			' + makeWhere(), parameters, function (err, c)
		{
			conn.release();
			cb(err, c);
		});
	});
};

module.exports.getAll = function (parameters, cb)
{
	var clauses = [
		"g.id_game NOT IN ('', '_')",
	];

	if (parameters.region != undefined)
		regionFilter(clauses, parameters.region);
	if (parameters.name != undefined)
		clauses.push("g.title LIKE CONCAT('%', :name, '%')");
	if (parameters.compat == 'unknown')
		clauses.push("cmpr.identifier IS NULL");
	else if (parameters.compat != undefined)
		clauses.push("cmpr.identifier = :compat");

	pool.getConnection(function (err, conn)
	{
		var makeWhere = function (additional)
		{
			var where = '';
			var all = clauses.concat(additional || []);
			if (all.length == 1)
				where = 'WHERE ' + all[0];
			else if (all.length > 1)
				where = 'WHERE ' + all.join(' AND ');
			return where;
		}

		parameters.offset = (parameters.page - 1) * 100;
		conn.query('\
			SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars \
			FROM games AS g \
				LEFT JOIN compatibility AS cmp USING (id_game) \
				LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating) \
			' + makeWhere() + ' \
			ORDER BY IF(cmp.overall_stars IS NULL, 1, 0) ASC, g.title ASC, g.id_game ASC \
			LIMIT :offset, 100', parameters, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};

function regionFilter(clauses, region)
{
	var letter = null;
	switch (String(region).toLowerCase())
	{
	case 'asia': letter = 'A'; break;
	case 'europe': letter = 'E'; break;
	case 'southeast asia': letter = 'H'; break;
	case 'internal': letter = 'I'; break;
	case 'japan': letter = 'J'; break;
	case 'hong kong': letter = 'K'; break;
	case 'usa': letter = 'u'; break;
	case 'sample': letter = 'x'; break;
	case 'homebrew': letter = null; break;
	}

	if (letter)
		clauses.push("g.id_game LIKE '__" + letter + "%'");
}
