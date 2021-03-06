/**
 * This is a library for storing and rotating logs.
 * 
 */
 
// Dependencies
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Container for the module
const lib = {};


// Base directory of the '.logs' directory.
lib.baseDir = path.join(__dirname,'/../.logs/');

// : append. Append string to file; create file if it does not exist.
lib.append = function(file, str, callback) {
  // Open file for appending
  fs.open(lib.baseDir + file + '.log','a', function(err, fileDescriptor) {
    if(!err && fileDescriptor) {
      // Append to file, then close it.
      fs.appendFile(fileDescriptor, str + '\n', function(err) {
        if(!err) {
          // close file.
          fs.close(fileDescriptor, function(err) {
            if(!err) {
              callback(false);
            } else {
              callback('Error closing appended file.');
            }
          });
        } else {
          callback('Error appending to file.');
        }
      });
    } else {
      callback('Could not open file for appending.');
    }
  });
};

// List all logs; optionally include the compressed logs.
lib.list = function(includeCompressedLogs, callback) {
  fs.readdir(lib.baseDir, function(err, data) {
    if(!err && data && data.length > 0) {
      const trimmedFileNames = [];
      data.forEach( function(fileName) {
        // Add the .log files.
        if(fileName.indexOf('.log') > -1) {
          trimmedFileNames.push(fileName.replace('.log', ''));
        }
        
        // Optionally add the compressed (.gz) files.
        if(fileName.indexOf('.gz.b64') > -1 && includeCompressedLogs) {
          trimmedFileNames.push(fileName.replace('.gz.b64', ''));
        }
      });
      callback(false, trimmedFileNames);
    } else {
      callback(err, data);
    }
  });
};


// Compress a .log file to a .gz.b64 file within the same directory.
lib.compress = function(logID, newFileID,callback) {
  const sourceFile = logID + '.log';
  const destFile = newFileID + '.gz.b64';
  
  // Read the source file.
  fs.readFile(lib.baseDir + sourceFile, 'utf-8', function(err, inputString) {
    if(!err && inputString) {
      // Compress the data using gzip.
      zlib.gzip(inputString, function(err, buffer) {
        if(!err && buffer) {
          // Send compressed (archived) data to the Destination file.
          fs.open(lib.baseDir + destFile, 'wx', function(err, fileDescriptor) {
            if(!err && fileDescriptor) {
              // Write to the Destination file.
              fs.writeFile(fileDescriptor, buffer.toString('base64'), function(err) {
                if(!err) {
                  // close the Destination file.
                  fs.close(fileDescriptor, function(err) {
                    if(!err) {
                      callback(false);
                    } else {
                      callback(err);
                    }
                  });
                } else {
                  callback(err);
                }
              });
            } else {
              callback(err);
            }
          });
        } else {
          callback(err);
        }
      });
    } else {
      callback(err);
    } 
  });
};


// Decompress data in a .gz.b64 archive into a string variable.
lib.decompress = function(fileID, callback) {
  const fileName = fileID + '.gz.b64';
  fs.readFile(lib.baseDir + fileName, 'utf-8', function(err, str) {
    if(!err && str) {
      // Inflate the data.
      const inputBuffer = Buffer.from(str, 'base64');
      zlib.unzip(inputBuffer, function(err, outputBuffer) {
        if(!err && outputBuffer) {
          // callback the str(ing).
          const str = outputBuffer.toString();
          callback(false, str);
        } else {
          callback(err);
        }
      });
    } else {
      callback(err);
    }
  });
};


// Truncate (empty) the log file.
lib.ftruncate = function(logID, callback) {
  fs.ftruncate(lib.baseDir + logID + '.log', 0, function(err) {
    if(!err) {
      callback(false);
    } else {
      callback(err);
    } 
  });
};

// Export the module
module.exports = lib; 