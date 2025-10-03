/* eslint-disable no-underscore-dangle */

const { EventEmitter } = require('eventemitter3');
const Cookies = require('cookies')
const logger = require('./logger')
const ClientContext = require('./clientcontext')




const keys = ['Test working function']

module.exports = class PsStore {

    constructor() {
        this._pss = {}
        this.serverProxy = null
        this._clientDataState = {}
        this.cookieValue = 'qPdM'
        this.syncEvents = new EventEmitter();
    }

    makeNewState(req, tok, cB) {

        const cliContext = new ClientContext(tok)
        cliContext.loadData(req, (status) => {
            if (!status) {
                logger.warn('Failed to Set Client Context Data')
                cB(null)
            } else {
                cB(cliContext)
            }
        })
    }

    getEventEmitter() {
        return this.syncEvents
    }

    getServerProxy() {
        return this.serverProxy
    }

    getClientOnly(req, res) {

    }

    verifyClient(req, res) {
        const cookies = new Cookies(req, res, { keys, sameSite: 'none', secure: true })
        const rv = cookies.get(this.cookieValue)
        if (!rv || !(rv in this._clientDataState)) {
            return null
        } 
        this.checkForTermination(rv)
        return this._clientDataState[rv]
    }

    reloadClient(req, res, token) {
        if (!token || !(token in this._clientDataState)) {
            return null
        } 

        const cookies = new Cookies(req, res, { keys, sameSite: 'none'})
        cookies.set(this.cookieValue, token, { sameSite: 'none' })

        const clientContext = this._clientDataState[token]


        return clientContext;
    }


    loadClient(req, res, cB) {
        const cookies = new Cookies(req, res, { keys, sameSite: 'none' })
        const rv = cookies.get(this.cookieValue)
   
        const uidTok = !rv ? this.generateUniqueID() : rv
        this.makeNewState(req, uidTok, (newClientContext) => {
            if (newClientContext === null) {
                cB(null)
            } else {
                this._clientDataState[uidTok] = newClientContext
                if (!rv) {
                    cookies.set(this.cookieValue, uidTok, { keys, sameSite: 'none' })
                }
                cB(newClientContext)
            }
        })

 

    }

    checkForTermination(rv) {
       // logger.info('Checking Fore Termination Disabled ' + rv)

    }

    addNewPS(messageProxy) {
        const uidNew = this.generateUniqueID()
        messageProxy.setServerProxy(this.setServerProxy)

        this._pss[uidNew] = messageProxy
    }

    removePS(uid) {
        delete this._pss[uid]
    }


    generateUniqueID() {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        for (let i = 0; i < 12; i += 1) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        if (result in this._pss || result in this._clientDataState) {
            return this.generateUniqueID()
        }
        return result
    }

}
