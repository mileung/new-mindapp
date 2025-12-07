import type { Database } from '$lib/local-db';
import { and, or, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { idObjMatchesIdObj, type PartInsert, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { idsRegex, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import type { Reaction } from '../reactions';
import { reactionList } from '../reactions/reactionList';

export let normalizeTags = (tags: string[]) =>
	[
		...new Set(tags.map((tag) => tag.trim()).filter((t) => !!t)), //
	].sort((a, b) => a.localeCompare(b));

let HistoryLayerSchema = z.object({
	ms: z.number().gte(0),
	tags: z
		.array(z.string().max(888))
		.max(888) //
		.transform(normalizeTags)
		.nullable(), // null tags means soft deleted version
	core: z
		.string()
		.transform((s) => s.trim())
		.pipe(z.string().max(888888))
		.optional(),
});
export type HistoryLayer = z.infer<typeof HistoryLayerSchema>;

export let PostSchema = z
	.object({
		at_ms: z.number().gte(0),
		at_by_ms: z.number().gte(0),
		at_in_ms: z.number().gte(0),

		ms: z.number().gte(0),
		by_ms: z.number().gte(0),
		in_ms: z.number().gte(0),

		myRxns: z.array(z.enum(reactionList)).optional(),
		rxnCount: z.record(z.number()).optional(),
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
					.map((k) => +k)
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
	})
	.strict();

export type Post = z.infer<typeof PostSchema>;

export let getLastVersion = (p: Post) =>
	p.history ? Math.max(...Object.keys(p.history).map((k) => +k)) : 0;

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let moveTagCoreOrRxnCountsBy1 = async (
	db: Database,
	tagIdObjs: IdObj[],
	coreIdObjs: IdObj[],
	rxns: Reaction[],
	increment: boolean,
) =>
	(tagIdObjs.length || coreIdObjs.length || rxns.length) &&
	(await db
		.update(pTable)
		.set({ num: increment ? sql`${pTable.num} + 1` : sql`${pTable.num} - 1` })
		.where(
			or(
				tagIdObjs.length
					? and(
							pt.at_ms.eq0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							or(...tagIdObjs.map((tagIdObj) => pt.id(tagIdObj))),
							pt.code.eq(pc.tagId8AndTxtWithNumAsCount),
							pt.num.gte0,
							pt.txt.isNotNull,
						)
					: undefined,
				coreIdObjs.length
					? and(
							pt.at_ms.eq0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							or(...coreIdObjs.map((coreIdObj) => pt.id(coreIdObj))),
							pt.code.eq(pc.coreId8AndTxtWithNumAsCount),
							pt.num.gte0,
							pt.txt.isNotNull,
						)
					: undefined,
				rxns.length
					? and(
							or(
								...rxns.map((rxn) =>
									and(
										pt.atId(rxn), //
										pt.txt.eq(rxn.emoji),
										pt.in_ms.eq(rxn.in_ms),
									),
								),
							),
							pt.ms.gt0,
							pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
							pt.num.gte0,
						)
					: undefined,
			),
		));

export let selectTagOrCoreTxtRowsToDelete = async (
	db: Database,
	postIdObj: IdObj,
	tagOrCoreIdObjs: PartInsert[],
	deleteFilters: (undefined | SQL)[],
	isTag: boolean,
) => {
	if (tagOrCoreIdObjs.length) {
		let postTagOrCoreIdRowsUsing0CountTags = await Promise.all(
			tagOrCoreIdObjs.map(
				async (tagOrCoreIdObj) =>
					(
						await db
							.select()
							.from(pTable)
							.where(
								and(
									pt.notIdAsAtId(postIdObj),
									pt.id(tagOrCoreIdObj),
									isTag
										? or(
												pt.code.eq(pc.currentPostTagIdWithNumAsVersionAtPostId),
												pt.code.eq(pc.exPostTagIdWithNumAsVersionAtPostId),
											)
										: or(
												pt.code.eq(pc.currentPostCoreIdWithNumAsVersionAtPostId),
												pt.code.eq(pc.exPostCoreIdWithNumAsVersionAtPostId),
											),
									pt.num.gte0,
									pt.txt.isNull,
								),
							)
							.limit(1)
					)[0] as undefined | PartSelect,
			),
		);
		let tagOrCoreTxtRowsToDel = tagOrCoreIdObjs.filter(
			(rowToPossiblyDelete) =>
				!postTagOrCoreIdRowsUsing0CountTags.find(
					(r) => r && idObjMatchesIdObj(rowToPossiblyDelete, r),
				),
		);
		tagOrCoreTxtRowsToDel.length &&
			deleteFilters.push(
				and(
					pt.at_ms.eq0,
					pt.at_by_ms.eq0,
					pt.at_in_ms.eq0,
					or(
						...tagOrCoreTxtRowsToDel.map((r) =>
							and(
								pt.id(r), //
								pt.txt.eq(r.txt!),
							),
						),
					),
					pt.code.eq(
						isTag
							? pc.tagId8AndTxtWithNumAsCount //
							: pc.coreId8AndTxtWithNumAsCount,
					),
					pt.num.eq0,
				),
			);
	}
};
