interface CompleteQRCodeData {

    deviceID: string;
    deviceCode: string;
    expiresInSeconds: number;
    url: string;
    interval: number;
    now: number;
    extra:any;
    
}
interface QRState{
    state: ScanningState;
    success: boolean;
    msg:string;
    tapLoginRes:TapLoginRes;
    extra:any
}
interface TapTapConf{
    clientId: string;
    clientToken: string;
}
interface Profile{
    name: string;
    avatar: string;
    openid: string;
    unionid: string;
}
interface TapLoginRes{
    kid: string,
    access_token: string,
    token_type: string,
    mac_key: string,
    mac_algorithm: string,
    scope: string
}
enum ScanningState{
    Waiting,
    Scanning,
    Canceled,
    Success,
    Expired,
    Other,
}

export {
    CompleteQRCodeData,
    QRState,
    TapTapConf,
    Profile,
    TapLoginRes,
    ScanningState
}