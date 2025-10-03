const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// const { LexActivator, LexStatusCodes, PermissionFlags } = require('@cryptlex/lexactivator')
// const productObj = require('./product.json')
const nSerial = require('../commodity/nserial');


async function activate(licenseKey, xSupport) {
    // LexActivator.SetProductData(productObj.dat);

    // LexActivator.SetProductId(productObj.id, PermissionFlags.LA_USER)
    

    // const uuidSig = crypto.randomUUID();

    try {
        const status = await nSerial.nActivateLicense(licenseKey, xSupport);
        if (nSerial.NCODES.N_OK === status) {
                console.log('License already activated, Please continue using!');
                // fs.writeFileSync(path.join(process.cwd(), '.activation'), uuidSig)
                process.exit(0)
        } else if (nSerial.NCODES.N_ACTIVATED === status) {
                console.log('License Activated Successfully!');
                // fs.writeFileSync(path.join(process.cwd(), '.activation'), uuidSig)
                process.exit(0)
        } else if (nSerial.NCODES.N_EXPIRED === status) {
                console.log('License activated successfully but has expired!');
        } else if (nSerial.NCODES.N_INVALID === status) {
                console.log('License is not Valid!');
        } else if (nSerial.NCODES.N_MAX_MACHINES === status) {
                console.log('License activation limit reached!'); 
        } else if (nSerial.NCODES.N_SUSPENDED === status) {
                console.log('License activated successfully, but has been suspended!'); 
        } else {
                console.log('License Error, Please Try Again!');
        }
    } catch (error) {
        console.log('License activated failed:', error.code, error.message);
    }
    process.exit(1);
}



exports.activate = activate;

exports.getSerial = () => {
        return nSerial;
}