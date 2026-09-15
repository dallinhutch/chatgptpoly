import {scryptSync,randomBytes,timingSafeEqual,createHmac} from 'node:crypto';
import {cookies} from 'next/headers';
export function hashPassword(password:string){if(password.length<16)throw Error('Use at least 16 characters');const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex');}
export function verifyPassword(password:string,encoded:string){try{const [salt,hash]=encoded.split(':');const expected=Buffer.from(hash,'hex'),actual=scryptSync(password,salt,64);return expected.length===actual.length&&timingSafeEqual(expected,actual);}catch{return false;}}
function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw Error('SESSION_SECRET needs 32+ characters');return value;}
export function createSession(){const payload=Buffer.from(JSON.stringify({expires:Date.now()+12*3600000,nonce:randomBytes(16).toString('hex')})).toString('base64url');return payload+'.'+createHmac('sha256',secret()).update(payload).digest('base64url');}
export function verifySession(value:string){try{const [payload,signature,...extra]=value.split('.');if(extra.length)return false;const expected=createHmac('sha256',secret()).update(payload).digest(),actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return false;return JSON.parse(Buffer.from(payload,'base64url').toString()).expires>Date.now();}catch{return false;}}
export async function authenticated(){return verifySession((await cookies()).get('polylab_session')?.value??'');}
export function checkOrigin(request:Request){return request.headers.get('origin')===process.env.APP_ORIGIN;}
