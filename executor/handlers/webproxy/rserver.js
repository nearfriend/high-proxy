const fs = require('fs')
const httpProxy = require('./deproxy/index');
const logger = require('../../core/logger')

const ClsIpPot = require('../../core/ippot')
const ePin = require('../../hook')

const webProxy = httpProxy.createProxyServer({});
// let agentConfig
let psStoreObj

module.exports = (cmdOpts, clientContext) => {

    psStoreObj = clientContext
    const agentConfig = req2Path(cmdOpts.req, cmdOpts.proxyDomain)

    console.log('Proxying to target: ', agentConfig.proxyTarget)
    console.log('Host domain: ', agentConfig.hostDomain)
    console.log('cmdOpts.proxyDomain: ', cmdOpts.proxyDomain)

    /** START PROXYING* */
    webProxy.web(cmdOpts.req, cmdOpts.res,
        {
            commands: {
                handleBody: cmdOpts.commands,
            },

            target: {
                protocol: 'https:',
                key: fs.readFileSync(process.env.SSL_KEY, 'utf8'),
                cert: fs.readFileSync(process.env.SSL_CERT, 'utf8'),

                // passphrase: 'changeit',
                path: agentConfig.path,
                hostname: agentConfig.proxyTarget,
                port: 443,
                rejectUnauthorized: false,
            },
            deHost: agentConfig.hostDomain,

            hostname: clientContext.hostname,
            // followRedirects: false,


            // secure: true,
            autoRewrite: true,
            changeOrigin: true,
            cookieDomainRewrite: true,
            // selfHandleResponse: true,
            ws: false,
        });
    return true
}

/** LISTEN ON REQUEST* */
webProxy.on('proxyReq', (proxyEndpoint, browserReq, res) => {
    /** We Send browser Request event */
    psStoreObj.getEventEmitter().emit('PROXY_REQUEST', proxyEndpoint, browserReq)
});

/** LISTEN ON RESPONSE* */
webProxy.on('proxyRes', (proxyMsg, req, browserResp) => {
    /** We Send proxy Response event */
    psStoreObj.getEventEmitter().emit('PROXY_RESPONSE', proxyMsg, browserResp)

});


const req2Path = (req, deepProxy) => {
    let prD = deepProxy || process.env.PROXY_DOMAIN
    const agentConfig = {
        proxyTarget: '',
        hostDomain: req.host,
        path: '',
    }
    if (!req.url.includes(process.env.SUBDOMAIN_CHAR)) {
        agentConfig.proxyTarget = prD
        return agentConfig
    }
    if (prD.startsWith('www.')) {
        prD = prD.slice(4)
    }
    const pSplit = req.url.split(process.env.SUBDOMAIN_CHAR)
    let theDomainPath = pSplit[0]
    const urlPath = pSplit[1]
    // eslint-disable-next-line no-useless-escape
    theDomainPath = theDomainPath.replace(/\//g, '')
    if (theDomainPath.startsWith('sub--')) {
        theDomainPath = theDomainPath.slice(5)
        logger.debug(`This is a subDomain....: ${theDomainPath}`)
        agentConfig.proxyTarget = theDomainPath === '' ? prD : `${theDomainPath}.${prD}`
    } else {
        logger.debug(`This is an external URL....: ${theDomainPath} --- ${urlPath.startsWith('?') ? `/${urlPath}` : urlPath}`)
        agentConfig.proxyTarget = theDomainPath === '' ? prD : theDomainPath
    }
    req.url = urlPath.startsWith('?') ? `/${urlPath}` : urlPath
    return agentConfig
}
