/**
 * Worker-related tasks.
 * 
 */


// Dependencies
const path = require('path');
const fs = require('fs');
const _data = require('./data');
const http = require('http');
const https = require('https');
const helpers = require('./helpers');
const url = require('url');
const _logs = require('./logs');
const util = require('util');
const debug = util.debuglog('workers');

// Timestamp conversion to human-readable format
let ts = Date.now();
//let dateObj = new Date(ts);
//let secs = dateObj.getSeconds();
//let mins = dateObj.getMinutes();
//let hours = dateObj.getHours();
//let day = dateObj.getDate();
//let month = dateObj.getMonth();
//let year = dateObj.getFullYear();
//let timestamp = (year+'/'+month+'/'+day+'/'+hours+':'+mins+'.'+secs);


// Instantiate the Worker object.
const workers = {};

// Look up all checks, get their data, send to a validator.
workers.gatherAllChecks = function() {
  // Get all the checks that exist in the system.
  _data.list('checks', function(err, checks) {
    if(!err && checks && checks.length > 0) {
      checks.forEach( function(check) {
        // Read in the data.
        _data.read('checks', check, function(err, origCheckData) {
          if (!err && origCheckData) {
            // Pass data to the validator; it shall continue, or log errors
            workers.validateCheckData(origCheckData);
          } else {
            debug('Error reading data require a check: ', err);
          }
        });
      });
    } else {
      debug("Could not find any checks to process.");
    }
  });
};

// Validating the data require checks.
workers.validateCheckData = function(origCheckData) {
  origCheckData = typeof(origCheckData) == 'object' && origCheckData !== null ? origCheckData : {};
  origCheckData.id = typeof(origCheckData.id) == 'string' && origCheckData.id.trim().length == 20 ? origCheckData.id.trim() : false;
  origCheckData.userPhone = typeof(origCheckData.userPhone) == 'string' && origCheckData.userPhone.trim().length == 10 ? origCheckData.userPhone.trim() : false;
  origCheckData.protocol = typeof(origCheckData.protocol) == 'string' && ['http', 'https'].indexOf(origCheckData.protocol) > -1 ? origCheckData.protocol : false;
  origCheckData.url = typeof(origCheckData.url) == 'string' && origCheckData.url.trim().length > 0 ? origCheckData.url.trim() : false;
  origCheckData.method = typeof(origCheckData.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(origCheckData.method) > -1 ? origCheckData.method : false;
  origCheckData.successCodes = typeof(origCheckData.successCodes) == 'object' && origCheckData.successCodes instanceof Array && origCheckData.successCodes.length > 0 ? origCheckData.successCodes : false;
  origCheckData.timeoutSeconds = typeof(origCheckData.timeoutSeconds) == 'number' && origCheckData.timeoutSeconds % 1 == 0 && origCheckData.timeoutSeconds >= 1 && origCheckData.timeoutSeconds <= 5 ? origCheckData.timeoutSeconds : false;


  // Set the Keys that may not be already set (if workers have not seen them before)
  origCheckData.state = typeof(origCheckData.state) == 'string' && ['up', 'down'].indexOf(origCheckData.state) > -1 ? origCheckData.state : 'down';
  origCheckData.lastChecked = typeof(origCheckData.lastChecked) == 'number' && origCheckData.lastChecked > 0 ? origCheckData.lastChecked : false;

  // If all checks passed, pass data to the next step of processing
  if (origCheckData.id &&
    origCheckData.userPhone &&
    origCheckData.protocol &&
    origCheckData.url &&
    origCheckData.method &&
    origCheckData.successCodes &&
    origCheckData.timeoutSeconds) {
    workers.performCheck(origCheckData);
  } else {
    debug('Error: a check may not be properly formatted. Skipping it.');
  }
};


// Perform the check; send outcome of checking origCheckData to the next step in processing.
workers.performCheck = function(origCheckData) {
  // Prepare the initial check outcome
  let checkOutcome = {
    'error': false,
    'responseCode': false
  };

  // Mark that the outcome has not yet been sent.
  let outcomeSent = false;

  // Parse the hostname and the path out of the Original Check Data.
  const parsedUrl = url.parse(origCheckData.protocol + '://' + origCheckData.url, true);
  const hostName = parsedUrl.hostname;
  const path = parsedUrl.path; // Using "path" and NOT "pathname" in order to obtain FULL query string


  // Consruct the request
  const requestDetails = {
    'protocol': origCheckData.protocol + ':',
    'hostname': hostName,
    'method': origCheckData.method.toUpperCase(),
    'path': path,
    'timeout': origCheckData.timeoutSeconds * 1000
  };

  // Instantiate the request object using either the HTTP, or HTTPS module
  let _moduleToUse = origCheckData.protocol == 'http' ? http : https;
  let req = _moduleToUse.request(requestDetails, function(res) {
      // Get the status ot the request.
      const status = res.statusCode;

      // Update the checkOutcome object and pass the data along
      checkOutcome.responseCode = status;
      if (!outcomeSent) {
        workers.processCheckOutcome(origCheckData, checkOutcome);
        outcomeSent = true;
      }
    });

  // Bind to the Error event so that it does not get thrown.
  req.on('error', function(e) {
    // Update the checkOutcome object and pass the data along
    checkOutcome.error = {
      'error': true,
      'value': e
    };
    if (!outcomeSent) {
      workers.processCheckOutcome(origCheckData, checkOutcome);
      outcomeSent = true;
    }
  });

  // Bind to timeout event.
  req.on('timeout', function() {
      // Update the checkOutcome object and pass the data along
      checkOutcome.error = {
        'error': true,
        'value': 'timeout'
      };
      if (!outcomeSent) {
        workers.processCheckOutcome(origCheckData, checkOutcome);
        outcomeSent = true;
      }
    });

  // End the request
  req.end();
};

// Process the check outcome, update the check data as needed
// and trigger an alert to the user, it needed.
// *Special Logic* for accommodating a check that has never been tested before.
// Do not alert user to this.
workers.processCheckOutcome = function(origCheckData, checkOutcome) {
  // Determine whether current state is Up, or Down
  const state = !checkOutcome.error && checkOutcome.responseCode && origCheckData.successCodes.indexOf(checkOutcome.responseCode) > -1 ? 'up' : 'down';

  // Is an alert warranted?
  const alertWarranted = origCheckData.lastChecked && (origCheckData.state !== state) ? true : false;

  // LOGGING TO FILE — LESSON START
  let timeOfCheck = ts;
  workers.log(origCheckData, checkOutcome, state, alertWarranted, timeOfCheck);

  // Update the check data
  const newCheckData = origCheckData;
  newCheckData.state = state;
  newCheckData.lastChecked = timeOfCheck;


  // Save the updates
  _data.update('checks', newCheckData.id, newCheckData, function(err) {
      if (!err) {
        // Send the new check to the next step in the process, if constd
        if (alertWarranted) {
          workers.alertUserOfStatus(newCheckData);
        } else {
          debug('Check outcome has not changed. No alert needed.');
        }
      } else {
        debug('Error: unable to save updates to a check');
      }
    });
};


// Alert user to change of check status
workers.alertUserOfStatus = function(newCheckData) {
  const msg = 'Alert: your check for ' + newCheckData.method.toUpperCase() + ' ' + newCheckData.protocol + '://' + newCheckData.url + ' is currently ' + newCheckData.state;
  helpers.sendTwilioSms(newCheckData.userPhone, msg, function(err) {
      if (!err) {
        debug('Success! User was alerted of status change in their checks, via SMS.\n' + msg);
      } else {
        debug('Error: Unable to alert user of their check state change:', err);
      }
    });
};


// Log data to file.
workers.log = function(origCheckData, checkOutcome, state, alertWarranted, timeOfCheck) {
  // Form the Log data.
  const logData = {
    'check': origCheckData,
    'outcome': checkOutcome,
    'state': state,
    'alert': alertWarranted,
    'time': timeOfCheck
  };

  // Convert logData to a String.
  const logString = JSON.stringify(logData);

  // Determine the name of the log file.
  const logFileName = origCheckData.id;

  // Append thre logString to the file.
  _logs.append(logFileName, logString, function(err) {
      if (!err) {
        debug('Logging to file: successful.');
      } else {
        debug('Could not log to file.');
      }
    });

};


// Timed process; worker loops through checks once per minute.
workers.loop = function() {
  setInterval( function() {
      workers.gatherAllChecks();
    }, 1000 * 60);
};

// Rotate (compress) the log files.
workers.rotateLogs = function() {
  // List all non-compressed log files.
  _logs.list(false, function(err, logs) {
      if (!err && logs && logs.length > 0) {
        logs.forEach( function(logName) {
            // Compresss log data to specific files
            const logID = logName.replace('.log', '');
            const newFileID = logID + '-' + ts;
            _logs.compress(logID, newFileID, function(err) {
                if (!err) {
                  // Truncating (emptying) the original log file.
                  _logs.ftruncate(logID, function(err) {
                      if (!err) {
                        debug('Successfully truncated log file.');
                      } else {
                        debug('file truncation unsuccessful:', err);
                      }
                    });
                } else {
                  debug('Could not compress file(s):', err);
                }
              });
          });
      } else {
        debug('Error: could not find any logs to rotate.');
      }
    });
};

// Log-rotation timer function; rotates (compresses) logs once a day.
workers.logRotationLoop = function() {
  setInterval( function() {
      workers.rotateLogs();
    }, 1000 * 60 * 60 * 24);
};

// Initialise the Web-workers
workers.init = function() {

  // Send to console in Yellow.
  console.log('\x1b[33m%s\x1b[0m', 'Background workers are running.');
  // Execute all the checks immediately
  workers.gatherAllChecks();
  // Call a loop that causes persistent checks.
  workers.loop();
  // Compress all logs immediately
  workers.rotateLogs();
  // Call  the compression loop, so logs will be compressed later on.
  workers.logRotationLoop();
};


// Export the Web-workers module
module.exports = workers;