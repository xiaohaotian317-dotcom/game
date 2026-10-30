// Intentionally empty by default.
// Add Drizzle tables here when the site actually needs a database.
// See examples/d1/db/schema.ts for an opt-in example.
import {sqliteTable,text,integer} from 'drizzle-orm/sqlite-core';
export const duelRooms=sqliteTable('duel_rooms',{code:text('code').primaryKey(),revision:integer('revision').notNull().default(0),data:text('data').notNull(),expiresAt:integer('expires_at').notNull(),hostToken:text('host_token').notNull(),guestToken:text('guest_token')});
export const duelRelay=sqliteTable('duel_relay',{code:text('code').primaryKey().references(()=>duelRooms.code,{onDelete:'cascade'}),snapshot:text('snapshot'),input:text('input'),offer:text('offer'),answer:text('answer'),hostSeq:integer('host_seq').notNull().default(0),guestSeq:integer('guest_seq').notNull().default(0),hostSeen:integer('host_seen').notNull().default(0),guestSeen:integer('guest_seen').notNull().default(0)});
