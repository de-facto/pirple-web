/**
 * Primary file for the API
 * 
 */

// Dependencies
const server = require('./lib/server');
const workers = require('./lib/workers');

// Declare the App.
const app = {};

// Initialisation function
app.init = function() {
  // Start server and workers
  server.init();
  workers.init();
};

// Execute app function
app.init();

// EXPORT the app
module.exports = app;