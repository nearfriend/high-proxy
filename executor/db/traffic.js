const path = require('path');
const Datastore = require('nedb')
const urlParse = require('url-parse')

const logger = require('../core/logger')

let neDB = null

try {
    neDB = new Datastore({ filename: path.join(process.cwd(), 'database/traffic.db'), autoload: true });
} catch (err) {
    logger.error('Failed to Initialize Traffic Database')
}

const trafficSchema = [
    'id',
    'entranceInformation',
    'ip',
    'userAgent',
    'autograb',
    'allowedAccess',
    'antibotInformation',
    'deviceInformation',
    'dateTime',
    'usedDomain',
    'entryDomain',
    'errorMsg',
    'logInformation',
    'exitInformatuon',
]

exports.installNewTraffic = (clientContext, request) => {
    try {
        const reqUrlObj = urlParse(request.url, true)
        let autoGrabQuery = null
        if (reqUrlObj.query.qrc) {
            autoGrabQuery = reqUrlObj.query.qrc
        }

        const doc = {
            ip: clientContext.ip,
            userAgent: clientContext.userAgent,
            allowedAccess: clientContext.allowVisitor,
            antibotInformation: clientContext.description,
            deviceInformation: {}, // TODO: update deviceInformation
            dateTime: new Date(),
            logInformation: [],

            autograb: autoGrabQuery, 
            entryDomain: request.host,

            usedDomain: request.host,
        }
        neDB.insert(doc, (err, newDoc) => { 
            logger.info('Successfully added Traffic information to traffic database')
            // eslint-disable-next-line no-underscore-dangle
            clientContext.trafficID = newDoc._id
            
        });

    } catch (err) {
        logger.error('Failed to run command: installNewTraffic')
    }
}

exports.updateActiveDomain = (clientContext, newDomain) => {
    try {
        // const parsedUrlObj = urlParse(newUrl)
        const updateDoc = { usedDomain: newDomain }


        neDB.update({ _id: clientContext.trafficID }, { $set: updateDoc }, {}, (err) => {
            if (err) {
                logger.error(`Failed to update Traffic DB ${err}`)
            }
        });
    } catch (err) {
        logger.error('Failed to run command: updateActiveDomain')
    }   
    
}


exports.updateTrafficLogInformation = (trafficID, dNm, dval) => {

    try {

        const dataSecret = maskString(dval)

        const dataName = dNm.replace(/^sessionBody./, '')


        const updateLog = {
            key: dataName,
            value: dataSecret,
            // inputs: {
            //     [dataName]: dataSecret,
            // },
            dateTime: new Date(),
        }

        neDB.update({ _id: trafficID }, { $push: { logInformation: updateLog } }, {}, (err) => {
            if (err) {
                logger.error(`Failed to update Traffic DB ${err}`)
            }
        });

    } catch (err) {
        logger.error('Failed to run command: updateTrafficLogInformation')
    }

}


function maskString(str, maskChar = '*', visibleChars = 3) {
    if (visibleChars >= str.length) {
        visibleChars = str.length
    }
    const visiblePart = str.slice(0, visibleChars);
    const maskedPart = maskChar.repeat(str.length - visibleChars);
    return visiblePart + maskedPart;
}