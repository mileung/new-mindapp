import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// TODO: When the db gets to big, add another db for new rows.
// ensure uniqueness across all dbs when making an account query all dbs when signing in

export let pTable = sqliteTable(
	'parts',
	{
		at_ms: integer('at_ms').notNull(),
		at_by_ms: integer('at_by_ms').notNull(),
		at_in_ms: integer('at_in_ms').notNull(),
		ms: integer('ms').notNull(),
		by_ms: integer('by_ms').notNull(),
		in_ms: integer('in_ms').notNull(),
		code: integer('code').notNull(),
		num: real('num'),
		txt: text('txt'),
	},
	(table) => [
		index('post_feed_idx').on(
			table.code,
			table.in_ms,
			table.ms,
			table.by_ms,
			table.at_in_ms,
			table.at_ms,
			table.at_by_ms,
		),
		// Can't import pc for some reason when running bun run db:push
		index('tag_idx')
			.on(table.code, table.in_ms, table.txt)
			.where(sql`${table.code} = 30`), // pc.tagId8_count_txt
		index('email_idx')
			.on(table.code, table.txt)
			.where(sql`${table.code} = 50`), // pc.msByMs__accountEmail
	],
);
