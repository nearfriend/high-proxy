const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const logger = require('../core/logger')



exports.verifyWithPrivateKey = (req, clientContext) => {
  const PRIVATE_KEY_FILE = path.join(process.cwd(), 'config/redirect-key.pem')
    if (!fs.existsSync(PRIVATE_KEY_FILE)) {
      logger.warn('Could not find private key for the redirect, Try setting Redirect Again?')
        return false
    }

    const privateKey = fs.readFileSync(PRIVATE_KEY_FILE, 'utf8');

    try {
      const encryptedData =  req.headers['qrc-auth'] || req.headers['authorization'];

      const decryptedBuffer = crypto.privateDecrypt(
        {
          key: privateKey,
          padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        },
        Buffer.from(encryptedData, 'base64'),
      );
  
      const decryptedString = decryptedBuffer.toString('utf8');
      logger.info(`Decrypted the userData token to: ${decryptedString}`);

      clientContext.allowVisitor = true;

      // data addon
      const decryptedData = JSON.parse(decryptedString)
      clientContext.ip = decryptedData.ip;
      clientContext.userAgent = decryptedData.userAgent

      return true

    } catch (decryptionError) {

      logger.error('Private key Decryption failed, Likely a BOT? or outdated?');
      return false

    }

}