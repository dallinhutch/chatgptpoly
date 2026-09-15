import {readFile} from 'node:fs/promises';
import {transaction,closeDatabase} from '../src/db';
const tables=['markets','market_price_history','research_runs','research_sources','analyst_predictions','research_budget_reservations','system_jobs','audit_events','portfolio_snapshots'];
const data=JSON.parse(await readFile(process.argv[2],'utf8'));
await transaction(async q=>{if((await q.query('SELECT id FROM research_runs LIMIT 1')).rows.length||(await q.query('SELECT id FROM simulated_orders LIMIT 1')).rows.length)throw Error('Import requires a new experiment database');
for(const table of tables){for(const row of data[table]??[]){const keys=Object.keys(row);if(keys.some(k=>!/^[a-z_]+$/.test(k)))throw Error('Invalid column');await q.query(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,keys.map(k=>row[k]));}if(table!=='markets')await q.query(`SELECT setval(pg_get_serial_sequence('${table}','id'),COALESCE((SELECT MAX(id) FROM ${table}),1),EXISTS(SELECT 1 FROM ${table}))`);}});
await closeDatabase();console.log('Original experiment observations and research imported.');
