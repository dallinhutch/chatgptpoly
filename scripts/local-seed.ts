import {db,transaction,migrate} from '../src/db';
import {scan,snapshot} from '../src/engine';
await transaction(migrate);const candidates=await scan(db(),30);await transaction(snapshot);console.log(JSON.stringify({stored:candidates.length,eligible:candidates.filter(c=>c.eligible).length}));process.exit(0);
