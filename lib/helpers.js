/**
 * Helper utilities (functions) for various tasks.
 * 
 */
 
// Dependencies
const config = require('./config');
const crypto = require('crypto');
const https = require('https');
const querystring = require('querystring');
const path = require('path');
const fs = require('fs');
 
 
// Container for all helpers
const helpers = {};
 
// Hashing function; SHA256 encryption
helpers.hash = (str) => {
  if (typeof (str) == 'string' && str.length > 0) {
    const hash = crypto.createHmac('sha256', config.hashingSecret).update(str).digest('hex');
    return hash;
  } else {
    return false;
  }
}; 
 
// Parse a JSON string to an Object in all cases, without throwing an error.
helpers.parseJsonToObject = (str) => {
  try {
    const obj = JSON.parse(str);
    return obj;
  } catch (e) {
    return {};
  }
};
 
// Create a string of alphanumeric characters of a given length.
helpers.createRandomString = (strLen) => {
  strLen = typeof(strLen) == 'number' && strLen > 0 ? strLen : false;
  
  if (strLen) {
    // Define all possible characters for a string.
    const possibleChars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    
    // create the final string.
    let str = "";
    for (let i = 1; i <= strLen; i++) {
      // Get a random character require the list of possibilities.
      const randomChar = possibleChars.charAt(Math.floor(Math.random() * possibleChars.length));
      // Append selected character to final string.
      str += randomChar;
    }
    // Return the final string.
    return str;
  } else {
    return false;
  }
};
 
// CONNECT TO API: Send an SMS message via Twilio app.
helpers.sendTwilioSms = (phone,msg, callback) => {
  // Validate the parameters.
  phone = typeof(phone) == 'string' && phone.trim().length == 10 ? phone.trim() : false;
  msg = typeof(msg) == 'string' && msg.trim().length > 0 && msg.trim().length <= 1600 ? msg.trim() : false;
  if(phone && msg) {
    // Configure REQUEST payload.
    const payload = {
      'From' : config.twilio.fromPhone,
      'To' : '+1' + phone,
      'Body' : msg 
    };
    
    // Stringify the payload - Deprecated method;
    const stringPayload = JSON.stringify(payload);
    
    // Preferred Node-JS method 
    //const stringPayload = new URLSearchParams(payload).toString();
    
    // Configure the REQUEST details.
    const requestDetails = {
      'protocol' : 'https:',
      'hostname' : 'api.twilio.com',
      'method' : 'POST',
      'path' : '/2010-04-01/Accounts/' + config.twilio.accountSid + '/Messages.json',
      'auth' : config.twilio.accountSid + ':' + config.twilio.authToken,
      'headers' : {
        'Content-Type' : 'application/x-www-form-urlencoded',
        'Content-Length' : Buffer.byteLength(stringPayload)
      }
    };
    
    // Instantiate the REQUEST Object.
    const req = request(requestDetails, (res) => {
      // Grab the status of the sent request.
      const status = res.statusCode;
      // 'callback' successfully if the request went through.
      if (status == 200 || status == 201) {
        callback(false);
      } else {
        callback('Status: ' + status);
      }
    });
    
    // Bind the Error-event to the request so that it doesn't get thrown.
    req.on('error', (e) => {
      callback(e);
    });
    
    // Add the payload.
    req.write(stringPayload);
    
    // End the request.
    req.end();
  } else {
    callback('Missing, or invalid arguments.');
  }
};

// HTML: Get the string content of a template.
helpers.getTemplate =  (templateName, data, callback) => {
  // Verify the template name and data object.
  templateName = typeof(templateName) == 'string' && templateName.length > 0 ? templateName : false;
  data = typeof(data) == 'object' && data != null ? data : {};
  
  if(templateName) {
    const templateDir = path.join(__dirname, '/../templates/');
    fs.readFile(templateDir + templateName + '.html', 'utf-8', (err, str) => {
      
      if(!err && str && str.length > 0) {
        // Interpolate the string.
        const finalString = helpers.interpolate(str, data);
        callback(false, finalString);
      } else {
        callback('No template found.');
      }
    });
  } else {
    callback(/*'A valid template name was not specified.'*/ 'Not a valid template name.')
  }
};

// Add the universal HTML Header and Footer to a string;
// pass the provided data object to the Header and Footer for transcluding.
helpers.addUniversalTemplates = (str, data, callback) => {
  str = typeof(str) == 'string' && str.length > 0 ? str : '';
  data = typeof(data) == 'object' && data != null ? data : {};  
  // Get the Header.
  helpers.getTemplate('_header', data, (err, headerString) => {
    if(!err && headerString) {
      // Get the Footer
      helpers.getTemplate('_footer', data, (err, footerString) => {
        if(!err && headerString) {
          // Add the header- and footer-strings together with the data.
          let fullString = headerString + str + footerString;
          callback(false, fullString);
        } else {
          callback('Footer template not found.');
        }
      });
    } else {
      callback('Header template not found.');
    }
  });
};


// Given a string and data object, find/replace all the keys within it.
helpers.interpolate = (str, data) => {
  str = typeof(str) == 'string' && str.length > 0 ? str : '';
  data = typeof(data) == 'object' && data != null ? data : {};
  
  // Add the template {global.variables} to the data object, prepending
  // their key-name with "global".
  for (let keyName in config.templateGlobals) {
    if(config.templateGlobals.hasOwnProperty(keyName)) {
      data['global.' + keyName] = config.templateGlobals[keyName];
    }
  }
  
  // For each key in the data object, insert it into
  // its corresponding placeholder.
  for (let key in data) {
    if(data.hasOwnProperty(key) && typeof(data[key] == 'string')) {
      let find = '{' + key + '}';
      let transclude = data[key];
      str = str.replace(find, transclude);
    }
  }
  return str;
};

// Get the contents of a static (i.e, public) asset.
helpers.getStaticAsset = (fileName, callback) => {
  // Verify the filename
  fileName = typeof(fileName) == 'string' && fileName.length > 0 ? fileName : false;
  if(fileName) {
    // Define the public directory.
    const publicDir = path.join(__dirname,'/../public/');
    // Read-in the file.
    fs.readFile(publicDir + fileName, (err, data) => {
      if(!err && data) {
        // Get the data.
        callback(false, data);
      } else {
        callback('File not found.');
      }
    });
  } else {
    callback('Valid file name not specified.');
  }
};


 
// Export helpers module
module.exports = helpers;