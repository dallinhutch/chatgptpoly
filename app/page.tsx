import {redirect} from 'next/navigation';
import {authenticated} from '../src/auth';
import {dashboard} from '../src/dashboard';
import Dashboard from './terminal';
export const dynamic='force-dynamic';
export default async function Page(){if(!await authenticated())redirect('/login');try{return <Dashboard data={await dashboard()}/>;}catch{return <main className="login"><h1>Database unavailable</h1><p>The terminal cannot load its verified records. Check the database connection and run migrations.</p></main>;}}
