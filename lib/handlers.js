/**
* The REQUEST handlers.
*
*/


// Dependencies
const _data = require('./data');
const helpers = require('./helpers');
const config = require('./config');

// Define the Handlers.
const handlers = {};

/**
 * HTML Handlers
 * 
 */

// Index Handler
handlers.index = function(data, callback) {
  // Reject any request that is not a GET
  if (data.method == 'get') {
    // Prepare data for interpolation
    const templateData = {
      'head.title': 'This is the Title',
      'head.description': 'This is the meta-description',
      'body.title': 'Hello templated world!',
      'body.class': 'index'
    };

    // Read-in a template as a string.
    helpers.getTemplate('index', templateData, function(err, str) {
        if (!err && str) {
          // Add the Universal header-footer template
          helpers.addUniversalTemplates(str, templateData, function(err, str) {
              if (!err && str) {
                callback(200, str, 'html');
              } else {
                callback(500, undefined, 'html');
              }
            });
        } else {
          callback(500, undefined, 'html');
        }
      });
  } else {
    callback(405, undefined, 'html');
  }
};


// Favicon Handler
handlers.favicon = function(data, callback) {
  // Reject any method that is not a "GET"
  if(data.method == 'get') {
    // Read-in the favicon data.
    helpers.getStaticAsset('./favicon.ico', function(err, data) {
      if(!err && data) {
        // Get the data.
        callback(200, data, 'favicon');
      } else {
        callback(500);
      }
    });
  } else {
    callback(405);
  }
};

// Public Assets
handlers.public = function(data, callback) {
  // Reject any method not a "GET"
  if(data.method == 'get') {
    // Determine the filename requested (trim 'public.' require the filename string).
    const trimmedAssetName = data.trimmedPath.replace('public/','').trim();
    if(trimmedAssetName.length > 0) {
      // Read-in the asset's data
      helpers.getStaticAsset(trimmedAssetName, function(err, data) {
        if(!err && data) {
          // Declare contentType variable
          let contentType = '';
          
          // Determine content-type; 
          if(trimmedAssetName.indexOf('.css') > -1) {
            contentType == 'css';
          } else if(trimmedAssetName.indexOf('.png') > -1) {
            contentType == 'png';
          } else if(trimmedAssetName.indexOf('.jpg') > -1) {
            contentType == 'jpg';
          } else if(trimmedAssetName.indexOf('.ico') > -1) {
            contentType == 'favicon';
          } else {
            // default to plain-text.
            contentType = 'plain';
          }
        
          // Get the data.
          callback(200, data, contentType);
        } else {
          callback(404);
        }
      });
    } else {
      callback(404);
    }
  } else {
    callback(405);
  }
};

/**
 * JSON API Handlers
 * 
 */

// Ping handler checks that all is okay with the server.
handlers.ping = function(data, callback) {
  // callback a HTTP status code.
  callback(200);
};

// Define the 'Not found' Handler.
handlers.notFound = function(data, callback) {
  callback(404); // payload not needed.
};

// Users handler
handlers.users = (data, callback) => {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._users[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for Users sub-methods
handlers._users = {};

// Users 'Post' Sub-method.
// Required data: firstName, lastName, phone, password, tosAgreement.
// Optional data: none.
handlers._users.post = function(data, callback) {
  // Check that all required fields are filled in.
  const firstName = typeof(data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim(): false;
  const lastName = typeof(data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim(): false;
  const phone = typeof(data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim(): false;
  const password = typeof(data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim(): false;
  const tosAgreement = typeof(data.payload.tosAgreement) == 'boolean' && data.payload.tosAgreement == true ? true: false;

  if (firstName && lastName && phone && password && tosAgreement) {
    // Make sure that User does not already exist.
    _data.read('users', phone, function(err, data) {
      if (err) {
        // Hash the password
        let hashedPassword = helpers.hash(password);
        
        // Create the User Object.
        if (hashedPassword) {
          const userObject = {
            'firstName': firstName,
            'lastName': lastName,
            'phone': phone,
            'hashedPassword': hashedPassword,
            'tosAgreement': true
          };
          
          // Store the User
          _data.create('users', phone, userObject, function(err) {
              if (!err) {
                callback(200);
              } else {
                callback(500, {
                  'Error:': 'Could not create user.'
                });
              }
            });
        } else {
          callback(500, {
            'Error:': 'Could not hash user\'s password.'
          });
        }
      } else {
        // User already exists.
        callback(400, {
          'Error:': 'A user with that phone number already exists.'
        });
      }
    });
  } else {
    // Missing, or incorrect data.
    callback(400, {
      'Error:': 'Missing required field(s)'
    });
  }
};

// Users 'Get' Sub-method
// Required data: phone.
// Optional data: none.
// @todo Verified users are only able to access their own Object. Deny access to other users' objects. DONE.
handlers._users.get = function(data, callback) {
  // Check that phone number is valid
  const phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    // Get the token require the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    // verify provided token is valid for the phone number.
    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
        if (tokenIsValid) {
          // Look up the User.
          _data.read('users', phone, function(err, data) {
              if (!err && data) {
                // Remove hashed password require the user object before returning it to the requester.
                delete data.hashedPassword;
                // data require the .read function
                callback(200, data);
              } else {
                callback(404);
              }
            });
        } else {
          callback(403, {
            'Error': 'Missing token in header, or token is invalid.'
          });
        }
      });
  } else {
    callback(400, {
      'Error:': 'Missing Required field'
    });
  }
};

// Users 'Put' Sub-method
// Required data: phone.
// Optional data: firstName, lastName, password (at least one must be specified).
// @todo Verified user can only update own object. Deny their updating other users.
handlers._users.put = function(data, callback) {
  // Check for the Required field
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  // Check for Optional fields
  const firstName = typeof (data.payload.firstName) == 'string' && data.payload.firstName.trim().length > 0 ? data.payload.firstName.trim() : false;
  const lastName = typeof (data.payload.lastName) == 'string' && data.payload.lastName.trim().length > 0 ? data.payload.lastName.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;

  // Throw Error if phone number is invalid.
  if (phone) {
    // Throw Error if nothing sent to Update
    if (firstName || lastName || password) {
      // Get token require the headers.
      const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
      // verify provided token is valid for the phone number.
      handlers._tokens.verifyToken(token, phone, (tokenIsValid) => {
          if (tokenIsValid) {
            //Look up user
            _data.read('users', phone, (err, userData) => {
                if (!err && userData) {
                  // Update fields is necessary
                  if (firstName) {
                    userData.firstName = firstName;
                  }
                  if (lastName) {
                    userData.lastName = lastName;
                  }
                  if (password) {
                    userData.hashedPassword = hash(hashedPassword);
                  }
                  // Store the new updates.
                  _data.update('users', phone, userData, (err) => {
                      if (!err) {
                        callback(200);
                      } else {
                        callback(500, {
                          'Error': 'Could not update the user.'
                        });
                      }
                    });
                } else {
                  callback(400, {
                    'Error:': ' No user with matching search terms.'
                  });
                }
              });
          } else {
            callback(403, {
              'Error': 'Missing token in header, or token is invalid.'
            });
          }
        });
    } else {
      callback(400, {
        'Error:': 'Missing fields to update'
      });
    }
  } else {
    callback(400, {
      'Error:': 'Missing required field'
    });
  }
};

// Users 'Delete' Sub-method
// Required data: phone.
// @todo Verified user can only delete own object. Deny their deleting other users' objects.
// @todo Delete all files associated with the user.
handlers._users.delete = function(data, callback) {
  // Check that phone number is valid.
  const phone = typeof (data.queryStringObject.phone) == 'string' && data.queryStringObject.phone.trim().length == 10 ? data.queryStringObject.phone.trim() : false;
  if (phone) {
    // Get the token require the headers
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    // verify provided token is valid for the phone number.
    handlers._tokens.verifyToken(token, phone, function(tokenIsValid) {
        if (tokenIsValid) {
          // Look up the User.
          _data.read('users', phone, function(err, userData) {
              if (!err && userData) {
                _data.delete('users', phone, function(err) {
                  if (!err) {
                    // Delete each of the checks associated with the user.
                    let userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                    const checksToDelete = userChecks.length;
                    if (checksToDelete > 0) {
                      let checksDeleted = 0;
                      let deletionErrors = false;

                      // Loop through the checks.
                      userChecks.forEach(function(checkId) {
                          // Delete the check.
                          _data.delete('checks', checkId, function(err) {
                            if (err) {
                              deletionErrors = true;
                            }
                            checksDeleted += 1;
                            if (checksDeleted === checksToDelete) {
                              if (!deletionErrors) {
                                callback(200);
                              } else {
                                callback(500, { 'Error': 'A problem occurred. All user checks may not have been deleted.' });
                              }
                            }
                          });
                        });
                    } else {
                      callback(200);
                    }
                  } else {
                    callback(500, {
                      'Error:': 'User could not be deleted.'
                    });
                  }
                });
              } else {
                callback(400, {
                  'Error:': 'No user with matching search terms.'
                });
              }
            });
        } else {
          callback(403, {
            'Error': 'Missing token in header, or token is invalid.'
          });
        }
      });
  } else {
    callback(400, {
      'Error:': 'Missing Required field'
    });
  }
};

// Users handler - Tokens
handlers.tokens = function(data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._tokens[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for tokens methods
handlers._tokens = {};

// Tokens - post
// Required data: phone, password.
// Optional data: none.
handlers._tokens.post = function(data, callback) {
  // Check that all required fields are filled in.
  const phone = typeof (data.payload.phone) == 'string' && data.payload.phone.trim().length == 10 ? data.payload.phone.trim() : false;
  const password = typeof (data.payload.password) == 'string' && data.payload.password.trim().length > 0 ? data.payload.password.trim() : false;
  if (phone && password) {
    // Look up user that matches the phone number.
    _data.read('users', phone, function(err, userData) {
        if (!err && userData) {
          // Hash the sent password and compare it to that stored in the user object
          const hashedPassword = helpers.hash(password);

          if (hashedPassword == userData.hashedPassword) {
            // If password valid, create new token with arbitrary name.
            const tokenId = helpers.createRandomString(20);
            // Set token expiration date 1 hour in the future.
            const expires = Date.now() + 1000 * 60 * 60;
            // Create token object.
            const tokenObject = {
              'phone': phone,
              'id': tokenId,
              'expires': expires
            };

            // Store the token.
            _data.create('tokens', tokenId, tokenObject, function(err) {
                if (!err) {
                  callback(200, tokenObject);
                } else {
                  callback(500, {
                    'Error:': 'Could not create a token.'
                  });
                }
              });
          } else {
            callback(400, {
              'Error:': 'Passwords did not match.'
            });
          }
        } else {
          callback(400, {
            'Error:': 'Could not find specified user.'
          });
        }
      });
  } else {
    callback(400, {
      'Error:': 'Missing required field(s)'
    });
  }
};

// Tokens - get
// Required data: id.
// Optional data: none.
handlers._tokens.get = function(data, callback) {
  // Check validity of ID.
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Look up the token.
    _data.read('tokens', id, function(err, tokenData) {
        if (!err && tokenData) {
          // data require the .read function
          callback(200, tokenData);
        } else {
          callback(404);
        }
      });
  } else {
    callback(400, {
      'Error': 'Missing required field, or field is invalid.'
    });
  }
};

// Tokens - put
// Required data: id, extend.
// Optional data: none.
handlers._tokens.put = function(data, callback) {
  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;
  const extend = typeof (data.payload.extend) == 'boolean' && data.payload.extend == true ? true : false;
  if (id && extend) {
    // Look up Token.
    _data.read('tokens', id, function(err, tokenData) {
        if (!err && tokenData) {
          // Check that token has not expired.
          if (tokenData.expires > Date.now()) {
            // Extend expiration by 1 hour
            tokenData.expires = Date.now() + 1000 * 60 * 60;
            // Store the updated data
            _data.update('tokens', id, tokenData, function(err) {
                if (!err) {
                  callback(200);
                } else {
                  callback(500, {
                    'Error:': 'Could not extend token expiration time.'
                  });
                }
              });
          } else {
            callback(400, {
              'Error:': 'Token expired. Cannot extend time.'
            });
          }
        } else {
          callback(400, {
            'Error:': 'Specified user does not exist.'
          });
        }
      });
  } else {
    callback(400, {
      'Error:': 'Missing, or invalid field(s).'
    });
  }
};

// Tokens - delete
// Required data: id.
// Optional data: none.
handlers._tokens.delete = function(data, callback) {
  // Check validity of ID.
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Look up the User.
    _data.read('tokens', id, function(err, data) { // Should it be 'tokenData'?
        if (!err && data) { // Ditto.
          _data.delete('tokens', id, function(err) {
            if (!err) {
              callback(200);
            } else {
              callback(500, {
                'Error:': 'Token could not be deleted.'
              });
            }
          });
        } else {
          callback(400, {
            'Error:': 'Token not found.'
          });
        }
      });
  } else {
    callback(400, {
      'Error:': 'Missing Required field'
    });
  }
};

// Verify that a provided token ID is vaild for current user.
handlers._tokens.verifyToken = function(id, phone, callback) {
  // Look up the token
  _data.read('tokens', id, function(err, tokenData) {
      if (!err && tokenData) {
        // Check token has not expired and is for given user.
        if (tokenData.phone == phone && tokenData.expires > Date.now()) {
          callback(true);
        } else {
          callback(false);
        }
      } else {
        callback(false);
      }
    });
};

// CHECKS - check if URL is up, or down
handlers.checks = function(data, callback) {
  let acceptableMethods = ['post', 'get', 'put', 'delete'];
  if (acceptableMethods.indexOf(data.method) > -1) {
    handlers._checks[data.method](data, callback);
  } else {
    callback(405);
  }
};

// Container for checks methods
handlers._checks = {};

// Checks - post
// Required data: protocol, url, method, successCodes, timeoutSeconds.
// Optional data: none.
handlers._checks.post = (data, callback) => {
  // Validate all inputs
  const protocol = typeof (data.payload.protocol) == 'string' && ['http','https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  let method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;

  if (protocol && url && method && successCodes && timeoutSeconds) {
    // Get token require the header.
    const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
    // Look up user by reading the token.
    _data.read('tokens', token, function(err, tokenData) {
        if (!err, tokenData) {
          //Get user's phone number
          const userPhone = tokenData.phone;
          // Look up user's data.
          _data.read('users', userPhone, function(err, userData) {
              if (!err && userData) {
                const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];
                // Verify that user has not reached maximum number of checks
                if (userChecks.length < config.maxChecks) {
                  // Create random ID for the check.
                  const checkId = helpers.createRandomString(20);

                  // Create the Check Object and include user's phone number.
                  const checkObject = {
                    'id': checkId,
                    'userPhone': userPhone,
                    'protocol': protocol,
                    'url': url,
                    'method': method,
                    'successCodes': successCodes,
                    'timeoutSeconds': timeoutSeconds
                  };

                  // Save the Object
                  _data.create('checks', checkId, checkObject, function(err) {
                      if (!err) {
                        // Add the checkId to the user's Object
                        userData.checks = userChecks;
                        userData.checks.push(checkId);

                        // Save the new user data
                        _data.update('users', userPhone, userData, function(err) {
                            if (!err) {
                              // Return the new check data
                              callback(200, checkObject);
                            } else {
                              callback(500, {
                                'Error': 'Could not update user with new check data.'
                              });
                            }
                          });
                      } else {
                        callback(500, {
                          'Error': 'Could not create the new checks.'
                        });
                      }
                    });
                } else {
                  callback(400, {
                    'Error': 'Maximum checks reached (' + config.maxChecks + ').'
                  });
                }
              } else {
                callback(403);
              }
            });
        } else {
          callback(403);
        }
      });
  } else {
    callback(400, {
      'Error': 'Missing required inputs, or inputs are invalid.'
    });
  }
};

// Checks - Get
// Required data: id.
// Optional data: none.
handlers._checks.get = function(data, callback) {
  // Check validity of ID.
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Look up the User.
    _data.read('checks', id, function(err, checkData) {
        if (!err && checkData) {
          // Get token require headers
          const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
          // Verify the token is valid for user who created the check.
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
              if (tokenIsValid) {
                // Return the check data.
                callback(200, checkData);
              } else {
                callback(403);
              }
            });
        } else {
          callback(404);
        }
      });
  } else {
    callback(400, {
      'Error': 'Missing required field'
    });
  }
};

// CHECKS - PUT
// Required data: id.
// Optional data: protocol, url, method, successCodes, timeoutSeconds.
// An option MUST be selected.
handlers._checks.put = function(data, callback) {
  // Check for the Required fields.
  const id = typeof (data.payload.id) == 'string' && data.payload.id.trim().length == 20 ? data.payload.id.trim() : false;

  // Check for the Optional fields.
  let protocol = typeof (data.payload.protocol) == 'string' && ['http', 'https'].indexOf(data.payload.protocol) > -1 ? data.payload.protocol : false;
  const url = typeof (data.payload.url) == 'string' && data.payload.url.trim().length > 0 ? data.payload.url.trim() : false;
  const method = typeof (data.payload.method) == 'string' && ['post', 'get', 'put', 'delete'].indexOf(data.payload.method) > -1 ? data.payload.method : false;
  const successCodes = typeof (data.payload.successCodes) == 'object' && data.payload.successCodes instanceof Array && data.payload.successCodes.length > 0 ? data.payload.successCodes : false;
  const timeoutSeconds = typeof (data.payload.timeoutSeconds) == 'number' && data.payload.timeoutSeconds % 1 == 0 && data.payload.timeoutSeconds >= 1 && data.payload.timeoutSeconds <= 5 ? data.payload.timeoutSeconds : false;
  
  // Make sure ID is valid.
  if (id) {
    // Make sure at least ONE option has been selected.
    if (protocol || url || method || successCodes || timeoutSeconds) {
      // Look up the check.
      _data.read('checks', id, function(err, checkData) {
        if (!err && checkData) {
          // Get token require headers
          const token = typeof(data.headers.token) == 'string' ? data.headers.token : false;
          // Verify the token is valid for user who created the check.
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
            if (tokenIsValid) {
              // Update the check where necessary.
              if (protocol) {
                checkData.protocol = protocol;
              }
              if (url) {
                checkData.url = url;
              }
              if (method) {
                checkData.method = method;
              }
              if (successCodes) {
                checkData.successCodes = successCodes;
              }
              if (timeoutSeconds) {
                checkData.timeoutSeconds = timeoutSeconds;
              }
              // Store the update
              _data.update('checks', id, checkData, function(err) {
                  if (!err) {
                    callback(200);
                  } else {
                    callback(500, {
                      'Error': 'Could not update the check'
                    });
                  }
                });
            } else {
              callback(403);
            }
          });
        } else {
          callback(400, {
            'Error': 'Check ID does not exist.'
          });
        }
      });
    } else {
      callback(400, {
        'Error': 'Missing fields to update.'
      });
    }
  } else {
    callback(400, {
      'Error': 'Missing required fields.'
    });
  }
};

// CHECKS - DELETE
// Required data: id.
// Optional data: none.
handlers._checks.delete = function(data, callback) {
  // Check that id is valid.
  const id = typeof (data.queryStringObject.id) == 'string' && data.queryStringObject.id.trim().length == 20 ? data.queryStringObject.id.trim() : false;
  if (id) {
    // Look up the check.
    _data.read('checks', id, function(err, checkData) {
        if (!err && checkData) {
          // Get the token require the headers
          const token = typeof (data.headers.token) == 'string' ? data.headers.token : false;
          // verify provided token is valid for the phone number.
          handlers._tokens.verifyToken(token, checkData.userPhone, function(tokenIsValid) {
              if (tokenIsValid) {

                // Delete the check data.
                _data.delete('checks', id, function(err) {
                  if (!err) {
                    // Look up the User.
                    _data.read('users', checkData.userPhone, function(err, userData) {
                      if (!err && userData) {
                        const userChecks = typeof (userData.checks) == 'object' && userData.checks instanceof Array ? userData.checks : [];

                        // Remove the deleted check require the list of checks.
                        const checkPosition = userChecks.indexOf(id);
                        if (checkPosition > -1) {
                          userChecks.splice(checkPosition, 1);
                          // Re-save user's data.
                          _data.update('users', checkData.userPhone, userData, function(err) {
                              if (!err) {
                                callback(200);
                              } else {
                                callback(500, {
                                  'Error': 'User could not be updated.'
                                });
                              }
                            });
                        } else {
                          callback(500, {
                            'Error': 'Check on user\'s object not found. Could not remove check. '
                          });
                        }
                      } else {
                        callback(500, {
                          'Error': 'User check creator not found. Could not remove list of checks on the user object.'
                        });
                      }
                    });
                  } else {
                    callback(500, {
                      'Error': 'Could not delete Check data.'
                    });
                  }
                });
              } else {
                callback(403);
              }
            });
        } else {
          callback(400, {
            'Error': 'Check ID does not exist.'
          });
        }
      });
  } else {
    callback(400, {
      'Error': 'Missing Required field'
    });
  }
};


// Export handlers
module.exports = handlers;