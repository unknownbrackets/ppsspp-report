var mysql = require('mysql2');

var pool = mysql.createPool({
	host: process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
	port: process.env.OPENSHIFT_MYSQL_DB_PORT || 3306,
	// TODO: Use different users for different resources?
	user: process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
	password: process.env.OPENSHIFT_MYSQL_DB_PASSWORD || '',
	database: process.env.OPENSHIFT_MYSQL_DB_NAME || 'ppsspp',
	charset: 'UTF8_GENERAL_CI',
	connectionLimit: 24,
	namedPlaceholders: true,
	waitForConnections: true,
});

let endCallbacks = [];

/**
 * Get a connection from the pool.
 * Don't forget to explicitly release it.
 * @param {(err: any, conn: mysql.PoolConnection) => any} cb
 */
module.exports.getConnection = function (cb)
{
	return pool.getConnection(function (err, conn)
	{
		if (conn && !err && !conn.ppSetupDone)
		{
			setupConnection(conn);
			conn.ppSetupDone = true;
		}
		cb(err, conn);
	});
};

/**
 * Prepare and run a statement.
 *
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<[any, mysql.FieldPacket[]]>}
 */
module.exports.execute = function (sql, values)
{
	return pool.promise().execute(sql, values);
};

/**
 * Prepare and run a query, returning the first column of the first result.
 *
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<any>}
 */
module.exports.executeGrab = async function (sql, values)
{
	return applyGrab(pool.promise(), sql, values);
};

/**
 * Prepare and run a query, returning the first row of the first result.
 *
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<Object>}
 */
module.exports.executeFirst = async function (sql, values)
{
	return applyFirst(pool.promise(), sql, values);
};

module.exports.end = function (cb)
{
	if (cb)
		endCallbacks.push(cb);
	return pool.end(function (err)
	{
		for (let callback of endCallbacks)
			callback(err);
	});
};

module.exports.onEnd = function (cb)
{
	endCallbacks.push(cb);
};

function queryFirst(str, values, cb)
{
	this.query(str, values, function (err, result)
	{
		if (!err)
		{
			if (result.length == 0)
				result = false;
			// If this is the result of a call, result[0] will be an array.
			else if (Array.isArray(result[0]))
				result = result[0].length != 0 ? result[0][0] : false;
			else
				result = result[0];
		}
		cb(err, result);
	});
}

function queryGrab(str, values, cb)
{
	this.query(str, values, function (err, result)
	{
		if (!err)
		{
			if (result.length == 0 || (Array.isArray(result[0]) && result[0].length == 0))
				result = false;
			else
			{
				// If this is the result of a call, result[0] will be an array.
				var result0 = Array.isArray(result[0]) ? result[0][0] : result[0];
				var keys = Object.keys(result0);
				result = keys.length != 0 ? result0[keys[0]] : false;
			}
		}
		cb(err, result);
	});
}

/**
 * Prepare and run a query, returning the first column of the first result.
 *
 * @param {mysql.PoolConnection|mysql.Pool} conn
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<any>}
 */
async function applyGrab(conn, sql, values)
{
	let [result, columns] = await conn.execute(sql, values);
	if (result.length !== 0 && Array.isArray(result[0]) && Array.isArray(columns[0]))
	{
		result = result[0];
		columns = columns[0];
	}
	if (result.length === 0 || columns.length === 0)
		return false;

	return result[0][columns[0].name];
}

/**
 * Prepare and run a query, returning the first row of the first result.
 *
 * @param {mysql.PoolConnection|mysql.Pool} conn
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<Object>}
 */
async function applyFirst(conn, sql, values)
{
	let [result, columns] = await conn.execute(sql, values);
	if (result.length !== 0 && Array.isArray(result[0]) && Array.isArray(columns[0]))
	{
		result = result[0];
		columns = columns[0];
	}
	if (result.length === 0)
		return false;

	return result[0];
};

/**
 * Add helpers to a connection for easy usage.
 * @param {mysql.PoolConnection} conn
 */
function setupConnection(conn)
{
	conn.on('error', function (err)
	{
		console.log(err);
		conn.destroy();
	});
	conn.queryFirst = queryFirst;
	conn.queryGrab = queryGrab;
	conn.executeFirst = (sql, values) => applyFirst(conn.promise(), sql, values);
	conn.executeGrab = (sql, values) => applyGrab(conn.promise(), sql, values);
}
