const mysql = require('mysql2');

const pool = mysql.createPool({
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
 */
module.exports.getConnection = async function ()
{
	let conn = await pool.promise().getConnection();
	if (conn && !conn.ppSetupDone)
	{
		setupConnection(conn);
		conn.ppSetupDone = true;
	}
	return conn;
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
 * Execute a dynamic query (not prepared.)
 *
 * @param {String} sql
 * @param {Object} values
 * @returns {Promise<[any, mysql.FieldPacket[]]>}
 */
module.exports.query = function (sql, values)
{
	return pool.promise().query(sql, values);
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
}

function cleanupConnection(err)
{
	console.log(err);
}

/**
 * Add helpers to a connection for easy usage.
 * @param {mysql.PoolConnection} conn
 */
function setupConnection(conn)
{
	conn.off('error', cleanupConnection);
	conn.on('error', cleanupConnection);
	conn.executeFirst = (sql, values) => applyFirst(conn, sql, values);
	conn.executeGrab = (sql, values) => applyGrab(conn, sql, values);
}
