
const CIPHER_TRIGGER = process.env.CIPHER_TRIGGER || '__'

exports.checkIsCipher = (urlStr) => {
    if (urlStr.startsWith(`/${CIPHER_TRIGGER}/`)) {
        return true;
    }
    return false;
}

exports.makeCipherUrl = (urlStr, clientContext) => {

    // console.log('trying to execute cipher on :\n\n', urlStr)
    if (process.env.DEV_MODE) {
        return urlStr;
    }

    if (!urlStr || urlStr === '' || urlStr === '/' || urlStr.startsWith('/?')) {
        return urlStr;
    }

    if (urlStr.startsWith(`/${CIPHER_TRIGGER}/`)) {
        return urlStr
    }
    // const url = req?.url;

    if (!clientContext.cipherShift) {
        clientContext.cipherShift = 10;
    }
    const cipherKey = clientContext.cipherShift;

    let resultUrl = '';

    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < urlStr.length; i++) {
        const char = urlStr[i];
        if (char.match(/[a-z]/i)) {
          const code = urlStr.charCodeAt(i);
          if ((code >= 65) && (code <= 90)) {
            // Uppercase letters
            resultUrl += String.fromCharCode(((code - 65 + cipherKey) % 26) + 65);
          } else if ((code >= 97) && (code <= 122)) {
            // Lowercase letters
            resultUrl += String.fromCharCode(((code - 97 + cipherKey) % 26) + 97);
          }
        } else {
            resultUrl += char;
        }
      }
    

    const cipherUrl = `/${CIPHER_TRIGGER}/${resultUrl}`;
    // req.url = result;

    return cipherUrl
}

exports.decipherUrl = (cipherUrl, clientContext) => {
    let resultUrl = '';

    if (!cipherUrl.startsWith(`/${CIPHER_TRIGGER}/`)) {
        return cipherUrl
    }

    if (!clientContext.cipherShift) {
        return cipherUrl
    }

    const cipherTriggerLength = CIPHER_TRIGGER.length;
    const urlStr = cipherUrl.slice(1 + cipherTriggerLength)

    // eslint-disable-next-line prefer-destructuring
    const cipherKey = clientContext.cipherShift
  
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < urlStr.length; i++) {
        const char = urlStr[i];
        if (char.match(/[a-z]/i)) {
          const code = urlStr.charCodeAt(i);
          if ((code >= 65) && (code <= 90)) {
            // Uppercase letters
            resultUrl += String.fromCharCode(((code - 65 - cipherKey + 26) % 26) + 65);
          } else if ((code >= 97) && (code <= 122)) {
            // Lowercase letters
            resultUrl += String.fromCharCode(((code - 97 - cipherKey + 26) % 26) + 97);
          }
        } else {
            resultUrl += char;
        }
      }

    if (resultUrl.startsWith('/http')) {
        resultUrl = resultUrl.slice(1);
    }

    if (resultUrl.startsWith('//')) {
        resultUrl = resultUrl.slice(1);
    }

    // if (resultUrl.startsWith(`https://${clientContext.hostname}`)) {
    //     resultUrl = resultUrl.slice(clientContext.hostname.length);
    // }
    // console.log(`Deciphered url: from ${cipherUrl}  TO: \n\n ${resultUrl}`);
  
    return resultUrl;
}