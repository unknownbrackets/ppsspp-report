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
			ORDER BY cmp.overall_stars DESC, cmp.latest_report DESC \
			LIMIT 5', {}, function (err, results)
		{
			conn.release();
			cb(err, results);
		});
	});
};
