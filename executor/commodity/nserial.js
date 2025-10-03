const fs = require('fs');
const path = require('path');
const os = require('os')

const crypto = require('crypto');
const ip = require('ip')

const superagent = require("superagent");
// require('superagent-proxy')(superagent);
const { machineId } = require('node-machine-id');

const homedir = os.homedir();
const hostname = os.hostname()

const SOCK_PROXY = 'socks5h://127.0.0.1:9050'

// Your keygen  API
const TOR_EXIT_URL = 'https://api.keygen.sh/'

const KEY_CIPHER = crypto.scryptSync('703I28Z2OG5UT85M1DJLK11110LX7W1M+V4W0AQC68W1K15LI13JJ8H2ITWLWDCV9', 'highProxy', 24)
const KEY_ALGO = 'aes-192-cbc'

const TOKEN_PATH = path.join(homedir, '.highProxy_token')

const NCODES = {
    N_OK: 0,
    N_VALID: 1,
    N_EXPIRED: 2,
    N_SUSPENDED: 3,
    N_INVALID: 4,
    N_MAX_MACHINES: 5,
    N_ERROR: 6,
    N_ACTIVATED: 7,
    N_NOT_FOUND: 8,
};
exports.NCODES = NCODES;


const encryptToken = (licenseKey) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(KEY_ALGO, KEY_CIPHER, iv);
  const encrypted = cipher.update(licenseKey, "utf8", "hex");

  return [
    encrypted + cipher.final("hex"),
    Buffer.from(iv).toString("hex"),
  ].join("|");
}

const decryptToken = (hexBuffer) => {
  const [encrypted, iv] = hexBuffer.toString().split("|");
  if (!iv) throw new Error("IV not found");
  const decipher = crypto.createDecipheriv(
    KEY_ALGO, KEY_CIPHER,
    Buffer.from(iv, "hex")
  );
  return decipher.update(encrypted, "hex", "utf8") + decipher.final("utf8");
}

const LICENSE_DATA = {
  isActivated: false,
  fullAuth: false,
  lastChecked: '',
  policy: {
    id: ''
  }
}


exports.nActivateLicense = async function(licenseKey, xSupport) {

    const fingerprint = await machineId();

    const isValidResp  = await superagent
    .post(`${TOR_EXIT_URL}/proxy/validate`)
    .set('Accept', 'application/vnd.api+json')
    .timeout({
      response: 30000,  deadline: 50000,
    })
    .send({
      meta: {
        scope: { fingerprint },
        key: licenseKey,
      }
    })
    // .disableTLSCerts()
    // .proxy(SOCK_PROXY);

    const { meta, errors } = isValidResp.body;

    if (errors) {
        console.log('Failed to Activate License: Error: ' + errors);
        throw new Error(errors)
      }
    
      // If the license is valid, that means the current machine is already
      // activated. We can safely return.
      if (meta.valid) {    
        fs.writeFileSync(TOKEN_PATH, encryptToken(licenseKey))

        return NCODES.N_OK
      }
    
      // If we've gotten this far, our license is not valid for the current
      // machine and we should attempt to activate it.
    switch (meta.code) {
        // This means the license already has at least 1 machine associated with
        // it, but none match the current machine's fingerprint. We're breaking
        // on this case because, for this example, we want to support activating
        // more than 1 machine.
        case 'FINGERPRINT_SCOPE_MISMATCH':
        // You will receive a NO_MACHINES status when the license IS floating,
        // and it does not currently have any associated machines.
        case 'NO_MACHINES':
        // You will receive a NO_MACHINE status when the license IS NOT floating
        // i.e. it's node-locked, and it does not currently have any
        // associated machines.
        case 'NO_MACHINE': {
          break
        }
        case 'SUSPENDED': {
          return NCODES.N_SUSPENDED
        }

        case 'EXPIRED': {
          return NCODES.N_EXPIRED
        }
        case 'NOT_FOUND': {
          return NCODES.N_INVALID
        }
        case 'TOO_MANY_MACHINES': {
          return NCODES.N_MAX_MACHINES
        }
        default: {
            throw new Error('Couldnt not understand License State, Please Contact Support')
            // throw new Error(`license ${meta.detail} (${meta.code})`)
        }
    }

    const ipAddr = ip.address() || '0.0.0.0'

    const licenseID = isValidResp.body.data.id

    const machineResp  = await superagent
    .post(`${TOR_EXIT_URL}/proxy/activate`)
    .timeout({
      response: 30000,  deadline: 50000,
    })
    .set('Authorization', `License ${licenseKey}`)
    .set('Accept', 'application/vnd.api+json')
    .set('Support-Token', xSupport)
    .set('Content-Type', 'application/vnd.api+json')
    .send({
        data: {
            type: 'machines',
            attributes: {
              fingerprint,
              hostname,
              ip: ipAddr,
              platform: 'linux'
            },
            relationships: {
              license: {
                data: { type: 'licenses', id: licenseID }
              }
            }
          }
    })
    // .disableTLSCerts()
    // .proxy(SOCK_PROXY);

    const { data: machine, errors: errs } = machineResp.body
    if (errs) {
      throw new Error('Failed to Add Machine')
    }

    fs.writeFileSync(path.join(homedir, '.highProxy_token'), encryptToken(licenseKey))
    return NCODES.N_ACTIVATED    
      
}


exports.IsLicenseGenuine = async function () {

    //TODO: You need to remove the next line after setting your API SERVER.
    return NCODES.N_OK

    if (!fs.existsSync(TOKEN_PATH)) {
        return NCODES.N_NOT_FOUND;

    }

    const licenseBuffer =  fs.readFileSync(TOKEN_PATH)
    let licenseKey

    try {
      licenseKey = decryptToken(licenseBuffer)
    } catch (e) {
      fs.unlinkSync(TOKEN_PATH)
      return NCODES.N_ERROR;
    }


    const fingerprint = await machineId();

    const isValidResp  = await superagent
    .post(`${TOR_EXIT_URL}/proxy/validate`)
    .timeout({
      response: 30000,  deadline: 50000,
    })
    .set('Accept', 'application/vnd.api+json')
    .send({
      meta: {
        scope: { fingerprint },
        key: licenseKey,
      }
    })
    // .disableTLSCerts()
    // .proxy(SOCK_PROXY);

    const { meta, data,  errors } = isValidResp.body;

    if (errors) {
        console.log('Failed to Activate License: Error: ' + errors);
        throw new Error(errors)
      }
    
      // If the license is valid, that means the current machine is already
      // activated. We can safely return.
      if (meta.valid) { 
        LICENSE_DATA.isActivated = true
        LICENSE_DATA.policy.id = data.relationships.policy.data.id   

        return NCODES.N_OK
      } else if (meta.code === 'EXPIRED') {
        return NCODES.N_EXPIRED
      }  else if (meta.code === 'SUSPENDED') {
        return NCODES.N_SUSPENDED
      }  else {
        return NCODES.N_ERROR
      }


}


exports.getLicenseData = () => {
  return LICENSE_DATA;
}