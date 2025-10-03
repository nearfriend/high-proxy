const BaseHandler = require('../base/basehandler');
const BaseRequest = require('../base/baserequest');
const BaseResponse = require('../base/baseresponse');




module.exports = {
    /** @global */
    BasePreClass: BaseHandler,

    /** Base Request class for handling request before it is sent */
    BaseProxyRequestClass: BaseRequest,
    
    /**
     * Class for handling response before it gets sent to the browser
     */
    BaseProxyResponseClass: BaseResponse,

    /**
     * @todo This class is a work in progress for future release
     */
    BrowserClass: null,

}
