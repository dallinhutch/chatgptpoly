import {NextResponse} from 'next/server';
import {checkOrigin} from '../../../src/auth';
export async function POST(req:Request){if(!checkOrigin(req))return new Response('Forbidden',{status:403});const r=NextResponse.redirect(new URL('/login',process.env.APP_ORIGIN),303);r.cookies.delete('polylab_session');return r;}
