var g_server;

exports.addRoutes = function (server)
{
	g_server = server;
	//g_server.app.post('/report/compat', report_compat);

    g_server.app.get('/', function (req, res) {
        res.setHeader('Content-Type', 'text/html; encoding=utf-8');
        res.send(g_server.getStatic('./pages/index.html'));
    });
};