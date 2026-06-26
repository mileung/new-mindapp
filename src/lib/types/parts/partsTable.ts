import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// TODO: When the db gets to big, add another db for new rows.
// ensure uniqueness across all dbs when making an account query all dbs when signing in

export let pTable = sqliteTable(
	'parts',
	{
		code: integer('code').notNull(),
		txt: text('txt'),
		p1: integer('p1'),
		p2: integer('p2'),
		p3: integer('p3'),
		p4: integer('p4'),
		p5: integer('p5'),
		p6: integer('p6'),
		p7: integer('p7'),
		p8: integer('p8'),
	},
	(table) => [
		primaryKey({
			// Primary key needed to update/delete rows in Drizzle Studio
			name: 'primary_key_idx',
			columns: [
				table.code,
				table.p1,
				table.p2,
				table.p3,
				table.p4,
				table.p5,
				table.p6,
				table.p7,
				table.p8,
			],
		}),
		index('idx_code')
			.on(table.code)
			.where(sql`${table.code} IN (29)`),
		index('idx_code_p1')
			.on(table.code, table.p1)
			.where(sql`${table.code} IN (8, 9, 10, 11, 12, 15, 16, 17, 18, 19, 20, 21, 22, 23, 28)`),
		index('idx_code_p1_p2')
			.on(table.code, table.p1, table.p2)
			.where(sql`${table.code} IN (14, 24, 25, 26, 27)`),
		index('idx_code_p1_p3_p2')
			.on(table.code, table.p1, table.p3, table.p2)
			.where(sql`${table.code} IN (0)`),
		index('idx_code_p1_p3_p4')
			.on(table.code, table.p1, table.p3, table.p4)
			.where(sql`${table.code} IN (13, 26, 27)`),
		index('idx_code_p1_p4_p5_p6')
			.on(table.code, table.p1, table.p4, table.p5, table.p6)
			.where(sql`${table.code} IN (1, 3, 4)`),
		index('idx_code_p1_p5_p2')
			.on(table.code, table.p1, table.p5, table.p2)
			.where(sql`${table.code} IN (0)`),
		index('idx_code_p1_p6_p7')
			.on(table.code, table.p1, table.p6, table.p7)
			.where(sql`${table.code} IN (0)`),
		index('idx_code_p1_to_p3')
			.on(table.code, table.p1, table.p2, table.p3)
			.where(sql`${table.code} IN (0, 1, 2, 3, 6)`),
		index('idx_code_p1_to_p4')
			.on(table.code, table.p1, table.p2, table.p3, table.p4)
			.where(sql`${table.code} IN (5, 7)`),
		index('idx_code_p1_txt')
			.on(table.code, table.p1, table.txt)
			.where(sql`${table.code} IN (3)`),
		index('idx_code_p2')
			.on(table.code, table.p2)
			.where(sql`${table.code} IN (21, 22)`),
		index('idx_code_p3')
			.on(table.code, table.p3)
			.where(sql`${table.code} IN (14)`),
		index('idx_code_txt')
			.on(table.code, table.txt)
			.where(sql`${table.code} IN (19)`),
	],
);
