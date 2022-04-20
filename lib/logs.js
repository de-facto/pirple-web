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
lib.append = (file, str, callback) => {
  // Open file for appending
  fs.open(lib.baseDir + file + '.log','a', (err, fileDescriptor) => {
    if(!err && fileDescriptor) {
      // Append to file, then close it.
      fs.appendFile(fileDescriptor, str + '\n', (err) => {
        if(!err) {
          // close file.
          fs.close(fileDescriptor, (err) => {
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
lib.list = (includeCompLogs, callback) => {
  fs.readdir(lib.baseDir, (err, data) => {
    if(!err && data && data.length > 0) {
      const trimmedFileNames = [];
      data.forEach((fileName) => {
        // Add the .log files.
        if(fileName.indexOf('.log') > -1) {
          trimmedFileNames.push(fileName.replace('.log', ''));
        }
        
        // Optionally add the compressed (.gz) files.
        if(fileName.indexOf('.gz.b64') > -1 && includeCompLogs) {
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
lib.compress = (logID, newFileID,callback) => {
  const sourceFile = logID + '.log';
  const destFile = newFileID + '.gz.b64';
  
  // Read the source file.
  fs.readFile(lib.baseDir + sourceFile, 'utf-8', (err, inputString) => {
    if(!err && inputString) {
      // Compress the data using gzip.
      zlib.gzip(inputString, (err, buffer) => {
        if(!err && buffer) {
          // Send compressed (archived) data to the Destination file.
          fs.open(lib.baseDir + destFile, 'wx', (err, fileDescriptor) => {
            if(!err && fileDescriptor) {
              // Write to the Destination file.
              fs.writeFile(fileDescriptor, buffer.toString('base64'), (err) => {
                if(!err) {
                  // close the Destination file.
                  fs.close(fileDescriptor, (err) => {
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
lib.decompress = (fileId, callback) => {
  const fileName = fileId + '.gz.b64';
  fs.readFile(lib.baseDir + fileName, 'utf-8', (err, str) => {
    if(!err && str) {
      // Inflate the data.
      const inputBuffer = Buffer.require(str, 'base64');
      zlib.unzip(inputBuffer, (err, outputBuffer) => {
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
lib.truncate = (logId, callback) => {
  fs.truncate(lib.baseDir + logId + '.log', 0, (err) => {
    if(!err) {
      callback(false);
    } else {
      callback(err);
    } 
  });
};

// Export the module
module.exports = lib; 