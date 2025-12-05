import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { z } from 'zod';
import { type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	atIdObjMatchesIdObj,
	channelPartsByCode,
	getBaseInput,
	hasParent,
	makePartsUniqueById,
	reduceTxtRowsToMap,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import {
	FullIdObjSchema,
	getAtIdObjAsIdObj,
	getAtIdStr,
	getFullIdObj,
	getIdObj,
	getIdStr,
	IdObjSchema,
	zeros,
	type FullIdObj,
	type IdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import type { RxnEmoji } from '../reactions';

export let postsPerLoad = 15;
export let bracketRegex = /\[([^\[\]]+)]/g;

export let GetPostFeedSchema = z.object({
	useRpc: z.boolean(),
	callerMs: z.number(),
	view: z.enum(['nested', 'flat']),
	sortedBy: z.enum(['bumped', 'new', 'old']),
	fromMs: z.number(),
	postAtBumpedPostsIdObjsExclude: z.array(FullIdObjSchema).optional(),

	byMssExclude: z.array(z.number()),
	byMssInclude: z.array(z.number()),
	inMssExclude: z.array(z.number()),
	inMssInclude: z.array(z.number()),

	postIdObjsExclude: z.array(IdObjSchema),
	postIdObjsInclude: z.array(IdObjSchema),
	tagsExclude: z.array(z.string()),
	tagsInclude: z.array(z.string()),
	coreExcludes: z.array(z.string()),
	coreIncludes: z.array(z.string()),
});

export type GetPostFeedQuery = z.infer<typeof GetPostFeedSchema>;

export let getPostFeed = async (q: GetPostFeedQuery) => {
	// TODO: Search local and global spaces in one query
	return q.useRpc
		? trpc().getPostFeed.query({ ...q, ...(await getBaseInput()) })
		: _getPostFeed(await gsdb(), q);
};

export let _getPostFeed = async (db: Database, q: GetPostFeedQuery) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	// console.log('q:', q);

	let bumpedFirst = !q.sortedBy || q.sortedBy === 'bumped';
	let newFirst = q.sortedBy === 'new';
	let oldFirst = q.sortedBy === 'old';
	let postIdStrFeed: string[] = [];
	let postsToFetchByIdObjs: IdObj[] = [];
	let postAtBumpedPostsIdObjsExclude = q.postAtBumpedPostsIdObjsExclude || [];
	// let searchConditions = q.useRpc ? [pf.by_ms.gt0, pf.in_ms.gt0] : undefined;
	// or(
	// 	...(q.tagsExclude || []).map((tag) => notLike(pTable.tag, `%"${tag}"%`)),
	// 	...(q.tagsInclude || []).map((tag) => like(pTable.tag, `%"${tag}"%`)),
	// );

	// let coreFilter =
	// 	q.coreExcludes?.length || q.coreIncludes?.length
	// 		? or(
	// 				...(q.coreExcludes || []).map((term) => pf.txt.notLike(`%${term}%`)),
	// 				...(q.coreIncludes || []).map((term) => pf.txt.like(`%${term}%`)),
	// 			)
	// 		: undefined;

	// let byMssFilter =
	// 	q.byMssExclude?.length || q.byMssInclude?.length
	// 		? or(
	// 				...(q.byMssExclude || []).map((ms) => pf.by_ms.notEq(ms)),
	// 				...(q.byMssInclude || []).map((ms) => pf.ms.eq(ms)),
	// 			)
	// 		: undefined;

	// let inMssFilter =
	// 	q.inMssInclude?.length || q.inMssExclude?.length
	// 		? or(
	// 				...(q.inMssExclude || []).map((ms) => pf.in_ms.notEq(ms)),
	// 				...(q.inMssInclude || []).map((ms) => pf.in_ms.eq(ms)),
	// 				// ...(q.inMssInclude || []).map((ms) =>
	// 				// 	ms === 0 //
	// 				// 		? q.useRpc
	// 				// 			? (() => {
	// 				// 					throw new Error('inMss cannot include 0 when useRpc');
	// 				// 				})()
	// 				// 			: pf.in_ms.eq(0)
	// 				// 		: !ms
	// 				// 			? and(
	// 				// 					pf.in_ms.eq(0),
	// 				// 					pf.by_ms.eq(
	// 				// 						q.callerMs ||
	// 				// 							(() => {
	// 				// 								throw new Error('Missing callerMs');
	// 				// 							})(),
	// 				// 					),
	// 				// 				)
	// 				// 			: pf.in_ms.eq(ms),
	// 				// ),
	// 			)
	// 		: undefined;

	// if (q.idObjsInclude?.length) {
	// 	// TODO: allow arbitrary length idObjsInclude
	// 	if (q.idObjsInclude?.length > 1) throw new Error(`idObjsInclude length must be 1 or 0`);
	// 	let spotIdObj = q.idObjsInclude[0];
	// 	let postPartsAndSubParts = await db
	// 		.select()
	// 		.from(pTable)
	// 		.where(
	// 			or(
	// 				and(
	// 					pf.id(spotIdObj),
	// 					// pf.ms.gt0,
	// 					// byMssFilter,
	// 					// inMssFilter,
	// 					pf.code.eq(pc.postIdWithNumAsLastVersionToParentPostId),
	// 					pf.txt.isNull,
	// 					pf.num.isNotNull,
	// 				),
	// 				and(
	// 					or(pf.idAsAtId(spotIdObj), pf.id(spotIdObj)),
	// 					// byMssFilter,
	// 					// inMssFilter,
	// 					pf.code.eq(pc.postIdWithNumAsDepthAtRootId),
	// 					pf.txt.isNull,
	// 					pf.num.isNotNull,
	// 				),
	// 			),
	// 		);

	// 	let spotPostIdRows: PartSelect[] = [];
	// 	let rootPostDescendantRows: PartSelect[] = [];
	// 	for (let i = 0; i < postPartsAndSubParts.length; i++) {
	// 		let part = postPartsAndSubParts[i];
	// 		if (part.code === pc.postIdWithNumAsLastVersionToParentPostId) {
	// 			spotPostIdRows.push(part);
	// 		} else if (part.code === pc.postIdWithNumAsDepthAtRootId) {
	// 			rootPostDescendantRows.push(part);
	// 		}
	// 	}

	// 	let spotPostIdRow = assertLt2Rows(spotPostIdRows);
	// 	if (spotPostIdRow && hasParent(spotPostIdRow)) {
	// 		let spotIdAtRootId = assert1Row(rootPostDescendantRows);
	// 		rootPostDescendantRows = await db
	// 			.select()
	// 			.from(pTable)
	// 			.where(
	// 				and(
	// 					pf.atId(spotIdAtRootId),
	// 					// pf.ms.gt0,
	// 					// byMssFilter,
	// 					// inMssFilter,
	// 					pf.code.eq(pc.postIdWithNumAsDepthAtRootId),
	// 					pf.txt.isNull,
	// 					pf.num.isNotNull,
	// 				),
	// 			);
	// 	}

	// 	let postIdObjsThatCiteSpotPost = await db
	// 		.select()
	// 		.from(pTable)
	// 		.where(
	// 			and(
	// 				pf.idAsAtId(spotIdObj),
	// 				// pf.ms.gt0,
	// 				// byMssFilter,
	// 				// inMssFilter,
	// 				pf.code.eq(pc.postIdToCitedPostId),
	// 				pf.txt.isNull,
	// 				pf.num.isNull,
	// 			),
	// 		)
	// 		.orderBy(pf.ms.desc)
	// 		.limit(postsPerLoad);

	// 	postsToFetchByIdObjs = [
	// 		...(spotPostIdRow ? [spotPostIdRow] : []), //
	// 		...rootPostDescendantRows,
	// 		...postIdObjsThatCiteSpotPost,
	// 	];
	// }

	if (q.coreExcludes || q.coreIncludes || q.tagsExclude || q.tagsInclude) {
		//
	}

	let excludePostIdsFilter = q.postIdObjsExclude?.length
		? q.postIdObjsExclude.map((pio) => pt.notId(pio))
		: [];

	// for fetching cited posts right after submitting post
	let includePostIdObjsFilter = q.postIdObjsInclude?.length
		? q.postIdObjsInclude.map((pio) => pt.id(pio))
		: [];
	let d0IdObjs: FullIdObj[] = [];
	if (includePostIdObjsFilter.length) {
		let {
			[pc.childPostIdWithNumAsDepthAtRootId]: childPostIdWithNumAsDepthAtRootIdObjs = [],
			[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtParentPostIdObjs = [],
			[pc.postIdAtCitedPostId]: postIdAtCitedPostIdObjs = [],
		} = channelPartsByCode(
			await db
				.select()
				.from(pTable)
				.where(
					or(
						and(
							...includePostIdObjsFilter,
							or(
								pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
								and(
									pt.noParent, //
									pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
								),
							),
							pt.txt.isNull,
							pt.num.isNotNull,
						),
						and(
							or(...q.postIdObjsInclude.map((pio) => pt.idAsAtId(pio))),
							pt.ms.gt0,
							pt.code.eq(pc.postIdAtCitedPostId),
							pt.txt.isNull,
							pt.num.isNull,
						),
					),
				)
				.orderBy(pt.ms.desc)
				.limit(includePostIdObjsFilter.length + postsPerLoad),
		);

		let includedPostRootOrAtRootIdObjs = [
			...childPostIdWithNumAsDepthAtRootIdObjs,
			...postIdWNumAsLastVersionAtParentPostIdObjs,
		];
		let rootIdObjs = includedPostRootOrAtRootIdObjs.map((idObj) => ({
			...zeros,
			...(idObj.code === pc.childPostIdWithNumAsDepthAtRootId
				? getAtIdObjAsIdObj(idObj)
				: getIdObj(idObj)),
		}));
		let descendentPostIdObjs = await getRootDescendentPostIdObjs(db, rootIdObjs);

		postsToFetchByIdObjs = [...rootIdObjs, ...descendentPostIdObjs, ...postIdAtCitedPostIdObjs];
		d0IdObjs = [
			...rootIdObjs,
			...postIdAtCitedPostIdObjs.filter(
				(pio) =>
					!descendentPostIdObjs.find(
						(io) =>
							io.ms === pio.ms && //
							io.by_ms === pio.by_ms &&
							io.in_ms === pio.in_ms,
					),
			),
		];
	} else if (q.view === 'nested') {
		if (bumpedFirst) {
			let atBumpedRootIdObjs = await db
				.select()
				.from(pTable)
				.where(
					and(
						pt.ms.lte(q.fromMs),
						// pt.at_ms.gt0,
						// ...(q.useRpc ? [pt.at_by_ms.gt0, pt.at_in_ms.gt0] : []),
						// pf.ms.gt0,
						// byMssFilter,
						// inMssFilter,
						...postAtBumpedPostsIdObjsExclude.flatMap((fullIdObj) => [
							pt.notFullId(fullIdObj),
							pt.notFullId(fullIdObj),
						]),
						pt.code.eq(pc.postIdAtBumpedRootId),
						pt.txt.isNull,
						pt.num.isNull,
					),
				)
				.orderBy(pt.ms.desc)
				.limit(postsPerLoad);
			d0IdObjs = atBumpedRootIdObjs.map((idObj) => ({ ...zeros, ...getAtIdObjAsIdObj(idObj) }));
			let lastAtBumpedRootIdObj = atBumpedRootIdObjs.slice(-1)[0];
			postAtBumpedPostsIdObjsExclude = [];
			for (let i = atBumpedRootIdObjs.length - 1; i >= 0; i--) {
				let postIdObj = atBumpedRootIdObjs[i];
				if (postIdObj.ms === lastAtBumpedRootIdObj!.ms) {
					postAtBumpedPostsIdObjsExclude.push(getFullIdObj(postIdObj));
				} else break;
			}
		} else if (newFirst || oldFirst) {
			d0IdObjs = await db
				.select()
				.from(pTable)
				.where(
					and(
						pt.noParent,
						// ...(q.useRpc ? [pt.by_ms.gt0, pt.in_ms.gt0] : []),
						// pf.ms.gt0,
						(oldFirst ? pt.ms.gte : pt.ms.lte)(q.fromMs),
						// byMssFilter,
						// inMssFilter,
						...excludePostIdsFilter,
						pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pt.txt.isNull,
						pt.num.isNotNull,
					),
				)
				.orderBy(oldFirst ? pt.ms.asc : pt.ms.desc)
				.limit(postsPerLoad);
		}
		let descendentPostIdObjs = await getRootDescendentPostIdObjs(db, d0IdObjs);
		postsToFetchByIdObjs = [...d0IdObjs, ...descendentPostIdObjs];
	} else if (q.view === 'flat') {
		let postIdAtBumpedRootIdObjs = bumpedFirst
			? await db
					.select()
					.from(pTable)
					.where(
						and(
							pt.ms.lte(q.fromMs),
							...excludePostIdsFilter,
							pt.code.eq(pc.postIdAtBumpedRootId),
							pt.txt.isNull,
							pt.num.isNull,
						),
					)
					.orderBy(pt.ms.desc)
					.limit(postsPerLoad)
			: [];
		d0IdObjs = bumpedFirst
			? postIdAtBumpedRootIdObjs.map((aio) => ({ ...zeros, ...getAtIdObjAsIdObj(aio) }))
			: await db
					.select()
					.from(pTable)
					.where(
						and(
							...(bumpedFirst
								? [
										pt.noParent, //
										or(...postIdAtBumpedRootIdObjs.map((aRio) => pt.atIdAsId(aRio))),
									]
								: []),
							(oldFirst ? pt.ms.gte : pt.ms.lte)(q.fromMs),
							...excludePostIdsFilter,
							pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
							pt.txt.isNull,
							pt.num.isNotNull,
						),
					)
					.orderBy(oldFirst ? pt.ms.asc : pt.ms.desc)
					.limit(postsPerLoad);
		postsToFetchByIdObjs = [
			...d0IdObjs,
			...d0IdObjs.flatMap((rio) => (hasParent(rio) ? [getAtIdObjAsIdObj(rio)] : [])),
		];
	}
	postIdStrFeed = d0IdObjs.map((pio) => getIdStr(pio));

	// getCitedPostIds;
	// let citedIds = coreTxtObjs.flatMap((r) =>
	// 	[...(r.txt || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
	// );
	// export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

	let getPostParts = async (postIdObs: IdObj[], omitPostIdAtCitedPostId = false) =>
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						or(...postIdObs.map((idObj) => pt.id(idObj))),
						or(
							pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
							omitPostIdAtCitedPostId ? undefined : pt.code.eq(pc.postIdAtCitedPostId),
						),
						pt.txt.isNull,
					),
					and(
						or(...postIdObs.map((io) => pt.idAsAtId(io))),
						or(
							...[
								pc.currentPostTagIdWithNumAsVersionAtPostId,
								pc.currentPostCoreIdWithNumAsVersionAtPostId,
								pc.currentVersionNumAndMsAtPostId,
								pc.currentSoftDeletedVersionNumAndMsAtPostId,
							].map((code) =>
								and(
									pt.code.eq(code),
									pt.num.isNotNull,
									pt.txt.isNull, //
								),
							),
							and(
								pt.ms.gt0,
								// pt.in_ms.eq(),
								pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
								pt.num.isNotNull,
								pt.txt.isNotNull,
							),
							and(
								pt.ms.gt0,
								// pt.in_ms.eq(),
								pt.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
								pt.num.isNull,
								pt.txt.isNotNull,
							),
						),
					),
				),
			);

	let {
		[pc.postIdAtCitedPostId]: postIdAtCitedPostIdObjs = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdObjs = [],
		[pc.currentPostTagIdWithNumAsVersionAtPostId]: curPostTagIdWNumAsVersionAtPostIdObjs = [],
		[pc.currentPostCoreIdWithNumAsVersionAtPostId]: curPostCoreIdWNumAsVersionAtPostIdObjs = [],
		[pc.currentVersionNumAndMsAtPostId]: curVersionNumAndMsAtPostIdObjs = [],
		[pc.currentSoftDeletedVersionNumAndMsAtPostId]: curSoftDeletedVersionNumAndMsAtPostIdObjs = [],
		[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmoTxtWUMsAndNAsCtAtPostIdObjs = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: rxnIdWEmoTxtAtPostIds = [],
	} = channelPartsByCode(
		postsToFetchByIdObjs.length ? await getPostParts(postsToFetchByIdObjs) : [],
	);

	let atCitedIdObjsThatNeedFetching = postIdAtCitedPostIdObjs
		.filter((aio) => !postsToFetchByIdObjs.find((fetchedIo) => atIdObjMatchesIdObj(aio, fetchedIo)))
		.map((aio) => getAtIdObjAsIdObj(aio));
	if (atCitedIdObjsThatNeedFetching.length) {
		let {
			[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdObjs_ = [],
			[pc.currentPostTagIdWithNumAsVersionAtPostId]: curPostTagIdWNumAsVersionAtPostIdObjs_ = [],
			[pc.currentPostCoreIdWithNumAsVersionAtPostId]: curPostCoreIdWNumAsVersionAtPostIdObjs_ = [],
			[pc.currentVersionNumAndMsAtPostId]: curVersionNumAndMsAtPostIdObjs_ = [],
			[pc.currentSoftDeletedVersionNumAndMsAtPostId]: curSDeletedVersionNumAndMsAtPostIdObjs_ = [],
			[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmoTxtWUMsAndNAsCtAtPostIdObjs_ = [],
			[pc.reactionIdWithEmojiTxtAtPostId]: rxnIdWEmoTxtAtPostIds_ = [],
		} = channelPartsByCode(await getPostParts(atCitedIdObjsThatNeedFetching, true));
		postIdWNumAsLastVersionAtPPostIdObjs.push(...postIdWNumAsLastVersionAtPPostIdObjs_);
		curPostTagIdWNumAsVersionAtPostIdObjs.push(...curPostTagIdWNumAsVersionAtPostIdObjs_);
		curPostCoreIdWNumAsVersionAtPostIdObjs.push(...curPostCoreIdWNumAsVersionAtPostIdObjs_);
		curVersionNumAndMsAtPostIdObjs.push(...curVersionNumAndMsAtPostIdObjs_);
		curSoftDeletedVersionNumAndMsAtPostIdObjs.push(...curSDeletedVersionNumAndMsAtPostIdObjs_);
		rEmoTxtWUMsAndNAsCtAtPostIdObjs.push(...rEmoTxtWUMsAndNAsCtAtPostIdObjs_);
		rxnIdWEmoTxtAtPostIds.push(...rxnIdWEmoTxtAtPostIds_);
	}

	let {
		[pc.tagIdAndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreIdAndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountObjs = [],
	} = channelPartsByCode(
		curPostTagIdWNumAsVersionAtPostIdObjs.length || curPostCoreIdWNumAsVersionAtPostIdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								or(
									...makePartsUniqueById(curPostTagIdWNumAsVersionAtPostIdObjs).map((row) =>
										pt.id(row),
									),
								),
								pt.noParent,
								pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
								pt.txt.isNotNull,
								pt.num.isNotNull,
							),
							and(
								or(
									...makePartsUniqueById(curPostCoreIdWNumAsVersionAtPostIdObjs).map((row) =>
										pt.id(row),
									),
								),
								pt.noParent,
								pt.code.eq(pc.coreIdAndTxtWithNumAsCount),
								pt.txt.isNotNull,
								pt.num.isNotNull,
							),
						),
					)
			: [],
	);

	let idToPostMap: Record<string, Post> = {};
	for (let i = 0; i < postIdWNumAsLastVersionAtPPostIdObjs.length; i++) {
		let mainPartObj = postIdWNumAsLastVersionAtPPostIdObjs[i];
		let partIdStr = getIdStr(mainPartObj);
		idToPostMap[partIdStr] = {
			...mainPartObj,
			history:
				mainPartObj.num === null
					? null //
					: { [mainPartObj.num]: { ms: 0, tags: [] } },
		};
	}
	let tagIdToTxtMap = reduceTxtRowsToMap(tagIdAndTxtWithNumAsCountObjs);
	let coreIdToTxtMap = reduceTxtRowsToMap(coreIdAndTxtWithNumAsCountObjs);
	let subParts = [
		...curPostTagIdWNumAsVersionAtPostIdObjs,
		...curPostCoreIdWNumAsVersionAtPostIdObjs,
		...curVersionNumAndMsAtPostIdObjs,
		...curSoftDeletedVersionNumAndMsAtPostIdObjs,
		...rEmoTxtWUMsAndNAsCtAtPostIdObjs,
		...rxnIdWEmoTxtAtPostIds,
	];
	for (let i = 0; i < subParts.length; i++) {
		let part = subParts[i];
		let partIdStr = getIdStr(part);
		let partAtIdStr = getAtIdStr(part);
		if (part.code === pc.currentPostTagIdWithNumAsVersionAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.tags!.push(tagIdToTxtMap[partIdStr]);
		} else if (part.code === pc.currentPostCoreIdWithNumAsVersionAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.core = coreIdToTxtMap[partIdStr];
		} else if (part.code === pc.currentVersionNumAndMsAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.ms = part.ms!;
		} else if (part.code === pc.currentSoftDeletedVersionNumAndMsAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.tags = null;
		} else if (part.code === pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId) {
			idToPostMap[partAtIdStr].rxnCount = {
				...idToPostMap[partAtIdStr].rxnCount,
				[part.txt!]: part.num!,
			};
		} else if (part.code === pc.reactionIdWithEmojiTxtAtPostId) {
			idToPostMap[partAtIdStr].myRxns = [
				part.txt as RxnEmoji,
				...(idToPostMap[partAtIdStr].myRxns || []),
			];
		}
	}

	rEmoTxtWUMsAndNAsCtAtPostIdObjs;
	rxnIdWEmoTxtAtPostIds;

	// TODO: delete any posts in idToPostMap that are deleted (null history) and have no non-deleted descendants
	// console.log('getPostFeed:', postIdStrFeed, idToPostMap);
	return { postIdStrFeed, idToPostMap, postAtBumpedPostsIdObjsExclude };
};

let getRootDescendentPostIdObjs = async (db: Database, rootIdObjs: IdObj[]) =>
	rootIdObjs.length
		? await db
				.select()
				.from(pTable)
				.where(
					and(
						or(...rootIdObjs.map((pio) => pt.idAsAtId(pio))),
						pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
						pt.txt.isNull,
						pt.num.isNotNull,
					),
				)
		: [];
