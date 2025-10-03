/* eslint-disable no-else-return */
const urlParse = require('url-parse');
const TokenManager = require('./token-manager');

const internalChallenge = require('./internal-challenge');
const hcaptchaChallenge = require('./hcaptcha-challenge');
const turnstileChallenge = require('./turnstile-challenge');


const captchaManager = new TokenManager()

exports.challengeUser = (req, res, clientContext) => {
    const urlObj = urlParse(req.url, true)

    const newCaptchaToken = captchaManager.createToken(clientContext)

    urlObj.query[process.env.SRC_KEY] = newCaptchaToken

    const formattedUrl = urlObj.toString()
    res.writeHead(302, { location: formattedUrl })
    return res.end()
}

exports.execCaptcha = (req, res, srcData, cBack) => {
    const clientContext = captchaManager.verifyToken(srcData)
    if (!clientContext) {
        return cBack(false)
    }

    let htmlStr 

    if (req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' })
        
        if (process.env.ANTIBOT === 'INTERNAL') {
            htmlStr = internalChallenge.getChallengeHtml()

        } else if (process.env.ANTIBOT === 'EXTERNAL') {
            htmlStr = hcaptchaChallenge.getChallengeHtml()

        } else if (process.env.ANTIBOT === 'TURNSTILE') {
            htmlStr = turnstileChallenge.getChallengeHtml()

        } else {
            htmlStr = '<h1>CONFIGURATION FAILED</h1>'
        }
        
        res.end(htmlStr)
    
    } else if (req.method === 'POST') {

        if (process.env.ANTIBOT === 'INTERNAL') {
            clientContext.allowVisitor = true;
            clientContext.description = 'AUTHENTICATED WITH INTERNAL CHALLENGE'
            cBack(true)
        
        } else if (process.env.ANTIBOT === 'EXTERNAL') {
            hcaptchaChallenge.verifyCaptcha(req, (success) => {
                if (success) {
                    clientContext.allowVisitor = true;
                    clientContext.description = 'AUTHENTICATED WITH CAPTCHA'
                    cBack(true)
               
                } else {
                    cBack(false)
                }

            })
        
        } else if (process.env.ANTIBOT === 'TURNSTILE') { 

            turnstileChallenge.verifyChallenge(req, (success) => {
                if (success) {
                    clientContext.allowVisitor = true;
                    clientContext.description = 'AUTHENTICATED WITH TURNSTILE'
                    cBack(true)
               
                } else {
                    cBack(false)
                }

            })
        
        } else {
            cBack(false)
        }

    } else {
        // res.writeHead(500)
        // res.end('<h1>ACCESS DENIED</h1>')
        cBack(false)
    }


}