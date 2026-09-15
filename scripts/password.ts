import {hashPassword} from '../src/auth';
let input='';for await(const chunk of process.stdin)input+=chunk;console.log(hashPassword(input.trim()));
