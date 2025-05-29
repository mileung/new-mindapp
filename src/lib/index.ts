// place files you want to import through the `$lib` alias in this folder.
import { sqliteTable, text, integer, primaryKey, index } from 'drizzle-orm/sqlite-core';

export const thoughtsTable = sqliteTable(
	'thoughts',
	{
		by_id: text('by_id'),
		ms: integer('ms').notNull(),
		to_id: text('to_id'),
		body: text('body'),
		tags: text('tags', { mode: 'json' }).$type<string[]>(),

		// https://orm.drizzle.team/docs/column-types/sqlite#blob
		// tags: blob('tags', { mode: 'json' }).$type<string[]>().notNull(),
	},
	(table) => [
		// https://orm.drizzle.team/docs/indexes-constraints#composite-primary-key
		primaryKey({
			name: 'id',
			columns: [table.by_id, table.ms],
		}),
		index('by_id_idx').on(table.by_id),
		index('ms_idx').on(table.ms),
		index('to_id_idx').on(table.to_id),
		index('body_idx').on(table.body),
		index('tags_idx').on(table.tags),
	],
);

export type InsertThought = typeof thoughtsTable.$inferInsert;
export type SelectThought = typeof thoughtsTable.$inferSelect;
