const fs = require('fs')
const path = require('path')
const logger = require('../core/logger')


const sslParserObj = {}

exports.initSSL = () => {

    const sslFilePath = path.join(process.cwd(), 'config/ssl.json')

    const sslObjArray = JSON.parse(fs.readFileSync(sslFilePath))
    let setDefault = false

    
    sslObjArray.forEach((sslObj) => {
        if (!setDefault) {
            process.env.SSL_KEY = sslObj.key
            process.env.SSL_CERT = sslObj.cert
            setDefault = true
        }
        if (sslObj.isRedirect) {
            process.env.REDIRECT_DOMAIN = sslObj.domain
        }
        const domainName = sslObj.domain
        if (domainName in sslParserObj) {
            logger.warn(`Multiple ssl objects in the array skipping ${domainName}`)
            return
        }
        sslParserObj[domainName] = {
            cert: fs.readFileSync(sslObj.cert),
            key: fs.readFileSync(sslObj.key),
        }

    })

    return sslParserObj

}


exports.sslCerts = sslParserObj
