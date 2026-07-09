import type { Database } from '$lib/local-db';
import { and, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { idsRegex, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { EmojiStringSchema } from '../reactions';

export let cleanTags = (tags: string[], sort = false) => {
	let arr = [...new Set(tags.map((t) => t.trim()).filter((t) => !!t))];
	if (sort) arr.sort();
	return arr;
};

let HistoryLayerSchema = z.strictObject({
	ms: z.number(),
	tags: z
		.array(z.string().max(88))
		.max(888) //
		.transform((a) => cleanTags(a)),
	core: z
		.string()
		.max(888888)
		.transform((s) => s.trim()),
});
export type HistoryLayer = z.infer<typeof HistoryLayerSchema>;

export let PostSchema = z.strictObject({
	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),
	at_ms: z.number().optional(),
	at_by_ms: z.number().optional(),

	childCount: z.number().optional(),
	myRxnEmojis: z.array(EmojiStringSchema).optional(),
	rxnEmojiCount: z.record(z.number()).optional(),
	pending: z.boolean().optional(),

	history: z
		.record(
			z
				.number()
				.gt(0)
				.or(z.string().regex(/^[1-9]\d*$/)),
			HistoryLayerSchema.optional(), // undefined history layer means it hasn't been loaded
		)
		.nullable() // null history means soft deleted post
		.transform((history) => {
			if (history === null) return null;
			let keys = Object.keys(history)
				.map((k) => {
					let version = +k;
					if (Number.isNaN(version) || version < 1) throw new Error('version num must be gt0');
					return version;
				})
				.sort((a, b) => a - b);
			for (let i = 1; i < keys.length; i++) {
				if (keys[i] - keys[i - 1] !== 1)
					throw new Error(
						`History keys must be consecutive numbers; found gap between ${keys[i - 1]} and ${keys[i]}`,
					);
			}
			let sortedHistory: Record<string, undefined | HistoryLayer> = {};
			for (let i = 0; i < keys.length; i++) {
				let keyStr = keys[i].toString();
				if (!history[keyStr]) throw new Error(`Version ${keyStr} has not been loaded`);
				sortedHistory[keyStr] = history[keyStr];
			}
			return sortedHistory;
		})
		.refine((history) => history === null || Object.keys(history).length > 0, {
			message: 'History must either be null or have at least one key',
		}),
});

export type Post = z.infer<typeof PostSchema>;

export let getLastVersion = (p: Post) =>
	p.history ? Math.max(...Object.keys(p.history).map(Number)) : null;

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let moveTagOrRxnCountsBy1 = async (
	db: Database,
	_tag_imBy8_countRows: PartInsert[],
	postIdWithEmojis: (IdObj & { emoji: string })[],
	increment: boolean,
) =>
	(_tag_imBy8_countRows.length || postIdWithEmojis.length) &&
	(await db
		.update(pTable)
		.set({ p4: increment ? sql`${pTable.p4} + 1` : sql`${pTable.p4} - 1` })
		.where(
			or(
				_tag_imBy8_countRows.length
					? and(
							pf.code.eq(pc._tag_imBy8_count),
							or(
								..._tag_imBy8_countRows.map((r) =>
									and(
										pf.p1.eq(r.p1!), //
										pf.p2.eq(r.p2!),
										pf.p3.eq(r.p3!),
									),
								),
							),
						)
					: undefined,
				postIdWithEmojis.length
					? and(
							pf.code.eq(pc._emoji_postImb_count),
							or(
								...postIdWithEmojis.map((oe) =>
									and(pf.txt.eq(oe.emoji), pf.p1.eq(oe.in_ms), pf.p2.eq(oe.ms), pf.p3.eq(oe.by_ms)),
								),
							),
						)
					: undefined,
			),
		));
