var fs = require('fs'),
    Stream = require('stream');

// From Nock
function isStream(obj) {
  return obj &&
      (typeof a !== 'string') &&
      (! Buffer.isBuffer(obj)) &&
      typeof obj.setEncoding === 'function';
}

/**
 * Request class
 *
 * @description This is the Request class for Hock. It represents a single request,
 * and the response to that request
 *
 * @param {object}      parent    the hock server this request belongs to
 * @param {object}      options
 * @param {String}      options.url         the route for the current request i.e. /foo/bar
 * @param {String|object}   [options.body]  optional request body
 *
 * @param {object}      [options.headers]   optional request headers
 * @param {object}      [options.method]    the method for the request (default=GET)
 *
 * @type {Function}
 */
module.exports = class Request {
  constructor(parent, options) {
    var self = this;

    this.method = options.method || 'GET';
    this.url = options.url;
    this.body = options.body || '';
    this.headers = options.headers || {};

    if (typeof options.body === 'object') {
      this.body = JSON.stringify(options.body);
    }

    Object.keys(this.headers).forEach(function (key) {
      self.headers[key.toLowerCase()] = self.headers[key];
      if (key.toLowerCase() !== key) {
        delete self.headers[key];
      }
    });

    this._defaultReplyHeaders = {};

    this._parent = parent;
    this._minRequests = 1;
    this._maxRequests = 1;
    this._count = 0;
  };

  /**
   * Request.reply
   *
   * @description provide the mocked reply for the current request
   *
   * @param {Number}          [statusCode]    Status Code for the response (200)
   * @param {String|object}   [body]          The body for the response
   * @param {object}          [headers]       Headers for the response
   * @returns {*}
   */
  reply(statusCode, body, headers) {
    this.response = {
      statusCode: statusCode || 200,
      body: body || '',
      headers: headers
    };

    this._parent.enqueue(this);

    return this._parent;
  };

  /**
   * Request.replyWithFile
   *
   * @description provide the mocked reply for the current request based on an input file
   *
   * @param {Number}          statusCode      Status Code for the response (200)
   * @param {String}          filePath        The path of the file to respond with
   * @param {object}          [headers]       Headers for the response
   * @returns {*}
   */
  replyWithFile(statusCode, filePath, headers) {
    this.response = {
      statusCode: statusCode || 200,
      body: fs.createReadStream(filePath),
      headers: headers
    };

    this._parent.enqueue(this);

    return this._parent;

  };

  /**
   * Request.many
   *
   * @decsription allow a request to match multiple queries at the same url.
   *
   * @param {object}    [options]       (default={min: 1, max: infinity})
   * @param {object}    [options.min]   minimum requests to be matched
   * @param {object}    [options.max]   max requests to be matched, must be >= min.
   * @returns {Request}
   */
  many(options) {
    options = options || {
      min: 1,
      max: Infinity
    };

    if (typeof options.min === 'number') {
      this._minRequests = options.min;
      if (this._minRequests > this._maxRequests) {
        this._maxRequests = this._minRequests;
      }
    }

    if (typeof options.max === 'number') {
      this._maxRequests = options.max;
    }

    return this;
  };

  /**
   * Request.min
   *
   * @description convenience function to provide a number for minimum requests
   *
   * @param {Number}    number    the value for min
   * @returns {Request}
   */
  min(number) {
    return this.many({ min: number });
  };

  /**
   * Request.max
   *
   * @description convenience function to provide a number for maximum requests
   *
   * @param {Number}    number    the value for max
   * @returns {Request}
   */
  max(number) {
    return this.many({ max: number });
  };

  /**
   * Request.once
   *
   * @description convenience function to set min, max to 1
   *
   * @returns {Request}
   */
  once() {
    return this.many({ min: 1, max: 1 });
  };

  /**
   * Request.twice
   *
   * @description convenience function to set min, max to 2
   *
   * @returns {Request}
   */
  twice() {
    return this.many({ min: 1, max: 2 });
  }

  /**
   * Request.any
   *
   * @description convenience function to set min 0, max to Infinity
   *
   * @returns {Request}
   */
  any() {
    return this.many({ min: 0, max: Infinity });
  }

  /**
   * Request.isMatch
   *
   * @description identify if the current request matches the provided request
   *
   * @param {object}      request   The request from the Hock server
   *
   * @returns {boolean|*}
   */
  isMatch(request) {
    var self = this;

    if (this._parent._pathFilter) {
      request.url = this._parent._pathFilter(request.url);
    }

    if (request.method === 'GET' || request.method === 'DELETE') {
      return this.method === request.method && request.url === this.url && checkHeaders();
    }
    else {
      var body = request.body;
      if (this._requestFilter) {
        body = this._requestFilter(request.body);
      }

      return this.method === request.method && this.url === request.url &&
        this.body === body && checkHeaders();

    }

    function checkHeaders() {
      var match = true;
      Object.keys(self.headers).forEach(function (key) {
        if (self.headers[key] && self.headers[key] !== request.headers[key]) {
          match = false;
        }
      });

      return match;
    }
  };

  /**
   * Request.sendResponse
   *
   * @description send the response to the provided Hock response
   *
   * @param {object}    response    The response object from the hock server
   */
  sendResponse(response) {
    var self = this;

    this._count++;

    var headers = this.response.headers || this._defaultReplyHeaders;

    response.writeHead(this.response.statusCode, headers);

    if (isStream(this.response.body)) {
      var readStream = this.response.body;

      if (this._maxRequests > 1) {
        // Because we need to respond with this body more than once, if it is a stream,
        // we make a buffer copy and use that as the body for future responses.
        var data = [];

        readStream.on('readable', function () {
          var chunk;
          while (null !== (chunk = readStream.read())) {
            data.push(chunk);
            response.write(chunk);
          }
        });
        readStream.on('end', function(){
          self.response.body = Buffer.concat(data);
          response.end();
        });
      }
      else {
        readStream.pipe(response);
      }
    }
    else if ((typeof this.response.body === 'object') && !Buffer.isBuffer(this.response.body)) {
      response.end(JSON.stringify(this.response.body));
    }
    else {
      response.end(this.response.body);
    }

    return this.shouldPrune();
  };

  /**
   * Request.isDone
   *
   * @description Identify if the current request has met its min and max requirements
   *
   * @returns {boolean}
   */
  isDone() {
    return !(this._count >= this._minRequests && this._count <= this._maxRequests);
  };

  /**
   * Request.shouldPrune
   *
   * @description Identify if the request has met its max requirement
   *
   * @returns {boolean}
   */
  shouldPrune() {
    return this._count >= this._maxRequests;
  };

  /**
   * Request.toJSON
   *
   * @returns {{method: *, url: *, body: *, headers: *, stats: {count: number, min: (Function|*|Object), max: *, isValid: *, shouldPrune: *}}}
   */
  toJSON() {
    return {
      method: this.method,
      url: this.url,
      body: this.body,
      headers: this.headers,
      stats: {
        count: this._count,
        min: this._minRequests,
        max: this._maxRequests,
        isDone: this.isDone(),
        shouldPrune: this.shouldPrune()
      }
    };
  };
}