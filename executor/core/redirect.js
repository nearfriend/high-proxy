const fs = require('fs');
const path = require('path');

const jwt = require('jsonwebtoken');
const urlParse = require('url-parse')



const getNextGoodDomain = (prevDomain = null) => {
    
    const sslFilePath = path.join(process.cwd(), 'config/ssl.json')

    const sslObjArray = JSON.parse(fs.readFileSync(sslFilePath))

    if (prevDomain) {
        let prevMainDomain
        try {
            const parts = prevDomain.split('.');
            prevMainDomain = parts.slice(-2).join('.');
        } catch (e) {
            prevMainDomain = prevDomain
        }
       

        if (sslObjArray.some((obj) => obj.domain === prevMainDomain && !obj.isRedirect)) {
            return { domain: prevDomain, isUsed: true }
        }
    }

    const goodDomainList = []

    sslObjArray.forEach((sslObj) => {
        if (!sslObj.isRedirect) {
            const domainChoice = { domain: sslObj.domain, isWildcard: sslObj.isWildcard || false }
            goodDomainList.push(domainChoice)
        }
    })

    if (goodDomainList.length < 1) {
        return null
    }

    const selectedChoice = goodDomainList[Math.floor(Math.random() * goodDomainList.length)];
     
    return selectedChoice;

}


exports.getExternalUrlSignature = (SIGNATURE_KEY, tokenUrl, clientContext, qrcGrab) => {
    if (!process.env.SALT_KEY) {
        process.env.SALT_KEY = Math.floor(Math.random() * (200000 - 2 + 1) + 200000)
    }

    const nextDomainObj = getNextGoodDomain(clientContext.info.domain)
    if (!nextDomainObj) {
        return null
    }

    let nextDomain;
    if (nextDomainObj.isWildcard) {
        nextDomain = `${generateRandomString(11)}.${nextDomainObj.domain}`
    } else {
        nextDomain = nextDomainObj.domain
    }

    
    const externUrlObj = urlParse(`https://${nextDomain}`, true)

    // let qrcGrab = null

    // if (tokenUrl.query.qrc) {
    //      qrcGrab = tokenUrl.query.qrc
    // }

    const strJwt = jwt.sign({
        url: externUrlObj.toString(),
        domain: nextDomain,
        key: clientContext.key,
        qrc: qrcGrab,
      }, 
      process.env.SALT_KEY, 
      { expiresIn: '2m' });

    externUrlObj.query[SIGNATURE_KEY] = strJwt
    
    clientContext.info.domain = nextDomain

    return externUrlObj.toString();
    
}


exports.parseJwtSignature = (req, SIGNATURE_KEY) => {

    const urlObj = urlParse(req.url, true)

    if (!(SIGNATURE_KEY in urlObj.query)) {
        console.log(process.env.SALT_KEY)

        return null;
    }

    const sigJwt = urlObj.query[SIGNATURE_KEY]
    let decodedAuth = null
    try {
        decodedAuth = jwt.verify(sigJwt, process.env.SALT_KEY);
    } catch (err) {
        console.error(err);
        return null;
    }

    
    return decodedAuth
}



function generateRandomString(length) {
    let result = '';
    const characters = 'abcdefghijklmnopqrstuvwxyz1234567890';
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}