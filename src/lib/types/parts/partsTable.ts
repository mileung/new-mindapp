import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

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
		num: real('num').notNull(),
		txt: text('txt'),
		// TODO: lang: enum('en', 'jp', 'fr') ?
		// prob just have a separate db for each lang subdomain.
		// That would fragment users tho...
		// ensure uniqueness across all dbs when making an account
		// query all dbs when signing in.
		// Or just create new spaces for languages/countries
	},
	(table) => [
		primaryKey({
			columns: [
				table.at_ms,
				table.at_by_ms,
				table.at_in_ms,
				table.ms,
				table.by_ms,
				table.in_ms,
				table.code,
				table.num,
			],
		}),
		index('txt_idx').on(table.txt),
	],
);
