import {DatabaseSync} from 'node:sqlite';
import {mkdirSync,readFileSync,existsSync,readdirSync} from 'node:fs';
import path from 'node:path';
export function localDatabase(filename=':memory:'){
  if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});
  const sqlite=new DatabaseSync(filename);sqlite.exec('PRAGMA foreign_keys=ON');
  const migrations=new URL('../drizzle/',import.meta.url);if(existsSync(migrations)){sqlite.exec('CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)');for(const f of readdirSync(migrations).filter(f=>f.endsWith('.sql')).sort()){if(sqlite.prepare('SELECT name FROM local_migrations WHERE name = ?').get(f))continue;sqlite.exec(readFileSync(new URL(f,migrations),'utf8'));sqlite.prepare('INSERT INTO local_migrations (name) VALUES (?)').run(f);}}
  const db={prepare(sql){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(sql).get(...values)||null;},runSync(){const r=sqlite.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};},async run(){return this.runSync();}};},async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.runSync());sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close:()=>sqlite.close()};return db;
}
