'use strict';

const pool = require('../db');

module.exports.getLatest = async function (parameters)
{
	const [results] = await pool.execute(`
		SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars
		FROM compatibility AS cmp
			INNER JOIN compat_ratings AS cmpr USING (id_compat_rating)
			INNER JOIN games AS g USING (id_game)
		ORDER BY cmp.latest_report DESC
		LIMIT 5`, {});
	return results;
};

module.exports.getHighestRated = async function (parameters)
{
	const [results] = await pool.execute(`
		SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars
		FROM compatibility AS cmp
			INNER JOIN compat_ratings AS cmpr USING (id_compat_rating)
			INNER JOIN games AS g USING (id_game)
		ORDER BY cmp.overall_stars DESC, cmp.id_compat_rating ASC, cmp.latest_report DESC
		LIMIT 5`, {});
	return results;
};

module.exports.getCount = async function (parameters)
{
	let clauses = [
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
	if (parameters.genre === 'none')
		clauses.push("g.id_game NOT IN (SELECT id_game FROM game_genres)");
	else if (parameters.genre != undefined)
		clauses.push("g.id_game IN (SELECT id_game FROM game_genres NATURAL JOIN genres WHERE title = :genre)");

	const makeWhere = function (additional)
	{
		let where = '';
		const all = clauses.concat(additional || []);
		if (all.length == 1)
			where = 'WHERE ' + all[0];
		else if (all.length > 1)
			where = 'WHERE ' + all.join(' AND ');
		return where;
	};

	return pool.executeGrab(`
		SELECT COUNT(g.id_game) AS c
		FROM games AS g
			LEFT JOIN compatibility AS cmp USING (id_game)
			LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating)
		` + makeWhere(), parameters);
};

module.exports.getAll = async function (parameters)
{
	let clauses = [
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
	if (parameters.genre === 'none')
		clauses.push("g.id_game NOT IN (SELECT id_game FROM game_genres)");
	else if (parameters.genre != undefined)
		clauses.push("g.id_game IN (SELECT id_game FROM game_genres NATURAL JOIN genres WHERE title = :genre)");

	let order_clause;
	if (parameters.order == 'latest')
		order_clause = 'ORDER BY cmp.latest_report DESC, g.title ASC, g.id_game ASC';
	else if (parameters.order == 'highest')
		order_clause = 'ORDER BY cmp.overall_stars DESC, cmp.id_compat_rating ASC, cmp.latest_report DESC, g.title ASC, g.id_game ASC';
	else
		order_clause = 'ORDER BY IF(cmp.overall_stars IS NULL, 1, 0) ASC, g.title ASC, g.id_game ASC';

	const makeWhere = function (additional)
	{
		let where = '';
		const all = clauses.concat(additional || []);
		if (all.length == 1)
			where = 'WHERE ' + all[0];
		else if (all.length > 1)
			where = 'WHERE ' + all.join(' AND ');
		return where;
	};

	parameters.offset = (parameters.page - 1) * 100;
	const [results] = await pool.execute(`
		SELECT g.title, g.id_game, cmpr.title AS compat, cmpr.identifier AS compat_ident, cmp.overall_stars
		FROM games AS g
			LEFT JOIN compatibility AS cmp USING (id_game)
			LEFT JOIN compat_ratings AS cmpr USING (id_compat_rating)
		${makeWhere()}
		${order_clause}
		LIMIT :offset, 100`, parameters);
	return results;
};

function regionFilter(clauses, region)
{
	let letter = null;
	switch (String(region).toLowerCase())
	{
	case 'asia': letter = 'A'; break;
	case 'europe': letter = 'E'; break;
	case 'southeast asia': letter = 'H'; break;
	case 'internal': letter = 'I'; break;
	case 'japan': letter = 'J'; break;
	case 'korea': letter = 'K'; break;
	case 'usa': letter = 'U'; break;
	case 'sample': letter = 'X'; break;
	case 'homebrew': letter = null; break;
	}

	if (letter)
		clauses.push("(g.id_game LIKE 'UL" + letter + "%' OR g.id_game LIKE 'UC" + letter + "%' OR g.id_game LIKE 'NP" + letter + "%')");
	else
		clauses.push("(SUBSTRING(g.id_game, 1, 2) NOT IN ('UL', 'UC', 'NP') OR SUBSTRING(g.id_game, 3, 1) NOT IN ('A', 'E', 'H', 'I', 'J', 'K', 'U', 'X'))");
}
