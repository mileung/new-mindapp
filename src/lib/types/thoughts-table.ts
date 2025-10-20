import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export let thoughtsTable = sqliteTable(
	'thoughts',
	{
		ms: integer('ms'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),
		body: text('body'),
		by_ms: integer('by_ms'),
		to_id: text('to_id'),
		in_ms: integer('in_ms'),
	},
	(table) => [
		// https://orm.drizzle.team/docs/indexes-constraints#composite-primary-key
		primaryKey({
			name: 'thought_id',
			columns: [table.ms, table.by_ms, table.in_ms],
		}),
		index('ms_idx').on(table.ms),
		index('tags_idx').on(table.tags),
		index('body_idx').on(table.body),
		index('by_ms_idx').on(table.by_ms),
		index('to_id_idx').on(table.to_id),
		index('in_ms_idx').on(table.in_ms),
	],
);
