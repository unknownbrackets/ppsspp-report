var data = require('./data');

module.exports.addRoutes = function (server)
{
	server.app.post('/report/message', report_message);
};

function report_message(req, res)
{
	res.setHeader('Content-Type', 'text/plain; charset=utf-8');
	res.send('1');

	data.addMessage(null, req.body, function (err)
	{
	});
}