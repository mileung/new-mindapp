import type { Database } from '$lib/local-db';
import { and, or, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';
import { type PartInsert, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { idsRegex, zeros, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { reactionList } from './reactionList';
export { reactionList };

export let normalizeTags = (tags: string[]) =>
	[
		...new Set(tags.map((tag) => tag.trim()).filter((t) => !!t)), //
	].sort((a, b) => a.localeCompare(b));

let HistoryLayerSchema = z.object({
	ms: z.number(),
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
		at_ms: z.number(),
		at_by_ms: z.number(),
		at_in_ms: z.number(),

		ms: z.number(),
		by_ms: z.number(),
		in_ms: z.number(),

		reactionCount: z.record(z.number()).optional(),
		subIds: z.array(z.string()).optional(),

		history: z
			.record(
				z.number().or(z.string().regex(/^\d+$/)),
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
	p.history && Math.max(...Object.keys(p.history).map((k) => +k));

export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

export let scrollToHighlight = (id: string) => {
	let e =
		document.querySelector('#m' + id) || //
		document.querySelector('.m' + id);
	e?.scrollIntoView({ block: 'start' });
};

export let addNewTagOrCoreRows = (
	mainPart: IdObj,
	tagOrCoresFromAllLayers: string[],
	existingTagOrCoreTxtRows: PartSelect[],
	isTag: boolean,
	partsToInsert: PartInsert[],
) => {
	let tagOrCoreTxtToRowMap: Record<string, PartInsert> = {};
	for (let i = 0; i < existingTagOrCoreTxtRows.length; i++) {
		let tagOrCoreRow = existingTagOrCoreTxtRows[i];
		tagOrCoreTxtToRowMap[tagOrCoreRow.txt!] = tagOrCoreRow;
	}
	let newRowsCount = 0;
	let code = isTag ? pc.tagIdAndTxtWithNumAsCount : pc.coreIdAndTxtWithNumAsCount;
	for (let i = 0; i < tagOrCoresFromAllLayers.length; i++) {
		let tagOrCore = tagOrCoresFromAllLayers[i];
		let tagOrCoreRow = tagOrCoreTxtToRowMap[tagOrCore];
		if (!tagOrCoreRow) {
			tagOrCoreRow = {
				...zeros,
				ms: mainPart.ms + newRowsCount++,
				by_ms: mainPart.by_ms,
				in_ms: mainPart.in_ms,
				code,
				txt: tagOrCore,
				num: 1,
			};
			tagOrCoreTxtToRowMap[tagOrCore] = tagOrCoreRow;
			partsToInsert.push(tagOrCoreRow);
		}
	}
	return tagOrCoreTxtToRowMap;
};

export let moveTagOrCoreCountsBy1 = async (
	db: Database,
	tagRows: PartInsert[],
	coreRows: PartInsert[],
	increment = true,
) =>
	(tagRows.length || coreRows.length) &&
	(await db
		.update(pTable)
		.set({ num: increment ? sql`${pTable.num} + 1` : sql`${pTable.num} - 1` })
		.where(
			or(
				tagRows.length
					? and(
							pt.at_ms.eq0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							or(...tagRows.map((tagRow) => pt.id(tagRow))),
							pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
							pt.txt.isNotNull,
							pt.num.isNotNull,
						)
					: undefined,
				coreRows.length
					? and(
							pt.at_ms.eq0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							or(...coreRows.map((coreRow) => pt.id(coreRow))),
							pt.code.eq(pc.coreIdAndTxtWithNumAsCount),
							pt.txt.isNotNull,
							pt.num.isNotNull,
						)
					: undefined,
			),
		));

export let selectTagOrCoreTxtRowsToDelete = async (
	db: Database,
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
									pt.at_ms.gt0,
									pt.at_by_ms.eq0,
									pt.at_in_ms.eq0,
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
									pt.txt.isNull,
									pt.num.isNotNull,
								),
							)
							.limit(1)
					)[0] as undefined | PartSelect,
			),
		);
		let tagOrCoreTxtRowsToDel = tagOrCoreIdObjs.filter(
			(rowToPossiblyDelete) =>
				!postTagOrCoreIdRowsUsing0CountTags.find(
					(r) =>
						rowToPossiblyDelete.ms === r?.ms && //
						rowToPossiblyDelete.by_ms === r?.by_ms &&
						rowToPossiblyDelete.in_ms === r?.in_ms,
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
					pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
					pt.num.eq0,
				),
			);
	}
};
