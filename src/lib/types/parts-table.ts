import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export let partsTable = sqliteTable(
	'parts',
	{
		to_ms: integer('to_ms'),
		to_by_ms: integer('to_by_ms'),
		to_in_ms: integer('to_in_ms'),
		ms: integer('ms'),
		by_ms: integer('by_ms'),
		in_ms: integer('in_ms'),
		code: integer('code'),
		txt: text('txt'),
		num: real('num'),
	},
	(table) => [
		index('to_ms_idx').on(table.to_ms),
		index('to_by_ms_idx').on(table.to_by_ms),
		index('to_in_ms_idx').on(table.to_in_ms),
		index('ms_idx').on(table.ms),
		index('by_ms_idx').on(table.by_ms),
		index('in_ms_idx').on(table.in_ms),
		index('code_idx').on(table.code),
		index('txt_idx').on(table.txt),
		index('num_idx').on(table.num),
	],
);
