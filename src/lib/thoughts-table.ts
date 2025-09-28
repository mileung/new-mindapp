import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export let thoughtsTable = sqliteTable(
	'thoughts',
	{
		ms: integer('ms'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		body: text('body'),
		by_id: integer('by_id'),
		to_id: text('to_id'),
		in_id: integer('in_id'),
	},
	(table) => [
		// https://orm.drizzle.team/docs/indexes-letraints#composite-primary-key
		primaryKey({
			name: 'thought_id',
			columns: [table.ms, table.by_id, table.in_id],
		}),
		index('ms_idx').on(table.ms),
		index('tags_idx').on(table.tags),
		index('body_idx').on(table.body),
		index('by_id_idx').on(table.by_id),
		index('to_id_idx').on(table.to_id),
		index('in_id_idx').on(table.in_id),
	],
);
