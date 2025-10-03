exports.populateConfig = (configExport) => {

    const arrayKeys = [
        'COOKIE_PATH',
        'EXIT_TRIGGER_PATH',
        'EXIT_URL',
        'EXTRA_COMMANDS',
        'PATTERNS',
        'FORCE_PROXY',
        'IMPORTED_MODULES',
        'PRE_HANDLERS',
        'EXTERNAL_FILTERS',
    ]

    const dictKeys = [
        'PHP_PROCESSOR',
        'MODULE_OPTIONS',
    ]

    const strKeys = [
        'DEFAULT_PRE_HANDLER',
        'PROXY_REQUEST',
        'PROXY_RESPONSE',
    ]

    const boolKeys = [
        'MODULE_ENABLED',
    ]

    arrayKeys.forEach((key) => {
        if (!configExport[key]) {
            configExport[key] = []
        } else if (typeof configExport[key] === 'string') {
            configExport[key] = [configExport[key]]
        }
    })

    dictKeys.forEach((key) => {
        if (!configExport[key]) {
            configExport[key] = {}
        } else if (typeof configExport[key] === 'string') {
            configExport[key] = {}
        }
    })

    strKeys.forEach((key) => {
        if (!configExport[key]) {
            configExport[key] = 'DEFAULT'
        }
    })

    boolKeys.forEach((key) => {
        if (!configExport[key]) {
            configExport[key] = false
        }
    })
    
    
}