import {createHash} from 'node:crypto';
import {db,canonicalJson} from '../src/db';
let previous='GENESIS',cursor='0',count=0;
for(;;){const rows=(await db().query('SELECT * FROM audit_events WHERE id>$1 ORDER BY id LIMIT 1000',[cursor])).rows;if(!rows.length)break;for(const r of rows){const expected=createHash('sha256').update(previous+'\n'+r.kind+'\n'+canonicalJson(r.payload)).digest('hex');if(r.previous_hash!==previous||r.hash!==expected)throw Error(`Audit chain invalid at ${r.id}`);previous=r.hash;cursor=r.id;count++;}}
console.log(JSON.stringify({events:count,head:previous,valid:true}));process.exit(0);
