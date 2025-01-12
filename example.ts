import { ScanningState, TapTapConf } from "./interfaces"
import { TapTapHelper } from "./lib"
function sleep(ms:number){
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function test(){
    var testAppConfig=<TapTapConf>{
        clientId:'your_client_id',
        clientToken:'your_client_token',
    }
    await TapTapHelper.init("your_tap_sdk_version",testAppConfig)
    var res=await TapTapHelper.requestLoginQrCode()
    var qrUrl=res.url
    console.log(qrUrl)
    console.log(res.expiresInSeconds)
    console.log(Date.now() - res.now*1000)
    var lastState:ScanningState
    while (Date.now() - res.now*1000 < res.expiresInSeconds * 1000) {
        
        var loginRes=await TapTapHelper.checkQRCodeResult(res)
        if(TapTapHelper.currentScanningState==ScanningState.Success){
            break;
        }
        await sleep(3000)
    }
    var respp=await TapTapHelper.getProfile(loginRes)
    console.log(respp)
    


}