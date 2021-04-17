var mysql = require('mysql');

var pool = mysql.createPool({
	host: process.env.OPENSHIFT_MYSQL_DB_HOST || 'localhost',
	port: process.env.OPENSHIFT_MYSQL_DB_PORT || 3306,
	// TODO: Use different users for different resources?
	user: process.env.OPENSHIFT_MYSQL_DB_USERNAME || 'root',
	password: process.env.OPENSHIFT_MYSQL_DB_PASSWORD || '',
	database: process.env.OPENSHIFT_MYSQL_DB_NAME || 'ppsspp',
	charset: 'UTF8_GENERAL_CI',
	connectionLimit: 24,
});

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

module.exports.end = function (cb)
{
	return pool.end(cb);
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

function setupConnection(conn)
{
	conn.config.queryFormat = queryFormat;
	conn.on('error', function (err)
	{
		console.log(err);
		conn.destroy();
	});
	conn.queryFirst = queryFirst;
	conn.queryGrab = queryGrab;
}

function createConnection(info)
{
	var conn = mysql.createConnection(info);
	setupConnection(conn);
	return conn;
}

function queryFormat(query, values)
{
	if (!values)
		return query;

	return query.replace(/\:(\w+)/g, function (txt, key)
	{
		if (values.hasOwnProperty(key))
			return this.escape(values[key]);
	    return txt;
	}.bind(this));
}
