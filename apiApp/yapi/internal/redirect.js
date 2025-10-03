const fs = require('fs')
const path = require('path')

const { exec } = require('child_process')
const crypto = require('crypto')

const { validationResult } = require('express-validator');
const superagent = require('superagent');
const { info } = require('console');

const util = require('../../lib/utils');


exports.getRedirect = (req, res) => {
    let redirectUrl
    let redirectDomain

    let userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))
    const srcKey = userFileObj.SRC_KEY


    const sslFileObj = JSON.parse(util.betterReadFile( './highProxy/config/ssl.json'))
    sslFileObj.forEach(sslInfo =>  {
        const formattedLink = `https://${sslInfo.domain}/?${srcKey}`
        if (sslInfo.isRedirect) {
            redirectDomain = sslInfo.domain
            redirectUrl = formattedLink
        }
        
    })
    let cloudflare_gen_link = userFileObj.CF_WORKER_URL || ''

    // const salt = crypto.randomBytes(16).toString('hex');
    // const key = crypto.pbkdf2Sync(str, salt, 100000, 32, 'sha512');

    let publicKeyPem = null

    if (util.betterFileExists('./highProxy/config/redirect-key.pem')) {


        const privateKeyPem = util.betterReadFile( './highProxy/config/redirect-key.pem', 'utf8');


        const privateKey = crypto.createPrivateKey(privateKeyPem);

        const publicKey = crypto.createPublicKey(privateKey);
        
        publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' });
    }
  

    const redirectObj = {
        redirect: redirectUrl,
        publicKey: publicKeyPem
    }

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully fetched redirect`,
        info: redirectObj,
    })

}

exports.setRedirect = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }
    
    let domainName = req.body.domain
    domainName = domainName.toLowerCase();


    const sslFileObj = JSON.parse(util.betterReadFile( './highProxy/config/ssl.json'))

    if (sslFileObj.length < 2) {
        return res.json({
            status: "Error",
            error: 'Low Domain count',
            code: 1,
            message: "To use redirect you need to have atleast 2 domains added...",
        })
    }

    const domainValueList = sslFileObj.map(obj => obj.domain);

    if (domainValueList.indexOf(domainName) === -1) {
        console.error('Domain does not exists')
        return res.json({
            status: "Error",
            error: 'Invalid Domain',
            code: 1,
            message: "Domain Does not exist, please check domain name...",
        })
    } else {

        sslFileObj.forEach(sslInfo =>  {
            if (sslInfo.domain === domainName) {
                sslInfo.isRedirect = true;
            } else {
                sslInfo.isRedirect = false;
            }
        })



        util.betterWriteFile('./highProxy/config/ssl.json', JSON.stringify(sslFileObj, '', 4))

        // const salt = crypto.randomBytes(16).toString('hex');

        // const key = crypto.pbkdf2Sync(str, salt, 100000, 32, 'sha512');
      
        const { privateKey } = crypto.generateKeyPairSync('rsa', {
            modulusLength: 2048,
            publicKeyEncoding: { type: 'spki', format: 'pem' },
            privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
          });
        
        util.betterWriteFile('./highProxy/config/redirect-key.pem', privateKey);

        executeSETRedirectEffects()

      
        return res.json({
            status: "Success",
            error: null,
            code: 0,
            message: `Successfully set Redirect to  ${domainName}, Please Restart highProxy to effect changes`,
            info: domainName,
        })
    }
}


exports.disableRedirect = (req, res) => {
    
    const sslFileObj = JSON.parse(util.betterReadFile( './highProxy/config/ssl.json'))
    
    sslFileObj.forEach(sslInfo =>  {
        if (sslInfo.isRedirect) {
            sslInfo.isRedirect = false
        }
        
    })

    util.betterWriteFile('./highProxy/config/ssl.json', JSON.stringify(sslFileObj, '', 4))


    if (util.betterFileExists('./highProxy/config/redirect-key.pem')) {

        fs.unlinkSync('./highProxy/config/redirect-key.pem')
        
    }


    executeSETRedirectEffects()

      
    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully DISABLED Redirect`,
        info: 'Delete Sucess',
    })
}

const executeSETRedirectEffects = () => {
    const userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    if (userFileObj.ANTIBOT === 'TURNSTILE') {
        userFileObj.ANTIBOT = 'OFF'
        util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj))
    }

    if (util.betterFileExists('./highProxy/config/addon.json')) {
        const addonFileObj = JSON.parse(util.betterReadFile( './highProxy/config/addon.json'))
        addonFileObj.cfw = []
        util.betterWriteFile('./highProxy/config/addon.json', JSON.stringify(addonFileObj))
    }


}