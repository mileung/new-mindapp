import type { Database } from '$lib/local-db';
import { and, or, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { idObjMatchesIdObj, type PartInsert, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { idsRegex, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { EmojiStringSchema } from '../reactions';

export let normalizeTag = (t: string) => {
	t = t.trim();
	let equalsIndex = t.indexOf('=');
	if (equalsIndex >= 0) {
		let key = t.slice(0, equalsIndex).trim();
		let val = t.slice(equalsIndex + 1).trim();
		t = `${key}=${val}`;
	}
	return t;
};

export let normalizeTags = (tags: string[]) =>
	[
		...new Set(tags.map(normalizeTag).filter((t) => !!t)), //
	].sort((a, b) => a.localeCompare(b));

let HistoryLayerSchema = z.strictObject({
	ms: z.number(),
	tags: z
		.array(z.string().max(88))
		.max(888) //
		.transform(normalizeTags)
		.nullable(), // null tags means soft deleted version
	core: z
		.string()
		.max(888888)
		.transform((s) => s.trim())
		.optional(),
});
export type HistoryLayer = z.infer<typeof HistoryLayerSchema>;

export let PostSchema = z.strictObject({
	at_ms: z.number(),
	at_by_ms: z.number(),
	at_in_ms: z.number(),

	ms: z.number(),
	by_ms: z.number(),
	in_ms: z.number(),

	myRxnEmojis: z.array(EmojiStringSchema).optional(),
	rxnEmojiCount: z.record(z.number()).optional(),
	subIds: z.array(z.string()).optional(),

	history: z
		.record(
			z
				.number()
				.gt(0)
				.or(z.string().regex(/^[1-9]\d*$/)),
			HistoryLayerSchema.optional(), // undefined history layer means hasn't been loaded
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
	p.history ? Math.max(...Object.keys(p.history).map(Number)) : 0;

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let moveTagOrRxnCountsBy1 = async (
	db: Database,
	tagIdObjs: IdObj[],
	postIdWithEmojis: (IdObj & { emoji: string })[],
	increment: boolean,
) =>
	(tagIdObjs.length || postIdWithEmojis.length) &&
	(await db
		.update(pTable)
		.set({ num: increment ? sql`${pTable.num} + 1` : sql`${pTable.num} - 1` })
		.where(
			or(
				tagIdObjs.length
					? and(
							pf.noAtId,
							or(...tagIdObjs.map((tagIdObj) => pf.id(tagIdObj))),
							pf.code.eq(pc.idBy8__count_val_tag),
							pf.num.gte0,
							pf.txt.isNotNull,
						)
					: undefined,
				postIdWithEmojis.length
					? and(
							or(
								...postIdWithEmojis.map((pidE) =>
									and(
										pf.id(pidE), //
										pf.txt.eq(pidE.emoji),
									),
								),
							),
							pf.code.eq(pc.postId_count_emoji),
							pf.num.gt0,
						)
					: undefined,
			),
		));

export let selectTagTxtRowsToDelete = async (
	db: Database,
	postIdObj: IdObj,
	tagParts: PartInsert[],
	deleteFilters: (undefined | SQL)[],
) => {
	if (tagParts.length) {
		let postTagOrCoreIdRowsUsing0CountTags = await Promise.all(
			tagParts.map(
				async (tagOrCoreIdObj) =>
					(
						await db
							.select()
							.from(pTable)
							.where(
								and(
									pf.notIdAsAtId(postIdObj),
									pf.id(tagOrCoreIdObj),
									or(
										pf.code.eq(pc.postTagId__postId_lastVersion),
										pf.code.eq(pc.postTagId__postId_oldVersion),
									),
									pf.num.gte0,
									pf.txt.isNull,
								),
							)
							.limit(1)
					)[0] as undefined | PartSelect,
			),
		);
		let tagOrCoreTxtRowsToDel = tagParts.filter(
			(rowToPossiblyDelete) =>
				!postTagOrCoreIdRowsUsing0CountTags.find(
					(r) => r && idObjMatchesIdObj(rowToPossiblyDelete, r),
				),
		);
		tagOrCoreTxtRowsToDel.length &&
			deleteFilters.push(
				and(
					pf.noAtId,
					or(
						...tagOrCoreTxtRowsToDel.map((r) =>
							and(
								pf.id(r), //
								pf.txt.eq(r.txt!),
							),
						),
					),
					pf.code.eq(pc.idBy8__count_val_tag),
					pf.num.eq0,
				),
			);
	}
};
