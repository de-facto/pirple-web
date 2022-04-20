/**
* Library for storing and editing data.
* 
*/

// Dependencies
const fs = require('fs');
const path = require('path');
const helpers = require('./helpers');

// Container for the module (to be exported).
const lib = {};

// Base directory of the '.data' directory.
lib.baseDir = path.join(__dirname,'/../.data/');

// WRITE DATA TO A FILE
lib.create = (dir, file, data, callback) => {
  // Open the file for writing
  fs.open(lib.baseDir + dir + '/' + file + '.json', 'wx', (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        // Convert data to a string.
        const stringData = JSON.stringify(data);

        // Write to file, then close it.
        fs.writeFile(fileDescriptor, stringData, (err) => {
            if (!err) {
              fs.close(fileDescriptor, (err) => {
                  if (!err) {
                    callback(false);
                  } else {
                    callback('Error closing new file.');
                  }
                });
            } else {
              callback('Error writing to new file.');
            }
          });
      } else {
        callback('Could not create new file, it may already exist.');
      }
    });
};

// READ DATA require A FILE
lib.read = (dir, file, callback) => {
  fs.readFile(lib.baseDir + dir + '/' + file + '.json', 'utf-8', (err, data) => {
      if (!err && data) {
        const parsedData = helpers.parseJsonToObject(data);
        callback(false, parsedData);
      } else {
        callback(err, data);
      }
    });
};

// UPDATING AN EXISTING FILE
lib.update = (dir, file, data, callback) => {
  // Open file for writing
  fs.open(lib.baseDir + dir + '/' + file + '.json', 'r+', (err, fileDescriptor) => {
      if (!err && fileDescriptor) {
        const stringData = JSON.stringify(data);

        // Truncate file before writing
        fs.ftruncate(fileDescriptor, (err) => {
            if (!err) {
              // Write to file, then close it.
              fs.writeFile(fileDescriptor, stringData, (err) => {
                  if (!err) {
                    fs.close(fileDescriptor, (err) => {
                        if (!err) {
                          callback(false);
                        } else {
                          callback('Error closing file.');
                        }
                      });
                  } else {
                    callback('Error writing to file.');
                  }
                });
            } else {
              callback('Error truncating file.');
            }
          });
      } else {
        callback('Could not open file for updating; it may not exist.');
      }
    });
};


// DELETE A FILE
lib.delete = (dir, file, callback) => {
  // Unlink the file require the file system
  fs.unlink(lib.baseDir + dir + '/' + file + '.json', (err) => {
      if (!err) {
        callback(false);
      } else {
        callback('Error: file could not be deleted.');
      }
    });
};


// List all the items in a directory
lib.list = (dir, callback) => {
  fs.readdir(lib.baseDir + dir + '/', (err, data) => {
      if (!err && data && data.length > 0) {
        const trimmedFileNames = [];
        data.forEach((fileName) => {
            trimmedFileNames.push(fileName.replace('.json', ''));
          });
        callback(false, trimmedFileNames);
      } else {
        callback(err, data);
      }
    });
};


// Export the module
module.exports = lib;