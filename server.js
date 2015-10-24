#!/bin/env node
var express = require('express');
var bodyParser = require('body-parser')
var fs = require('fs');

var logs = require('./lib/logs/index');
var compat = require('./lib/compat/index');
var match = require('./lib/match/index');

var ReportApp = function() {
    var self = this;


    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP;
        self.port      = process.env.OPENSHIFT_INTERNAL_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_INTERNAL_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };

	// Local cache for static content.
	self.staticCache = {};
	self.preloadStatic = function ()
	{
		var preload = ['./pages/index.html', './pages/logs.html', './pages/errors/404.html', './pages/errors/500.html'];
		for (var i = 0; i < preload.length; ++i)
		{
			var f = preload[i];
			self.staticCache[f] = fs.readFileSync(f);
		}
	};

	// Do not use on untrusted user strings.  Keys must be paths.
    self.getStatic = function (key)
    {
		if (key in self.staticCache)
			return self.staticCache[key];

		return self.staticCache[key] = fs.readFileSync(key);
	};


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/health'] = function (req, res) {
            res.send('1');
        };

		// TODO: It'd probably be better to serve these via nginx directly.

		var cssRoute = function (req, res)
		{
			res.setHeader('Content-Type', 'text/css');
			res.send(self.getStatic('.' + req.route.path));
		};

		var jsRoute = function (req, res)
		{
			res.setHeader('Content-Type', 'application/x-javascript');
			res.send(self.getStatic('.' + req.route.path));
		};

		var imgRoute = function (req, res)
		{
			res.setHeader('Content-Type', 'image/png');
			res.send(self.getStatic('.' + req.route.path));
		};

		var errorRoute = function (req, res)
		{
			res.status(404);
			if (req.accepts('html'))
			{
				res.end(String(self.getStatic('./pages/errors/404.html')));
				return;
			}

			res.type('txt').end('404 Not Found');
		};

		self.routes['/css/style.css'] = cssRoute;
		self.routes['/css/style.min.css'] = cssRoute;
		self.routes['/css/logs.min.css'] = cssRoute;
		self.routes['/css/compat.min.css'] = cssRoute;

		self.routes['/js/libs/jquery-1.7.2.min.js'] = jsRoute;
		self.routes['/js/libs/modernizr-2.5.3-respond-1.1.0.min.js'] = jsRoute;
		self.routes['/js/common.min.js'] = jsRoute;

		self.routes['/img/star.png'] = imgRoute;
		self.routes['/img/star2.png'] = imgRoute;
		self.routes['/img/star_grey.png'] = imgRoute;

		self.routes['*'] = errorRoute;

		logs.addRoutes(self);
		compat.addRoutes(self);
		match.addRoutes(self);
	};


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.app = express();
        self.app.set('trust proxy', true);
        self.app.use(bodyParser.urlencoded({ extended: false }));
        self.app.use(bodyParser.json());

        //  Add handlers for the app (from the routes).
        self.createRoutes();
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.preloadStatic();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now()), self.ipaddress, self.port);
        });
    };

};


/**
 *  main():  Main code.
 */
var zapp = new ReportApp();
zapp.initialize();
zapp.start();

