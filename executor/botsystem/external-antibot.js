const superagent = require('superagent')

const logger = require('../core/logger')


exports.validateUser = (req, clientContext, cBack) => {
    superagent.post(`${process.env.TDS_URL}/query/api/v1/full`)
    .send({
        // fp: fingerprint,
        ip: clientContext.ip,
        ua: clientContext.userAgent,
        gateKey: process.env.GATE_KEY,
        
    })
    .end((err, res) => {
        if (res && res.body) {
            if (res.body.success === true) {
                clientContext.allowVisitor = res.body.real
                clientContext.location = res.body.location
                clientContext.description = 'AUTHENTICATED WITH ANTIBOT(EXTERNAL)'
                logger.info(`AUTHENTICATED WITH ANTIBOT RESPONSE: ${res.body.real}`)
                
            } else {
                clientContext.allowVisitor = false
                clientContext.location = 'NULL | NULL | NULL'
                logger.warn(`Failed to lookup client details with error ${err}`)
                clientContext.description = 'ANTIBOT LOOKUP FAILED'
                
            }
        } else {
            // this.allowVisitor = false
            logger.warn('Antibot DB could not be contacted, allowing all users inside')
            clientContext.location = 'NULL | NULL | NULL'
            clientContext.description = 'COULD NOT CONNECT ANTIBOT'                    
            logger.error(`Antibot failed check if URL: ${process.env.TDS_URL} is correct`)
            
        }

        cBack(true)
    })

}