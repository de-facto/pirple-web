/**
 * Server-related tasks.
 * 
 */


// Dependencies
const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const StringDecoder = require('string_decoder').StringDecoder;
const config = require('./config');
const handlers = require('./handlers');
const helpers = require('./helpers');
const path = require('path');
const util = require('util');
const debug = util.debuglog('server');

// Instantiatiate the Server module object.
const server = {};

// @TODO REMOVE THIS "CONNECT TO API" TEST
// helpers.sendTwilioSms('4158375309','Hello!', function(err) {
// console.log('This was the error:',err);
// });

// Instantiating the HTTP server.
server.httpServer = http.createServer( function(req, res) {
  server.unifiedServer(req, res);
});

// Instantiatiate the HTTPS server.
server.httpsServerOptions = {
  'key' : fs.readFileSync(path.join(__dirname,'/../https/key.pem')),
  'cert' : fs.readFileSync(path.join(__dirname,'/../https/cert.pem'))
};

server.httpsServer = https.createServer(server.httpsServerOptions, function(req, res) {
    server.unifiedServer(req, res);
});


// All the logic for both the HTTP and HTTPS servers.
server.unifiedServer = function(req, res) {

  // Get the URL and Parse it.
  const parsedUrl = url.parse(req.url, true);

  // Get the path.
  const path = parsedUrl.pathname;
  const trimmedPath = path.replace(/^\/+|\/+$/g, '');

  // Get the query string as an object.
  const queryStringObject = parsedUrl.query;

  // Get the HTTP method.
  const method = req.method.toLowerCase();

  // Get the headers as an object.
  const headers = req.headers;

  // STREAMING. Get the payload, if any.
  let decoder = new StringDecoder('utf-8');
  let buffer = '';
  req.on('data', function(data) {
      buffer += decoder.write(data);
  });

  // END EVENT
  // When buffer has all the data, stop.
  req.on('end', function() {
      buffer += decoder.end();

      // Select the handler to which the request should be routed.
      // If one is not found, route to the 'notFound' handler.
      let selectedHandler = typeof(server.router[trimmedPath]) !== 'undefined' ? server.router[trimmedPath] : handlers.notFound;

      // IF REQUEST IS WITHIN PUBLIC DIR£CTORY, USE PUBLIC HANDLER INSTEAD.
      selectedHandler = trimmedPath.indexOf('public/') > -1 ? handlers.public : selectedHandler;

      // Construct the data object to send to the handler.
      let data = {
        'trimmedPath': trimmedPath,
        'queryStringObject': queryStringObject,
        'method': method,
        'headers': headers,
        'payload': helpers.parseJsonToObject(buffer)
      };

      // Route the Request specified in the server.router.
      selectedHandler(data, function(statusCode, payload, contentType) {

        // Prevent content sniffing: CAN I ADD THIS?
        //res.setHeader('X-Content-Type-Options', 'nosniff');

        // Dertermine 5he type of response (fallback to JSON)
        contentType = typeof(contentType) == 'string' ? contentType : 'json';

        // Use status code called by the handler, else default to 200.
        statusCode = typeof(statusCode) == 'number' ? statusCode : 200;

        // CONTENT TYPE: return the response-parts that are content-specific.
        let payloadString = '';
   
        if (contentType == 'json') {
          res.setHeader('Content-Type', 'application/json');
          // Use the payload called by the handler, else default to an empty object.
          payload = typeof(payload) == 'object' ? payload : {};
          // Convert the payload to a string.
          payloadString = JSON.stringify(payload);
        }

        if (contentType == 'html') {
          res.setHeader('Content-Type', 'text/html');
          payloadString = typeof(payload) == 'string' ? payload : '';
        }

        if (contentType == 'css') {
          res.setHeader('Content-Type', 'text/css');
          payloadString = typeof(payload) !== 'string' ? payload : '';
        }

        if (contentType == 'png') {
          res.setHeader('Content-Type', 'image/png');
          payloadString = typeof(payload) !== 'undefined' ? payload : '';
        }

        if (contentType == 'favicon') {
          res.setHeader('Content-Type', 'image/x-icon');
          payloadString = typeof(payload) !== 'undefined' ? payload : '';
        }

        if (contentType == 'jpg') {
          res.setHeader('Content-Type', 'image/jpeg');
          payloadString = typeof(payload) !== 'undefined' ? payload : '';
        }

        if (contentType == 'plain') {
          res.setHeader('Content-Type', 'text/plain');
          payloadString = typeof(payload) !== 'undefined' ? payload : '';
        }


        
        //  MY CODE____________________________________________________________
        /*// List the MIME types
        const extensions = {
          //"plain": "text/plain",
          "html": "text/html",
          "css": "text/css",
          "png": "image/png",
          "jpg": "image/jpeg",
          "favicon": "image/x-icon",
        };

        // Assign the correct MIME type to the Content Type look-up
        Object.keys(extensions).forEach(function(key) {
          if(contentType == key) {
            res.setHeader('Content-Type', extensions[key]);
            payloadString = typeof(payload) == 'string' ? payload : '';
          } else {
            res.setHeader('Content-Type', extensions[key]);
            payloadString = typeof(payload) == 'undefined' ? payload : '';
          }
        });*/

        //------------------------------------------------------------------------


        // Return thr response-parts that are common to all Content Types.
        res.writeHead(statusCode);
        res.end(payloadString);

        // Log the Request path.
        // If Response is 200, print in Green, otherwise, print in Red.
        if (statusCode == 200) {
          debug('\x1b[42;30m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
        } else {
          debug('\x1b[41m%s\x1b[0m', method.toUpperCase() + ' /' + trimmedPath + ' ' + statusCode);
        }
      });
  });
};

// Define a Request server.router.
server.router = {
  '' : handlers.index,
  'account/create' : handlers.accountCreate,
  'account/edit' : handlers.accountEdit,
  'account/deleted' : handlers.accountDeleted,
  'session/create' : handlers.sessionCreate,
  'sesion/deleted' : handlers.sessionDeleted,
  'checks/all' : handlers.checskList,
  'checks/create' : handlers.checksCreate,
  'checks/edit' : handlers.checksEdit,
  'ping' : handlers.ping,
  'api/users' : handlers.users,
  'api/tokens' : handlers.tokens,
  'api/checks' : handlers.checks,
  'favicon.ico' : handlers.favicon,
  'public' : handlers.public
};

// Server initialisation function.
server.init = function() {
  // Start the HTTP server.
  server.httpServer.listen(config.httpPort, function() {
      console.log('\x1b[36m%s\x1b[0m', 'HTTP server listening on port ' + config.httpPort);
    });

  // start the HTTPS server.
  server.httpsServer.listen(config.httpsPort, function() {
      console.log('\x1b[35m%s\x1b[0m', 'HTTPS server listening on port ' + config.httpsPort);
    });
};


// Export the Server.
module.exports = server;