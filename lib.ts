import fetch from 'node-fetch';
import crypto from 'crypto';
import {CompleteQRCodeData,TapTapConf,Profile,TapLoginRes,ScanningState} from "./interfaces"
class TapTapHelper {
    private static TapSDKVersion: string;
    private static WebHost: string = 'https://accounts.tapapis.com';
    private static ChinaWebHost: string = 'https://accounts.tapapis.cn';
    private static ApiHost: string = 'https://open.tapapis.com';
    private static ChinaApiHost: string = 'https://open.tapapis.cn';
    private static CodeUrl: string;
    private  static ChinaCodeUrl: string;
    private  static TokenUrl: string;
    private  static ChinaTokenUrl: string;
    private static GameConf:TapTapConf;
    public static currentScanningState: ScanningState;

    private static async makeResJSON(res:any){
        let rt=await res.text();
        //console.log(rt);
        return JSON.parse(rt);
    }

    public  static async init(SDKVer:string,AppConf:TapTapConf){
        TapTapHelper.TapSDKVersion = '2.1';
        TapTapHelper.CodeUrl = `${TapTapHelper.WebHost}/oauth2/v1/device/code`;
        TapTapHelper.ChinaCodeUrl = `${TapTapHelper.ChinaWebHost}/oauth2/v1/device/code`;
        TapTapHelper.TokenUrl = `${TapTapHelper.WebHost}/oauth2/v1/token`;
        TapTapHelper.ChinaTokenUrl = `${TapTapHelper.ChinaWebHost}/oauth2/v1/token`;
        TapTapHelper.GameConf = AppConf
    }

    private  static GetChinaProfileUrl(havePublicProfile: boolean = true): string {
        return havePublicProfile ? TapTapHelper.ChinaApiHost + "/account/profile/v1?client_id=" : TapTapHelper.ChinaApiHost + "/account/basic-info/v1?client_id=";
    }

    public static async requestLoginQrCode(permissions: string[] = ['public_profile'], useChinaEndpoint: boolean = true) {
        const clientId = crypto.randomUUID().replace(/\-/g, '');

        const params = new FormData();
        params.append('client_id', TapTapHelper.GameConf.clientId);
        params.append("response_type", "device_code");
        params.append("scope", permissions.join(','));
        params.append("version", TapTapHelper.TapSDKVersion);
        params.append("platform", "unity");
        params.append("info", JSON.stringify({ device_id: clientId }));

        const endpoint = useChinaEndpoint ? TapTapHelper.ChinaCodeUrl : TapTapHelper.CodeUrl;
        const response = await fetch(endpoint, {
            method: 'POST',
            body: params
        });
        const datacode = await TapTapHelper.makeResJSON(response);
        var res=<CompleteQRCodeData>{
            deviceID: clientId,
            deviceCode: datacode.data.device_code,
            expiresInSeconds: datacode.data.expires_in,
            url: datacode.data.qrcode_url,
            interval: datacode.data.interval,
            now: datacode.now,
            extra:{
                data:datacode
            }

        }
        return res;
    }

    public static async checkQRCodeResult(data: CompleteQRCodeData, useChinaEndpoint: boolean = true) {
        const qrCodeData = data;
        const params = new FormData();
        params.append('grant_type', 'device_token');
        params.append('client_id', TapTapHelper.GameConf.clientId);
        params.append("secret_type", "hmac-sha-1");
        params.append("code", qrCodeData.deviceCode);
        params.append("version", "1.0");
        params.append("platform", "unity");
        params.append("info", JSON.stringify({ device_id: qrCodeData.deviceID }));

        const endpoint = useChinaEndpoint ? TapTapHelper.ChinaTokenUrl : TapTapHelper.TokenUrl;
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                body: params
            });
            const data = await TapTapHelper.makeResJSON(response);
            var msg=data.data.error;
            var state : ScanningState
            switch(String(msg)){
                case "authorization_pending":
                    if(Date.now() - qrCodeData.now*1000 < qrCodeData.expiresInSeconds * 1000){

                        state= ScanningState.Waiting
                        break

                    }
                    state = ScanningState.Expired
                    break
                case "authorization_waiting":
                    state= ScanningState.Scanning
                    break
                case "undefined":
                    state= ScanningState.Success
                    break
                case "access_denied":
                    state= ScanningState.Canceled
                    break
                default:
                    console.log("error:"+msg)
                    state=ScanningState.Other
                    break

            }
            if (TapTapHelper.currentScanningState != state) {
                TapTapHelper.currentScanningState = state;
            }
            let res:TapLoginRes=data.success?data.data:{

            }
            return res;
        } catch (error) {
            console.error('Error checking QR code result:', error);
            return null;
        }
    }

    public static async getProfile(token: TapLoginRes, useChinaEndpoint: boolean = true, timestamp: number = 0) {
        if (!token.scope.includes('public_profile')) {
            throw new Error('Public profile permission is required.');
        }

        let url;
        if (useChinaEndpoint) {
            url = `${TapTapHelper.ChinaApiHost}/account/profile/v1?client_id=${TapTapHelper.GameConf.clientId}`;
        } else {
            url = `${TapTapHelper.ApiHost}/account/profile/v1?client_id=${TapTapHelper.GameConf.clientId}`;
        }

        const method = 'GET';
        const authorizationHeader = await getAuthorization(url, method, token.kid, token.mac_key);

        const response = await fetch(url, {
            method: 'GET',
            headers: { Authorization: authorizationHeader },
        });

        let resp= await TapTapHelper.makeResJSON(response);
        let res=<Profile>{
            name:resp.data.name,
            avatar:resp.data.avatar,
            openid:resp.data.openid,
            unionid:resp.data.unionid,
        }
        return res;
    }
}

function getAuthorization(requestUrl: string, method: string, keyId: string, macKey: string): string {
    const url = new URL(requestUrl);
    const time = (Math.floor(Date.now() / 1000).toString()).padStart(10, '0');
    const randomStr = getRandomString(16);
    const host = url.hostname;
    const uri = url.pathname + url.search;
    const port = url.port || (url.protocol === 'https:' ? '443' : '80');
    const other = '';
    const sign = signData(mergeData(time, randomStr, method, uri, host, port, other), macKey);

    return `MAC id="${keyId}", ts="${time}", nonce="${randomStr}", mac="${sign}"`;
}

function getRandomString(length: number): string {
    return crypto.randomBytes(length).toString('base64');
}

function mergeData(time: string, randomCode: string, httpType: string, uri: string, domain: string, port: string, other: string): string {
    let prefix =
        `${time}\n${randomCode}\n${httpType}\n${uri}\n${domain}\n${port}\n`;

    if (!other) {
        prefix += '\n';
    } else {
        prefix += `${other}\n`;
    }

    return prefix;
}

function signData(signatureBaseString: string, key: string): string {
    const hmac = crypto.createHmac('sha1', key);
    hmac.update(signatureBaseString);
    return hmac.digest('base64');
}


export {TapTapHelper} 