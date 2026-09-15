import {authenticated,checkOrigin} from '../../../src/auth';
import {strategySchema} from '../../../src/config';
import {transaction,audit} from '../../../src/db';
export async function POST(req:Request){if(!await authenticated()||!checkOrigin(req))return new Response('Forbidden',{status:403});try{const config=strategySchema.parse(await req.json());const id=await transaction(async q=>{const r=(await q.query('INSERT INTO strategy_versions(config) VALUES($1) RETURNING id',[JSON.stringify(config)])).rows[0];await audit(q,'STRATEGY_CHANGED',{id:r.id,config});return r.id;});return Response.json({id});}catch{return Response.json({error:'Invalid configuration or unavailable database'},{status:400});}}
