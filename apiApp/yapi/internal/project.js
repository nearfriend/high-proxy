const fs = require('fs')
const path = require('path')
const { validationResult } = require('express-validator');


const util = require('../../lib/utils');


exports.getProjects = (req, res) => {

    const projectList = []

    const projectConfigStr = util.betterReadFile( './highProxy/projects/projects.json')

    const defaultProjects  = JSON.parse(projectConfigStr)

    projectList.push.apply(projectList, defaultProjects)

    const dirList = fs.readdirSync(path.join(process.cwd(), './highProxy/projects/'))
    dirList.forEach(dirEntry => {
        if (util.betterFileExists(path.join('./highProxy/projects', `${dirEntry}/main.js`))) {
            projectList.push(dirEntry)
        }
    })

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: 'Successfully fetched projects',
        info: projectList,
    })
}

exports.changeProject = (req, res) => {
    const vResult = validationResult(req);
    const hasErrors = !vResult.isEmpty();
    if (hasErrors) {
            return res.status(402).json(vResult.errors);
    }

    const projectName = req.body.project

    const projectConfigStr = util.betterReadFile( './highProxy/projects/projects.json')

    const defaultProjects  = JSON.parse(projectConfigStr)

    
    if (defaultProjects.indexOf(projectName) === -1 && 
    (!util.betterFileExists(path.join('./highProxy/projects', `${projectName}/main.js`)))) {
        return res.json({
            status: "Error",
            error: 'Invalid Project',
            code: 1,
            message: "Project Does not exist, please check projectName given...",
        })
    } 

    let userFileObj = JSON.parse(util.betterReadFile( './highProxy/config/user.json'))

    userFileObj.CURRENT_PROJECT = projectName

    util.betterWriteFile('./highProxy/config/user.json', JSON.stringify(userFileObj, '', 4))

    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Successfully changed project to ${projectName}, Please Restart highProxy to effect changes`,
        info: projectName,
    })
     
}

exports.getActiveProject = (req, res) => {
    let userFileObj = JSON.parse(util.betterReadFile('./highProxy/config/user.json'))
    const projectName = userFileObj.CURRENT_PROJECT
    return res.json({
        status: "Success",
        error: null,
        code: 0,
        message: `Current Project name is: ${projectName}`,
        info: projectName,
    })
}


