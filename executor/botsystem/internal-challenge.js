const crypto = require('crypto');

const { parse } = require('querystring');
const superagent = require('superagent');

const logger = require('../core/logger')

const justInTime = {
    store: {},
    generateNewPair() {
      const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
      });
      const uniqueID = crypto.randomBytes(128).toString('hex'); 
      this.store[uniqueID] = { publicKey, privateKey };
      return uniqueID;
    },
    getPublicKey(uniqueID) {
      return this.store[uniqueID].publicKey || null;
    },
    getPrivateKeyAndDelete(uniqueID) {
        
      const privateKey = this.store[uniqueID].privateKey || null;
      delete this.store[uniqueID];
      return privateKey;
    },
  };

exports.getChallengeHtml = () => {
   
    const CAPTCHA_TEXT_HTML = 'Hello{}'

    return CAPTCHA_TEXT_HTML
}


exports.verifyChallenge = (req, cBack) => {

    let body = '';

    req.on('data', (chunk) => {
        body += chunk.toString();
    });

    req.on('end', () => {
        const postData = parse(body);
        const captchaResponse = postData['h-captcha-response'];
        
        if (!captchaResponse) {
            // res.end('No captcha response received');
            return cBack(false)
        }

        return superagent
            .post('https://hcaptcha.com/siteverify')
            .type('form')
            .send({
                // secret: SECRET_KEY,
                response: captchaResponse,
            })
            .end((err, response) => {
                if (err) {
                    logger.warn('Failed to verify captcha');
                    return cBack(false)
                }

                if (response.body.success) {
                    logger.debug('Captcha verified successfully');
                    return cBack(true)
                } 

                logger.warn('Failed to verify captcha');
                return cBack(false)
                
            });
    })
}