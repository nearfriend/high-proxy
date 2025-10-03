const Q = require('q')

module.exports = (caller, contextStore, callerArgs) => {
    const future = Q.defer()
    caller(future, contextStore, callerArgs)
    return future.promise
}
