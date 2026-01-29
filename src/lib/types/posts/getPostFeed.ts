import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { z } from 'zod';
import { type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	atIdObjMatchesIdObj,
	channelPartsByCode,
	getWhoWhereObj,
	hasParent,
	idObjMatchesIdObj,
	makePartsUniqueById,
	reduceTxtRowsToMap,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import {
	FullIdObjSchema,
	getAtIdObjAsIdObj,
	getAtIdStr,
	getFullIdObj,
	getIdObj,
	getIdStr,
	id0,
	IdObjSchema,
	type FullIdObj,
	type IdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import type { RxnEmoji } from '../reactions';

export let postsPerLoad = 15;
export let bracketRegex = /\[([^\[\]]+)]/g;

export let GetPostFeedSchema = z.object({
	view: z.enum(['nested', 'flat']),
	sortedBy: z.enum(['bumped', 'new', 'old']),
	fromMs: z.number().optional(),
	postAtBumpedPostIdObjsExclude: z.array(FullIdObjSchema).optional(),

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

export let getPostFeed = async (q: GetPostFeedQuery, forceUsingLocalDb?: boolean) => {
	let baseInput = await getWhoWhereObj();
	// TODO: use local db as a fallback when cloud db can't find a post
	return baseInput.spaceMs && !forceUsingLocalDb
		? trpc().getPostFeed.query({ ...q, ...baseInput })
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
	let postIdAtBumpedRootIdRows: FullIdObj[] = [];
	let postAtBumpedPostIdObjsExclude = q.postAtBumpedPostIdObjsExclude || [];

	let postIdAtBumpedRootIdRowsFilter = bumpedFirst
		? and(
				pf.ms.lte(q.fromMs || Number.MAX_SAFE_INTEGER),
				// pt.at_ms.gt0,
				// ...(q.baseInput.spaceMs? [pt.at_by_ms.gt0, pt.at_in_ms.gt0] : []),
				// pf.ms.gt0,
				// byMssFilter,
				// inMssFilter,
				...postAtBumpedPostIdObjsExclude.flatMap((fullIdObj) => [
					pf.notAtId(fullIdObj),
					pf.notId(fullIdObj),
				]),
				pf.code.eq(pc.postIdAtBumpedRootId),
				pf.num.eq0,
				pf.txt.isNull,
			)
		: undefined;
	// let searchConditions = q.baseInput.spaceMs? [pf.by_ms.gt0, pf.in_ms.gt0] : undefined;
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

	if (q.coreExcludes || q.coreIncludes || q.tagsExclude || q.tagsInclude) {
		//
	}

	let excludePostIdsFilter = q.postIdObjsExclude?.length
		? q.postIdObjsExclude.map((pio) => pf.notId(pio))
		: [];

	// TODO: use for fetching cited posts right after submitting post
	let includePostIdObjsFilter = q.postIdObjsInclude?.length
		? q.postIdObjsInclude.map((pio) => pf.id(pio))
		: [];
	let d0IdObjs: FullIdObj[] = [];
	if (includePostIdObjsFilter.length) {
		// TODO: paginate postIdAtCitedPostIdRows with postsPerLoad
		let {
			[pc.childPostIdWithNumAsDepthAtRootId]: childPostIdWithNumAsDepthAtRootIdRows = [],
			[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtParentPostIdRows = [],
			[pc.postIdAtCitedPostId]: postIdAtCitedPostIdRows = [],
		} = channelPartsByCode(
			await db
				.select()
				.from(pTable)
				.where(
					or(
						and(
							...includePostIdObjsFilter,
							or(
								pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
								and(
									pf.noParent, //
									pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
								),
							),
							pf.num.gte0,
							pf.txt.isNull,
						),
						and(
							or(...q.postIdObjsInclude.map((pio) => pf.idAsAtId(pio))),
							pf.ms.gt0,
							pf.code.eq(pc.postIdAtCitedPostId),
							pf.num.eq0,
							pf.txt.isNull,
						),
					),
				)
				.orderBy(pf.ms.desc)
				.limit(includePostIdObjsFilter.length + postsPerLoad),
		);

		let rootIdObjs = [
			...childPostIdWithNumAsDepthAtRootIdRows,
			...postIdWNumAsLastVersionAtParentPostIdRows,
		].map((idObj) => ({
			...id0,
			...(idObj.code === pc.childPostIdWithNumAsDepthAtRootId
				? getAtIdObjAsIdObj(idObj)
				: getIdObj(idObj)),
		}));
		let {
			[pc.childPostIdWithNumAsDepthAtRootId]: descendentPostIdRows = [],
			[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdAtCitedPostIdParentRows = [],
		} = channelPartsByCode(
			rootIdObjs.length
				? await db
						.select()
						.from(pTable)
						.where(
							or(
								and(
									or(...rootIdObjs.map((pio) => pf.idAsAtId(pio))),
									pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
									pf.num.gte0,
									pf.txt.isNull,
								),
								and(
									or(...postIdAtCitedPostIdRows.map((pio) => pf.id(pio))),
									pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
									pf.txt.isNull,
								),
							),
						)
				: [],
		);

		postsToFetchByIdObjs = [
			...rootIdObjs,
			...descendentPostIdRows,
			...postIdAtCitedPostIdRows,
			...postIdAtCitedPostIdParentRows.map((pi) => getAtIdObjAsIdObj(pi)),
		];

		d0IdObjs = [
			...rootIdObjs,
			...postIdAtCitedPostIdRows.filter(
				(pio) => !descendentPostIdRows.find((io) => idObjMatchesIdObj(io, pio)),
			),
		];
	} else if (q.view === 'nested') {
		if (bumpedFirst) {
			postIdAtBumpedRootIdRows = await db
				.select()
				.from(pTable)
				.where(postIdAtBumpedRootIdRowsFilter)
				.orderBy(pf.ms.desc)
				.limit(postsPerLoad);
			d0IdObjs = postIdAtBumpedRootIdRows.map((idObj) => ({ ...id0, ...getAtIdObjAsIdObj(idObj) }));
		} else if (newFirst || oldFirst) {
			d0IdObjs = await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.noParent,
						// ...(q.baseInput.spaceMs? [pt.by_ms.gt0, pt.in_ms.gt0] : []),
						// pf.ms.gt0,
						oldFirst
							? pf.ms.gte(q.fromMs || 0) //
							: pf.ms.lte(q.fromMs || Number.MAX_SAFE_INTEGER),
						// byMssFilter,
						// inMssFilter,
						...excludePostIdsFilter,
						pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
				)
				.orderBy(oldFirst ? pf.ms.asc : pf.ms.desc)
				.limit(postsPerLoad);
		}
		let descendentPostIdObjs = d0IdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						and(
							or(...d0IdObjs.map((pio) => pf.idAsAtId(pio))),
							pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							pf.num.gte0,
							pf.txt.isNull,
						),
					)
			: [];
		postsToFetchByIdObjs = [...d0IdObjs, ...descendentPostIdObjs];
	} else if (q.view === 'flat') {
		postIdAtBumpedRootIdRows = bumpedFirst
			? await db
					.select()
					.from(pTable)
					.where(postIdAtBumpedRootIdRowsFilter)
					.orderBy(pf.ms.desc)
					.limit(postsPerLoad)
			: [];
		d0IdObjs = bumpedFirst
			? postIdAtBumpedRootIdRows.map((aio) => ({ ...id0, ...getAtIdObjAsIdObj(aio) }))
			: await db
					.select()
					.from(pTable)
					.where(
						and(
							...(bumpedFirst
								? [
										pf.noParent, //
										or(...postIdAtBumpedRootIdRows.map((aRio) => pf.atIdAsId(aRio))),
									]
								: []),
							oldFirst
								? pf.ms.gte(q.fromMs || 0) //
								: pf.ms.lte(q.fromMs || Number.MAX_SAFE_INTEGER),
							...excludePostIdsFilter,
							pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
							pf.num.gte0,
							pf.txt.isNull,
						),
					)
					.orderBy(oldFirst ? pf.ms.asc : pf.ms.desc)
					.limit(postsPerLoad);
		postsToFetchByIdObjs = [
			...d0IdObjs,
			...d0IdObjs.flatMap((rio) => (hasParent(rio) ? [getAtIdObjAsIdObj(rio)] : [])),
		];
	}
	postIdStrFeed = d0IdObjs.map((pio) => getIdStr(pio));

	if (bumpedFirst) {
		postAtBumpedPostIdObjsExclude = [];
		let lastPostIdAtBumpedRootIdObj = postIdAtBumpedRootIdRows.slice(-1)[0];
		for (let i = postIdAtBumpedRootIdRows.length - 1; i >= 0; i--) {
			let postIdObj = postIdAtBumpedRootIdRows[i];
			if (postIdObj.ms === lastPostIdAtBumpedRootIdObj!.ms) {
				postAtBumpedPostIdObjsExclude.push(getFullIdObj(postIdObj));
			} else break;
		}
	}

	// getCitedPostIds;
	// let citedIds = coreTxtObjs.flatMap((r) =>
	// 	[...(r.txt || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
	// );
	// export let getCitedPostIds = (s = '') => [...new Set(s.matchAll(idsRegex).map(([t]) => t))];

	let getPostParts = async (postIdObs: IdObj[], omitPostIdAtCitedPostId = false) => {
		// let accountMss = [...new Set(postIdObs.map((idObj)=>idObj.by_ms))];
		// let accountIdObjs
		return await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						or(
							...postIdObs.map((idObj) =>
								and(pf.msAsAtId(idObj.by_ms), pf.ms.gt0, pf.in_ms.eq(idObj.in_ms)),
							),
						),
						pf.code.eq(pc.promotionToModIdAtAccountId),
					),
					and(
						or(
							...postIdObs.map((idObj) =>
								and(pf.msAsAtId(idObj.by_ms), pf.ms.gt0, pf.in_ms.eq(idObj.in_ms)),
							),
						),
						pf.code.eq(pc.promotionToOwnerIdAtAccountId),
					),
					and(
						// TODO: idk if filtering down arrays to be unique is worth it here. Same for querying promos
						// or(...postIdObs.map((idObj) => pf.msAsAtId(idObj.by_ms))),
						or(
							...[...new Set(postIdObs.map((idObj) => idObj.by_ms))].map((byMs) =>
								pf.msAsAtId(byMs),
							),
						),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.nameTxtMsAtAccountId),
					),
					and(
						or(...postIdObs.map((idObj) => pf.id(idObj))),
						or(
							pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
							omitPostIdAtCitedPostId ? undefined : pf.code.eq(pc.postIdAtCitedPostId),
						),
						pf.txt.isNull,
					),
					and(
						or(...postIdObs.map((io) => pf.idAsAtId(io))),
						or(
							...[
								pc.currentPostTagIdWithVersionNumAtPostId,
								pc.currentPostCoreIdWithVersionNumAtPostId,
								pc.currentVersionNumMsAtPostId,
								pc.currentSoftDeletedVersionNumMsAtPostId,
							].map((code) =>
								and(
									pf.code.eq(code),
									pf.num.gte0,
									pf.txt.isNull, //
								),
							),
							and(
								pf.ms.gt0,
								// pt.in_ms.eq(),
								pf.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
								pf.num.gte0,
								pf.txt.isNotNull,
							),
							and(
								pf.ms.gt0,
								// pt.in_ms.eq(),
								pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
								pf.num.eq0,
								pf.txt.isNotNull,
							),
						),
					),
				),
			);
	};

	let {
		[pc.promotionToModIdAtAccountId]: promotionToModIdAtAccountIdRows = [],
		[pc.promotionToOwnerIdAtAccountId]: promotionToOwnerIdAtAccountIdRows = [],
		[pc.nameTxtMsAtAccountId]: nameTxtMsAtAccountIdRows = [],
		[pc.postIdAtCitedPostId]: postIdAtCitedPostIdRows = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.currentPostTagIdWithVersionNumAtPostId]: curPostTagIdWNumAsVersionAtPostIdRows = [],
		[pc.currentPostCoreIdWithVersionNumAtPostId]: curPostCoreIdWNumAsVersionAtPostIdRows = [],
		[pc.currentVersionNumMsAtPostId]: curVersionNumAndMsAtPostIdRows = [],
		[pc.currentSoftDeletedVersionNumMsAtPostId]: curSoftDeletedVersionNumAndMsAtPostIdRows = [],
		[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmoTxtWUMsAndNAsCtAtPostIdRows = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: rxnIdWEmoTxtAtPostIdRows = [],
	} = channelPartsByCode(
		postsToFetchByIdObjs.length ? await getPostParts(postsToFetchByIdObjs) : [],
	);

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < nameTxtMsAtAccountIdRows.length; i++) {
		let { txt, at_ms } = nameTxtMsAtAccountIdRows[i];
		msToAccountNameTxtMap[at_ms] = txt!;
	}

	let spaceMsToMapOwnerAccountMs: Record<number, Record<number, boolean>> = {};
	for (let i = 0; i < promotionToOwnerIdAtAccountIdRows.length; i++) {
		let { in_ms, at_ms } = promotionToOwnerIdAtAccountIdRows[i];
		if (!spaceMsToMapOwnerAccountMs[in_ms]) spaceMsToMapOwnerAccountMs[in_ms] = {};
		spaceMsToMapOwnerAccountMs[in_ms]![at_ms] = true;
	}

	let spaceMsToMapModAccountMs: Record<number, Record<number, boolean>> = {};
	for (let i = 0; i < promotionToModIdAtAccountIdRows.length; i++) {
		let { in_ms, at_ms } = promotionToModIdAtAccountIdRows[i];
		if (!spaceMsToMapModAccountMs[in_ms]) spaceMsToMapModAccountMs[in_ms] = {};
		spaceMsToMapModAccountMs[in_ms]![at_ms] = true;
	}

	let atCitedIdObjsThatNeedFetching = postIdAtCitedPostIdRows
		.filter((aio) => !postsToFetchByIdObjs.find((fetchedIo) => atIdObjMatchesIdObj(aio, fetchedIo)))
		.map((aio) => getAtIdObjAsIdObj(aio));
	if (atCitedIdObjsThatNeedFetching.length) {
		let {
			[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdRows_ = [],
			[pc.currentPostTagIdWithVersionNumAtPostId]: curPostTagIdWNumAsVersionAtPostIdRows_ = [],
			[pc.currentPostCoreIdWithVersionNumAtPostId]: curPostCoreIdWNumAsVersionAtPostIdRows_ = [],
			[pc.currentVersionNumMsAtPostId]: curVersionNumAndMsAtPostIdRows_ = [],
			[pc.currentSoftDeletedVersionNumMsAtPostId]: curSDeletedVersionNumAndMsAtPostIdRows_ = [],
			[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmoTxtWUMsAndNAsCtAtPostIdRows_ = [],
			[pc.reactionIdWithEmojiTxtAtPostId]: rxnIdWEmoTxtAtPostIdRows_ = [],
		} = channelPartsByCode(await getPostParts(atCitedIdObjsThatNeedFetching, true));
		postIdWNumAsLastVersionAtPPostIdRows.push(...postIdWNumAsLastVersionAtPPostIdRows_);
		curPostTagIdWNumAsVersionAtPostIdRows.push(...curPostTagIdWNumAsVersionAtPostIdRows_);
		curPostCoreIdWNumAsVersionAtPostIdRows.push(...curPostCoreIdWNumAsVersionAtPostIdRows_);
		curVersionNumAndMsAtPostIdRows.push(...curVersionNumAndMsAtPostIdRows_);
		curSoftDeletedVersionNumAndMsAtPostIdRows.push(...curSDeletedVersionNumAndMsAtPostIdRows_);
		rEmoTxtWUMsAndNAsCtAtPostIdRows.push(...rEmoTxtWUMsAndNAsCtAtPostIdRows_);
		rxnIdWEmoTxtAtPostIdRows.push(...rxnIdWEmoTxtAtPostIdRows_);
	}

	let {
		[pc.tagId8AndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8AndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		curPostTagIdWNumAsVersionAtPostIdRows.length || curPostCoreIdWNumAsVersionAtPostIdRows.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								or(
									...makePartsUniqueById(curPostTagIdWNumAsVersionAtPostIdRows).map((row) =>
										pf.id(row),
									),
								),
								pf.noParent,
								pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
								pf.num.gte0,
								pf.txt.isNotNull,
							),
							and(
								or(
									...makePartsUniqueById(curPostCoreIdWNumAsVersionAtPostIdRows).map((row) =>
										pf.id(row),
									),
								),
								pf.noParent,
								pf.code.eq(pc.coreId8AndTxtWithNumAsCount),
								pf.num.gte0,
								pf.txt.isNotNull,
							),
						),
					)
			: [],
	);

	let idToPostMap: Record<string, Post> = {};
	for (let i = 0; i < postIdWNumAsLastVersionAtPPostIdRows.length; i++) {
		let mainPartObj = postIdWNumAsLastVersionAtPPostIdRows[i];
		let partIdStr = getIdStr(mainPartObj);
		idToPostMap[partIdStr] = {
			...getFullIdObj(mainPartObj),
			history: mainPartObj.num //
				? { [mainPartObj.num]: { ms: 0, tags: [] } }
				: null,
		};
	}
	let tagIdToTxtMap = reduceTxtRowsToMap(tagIdAndTxtWithNumAsCountRows);
	let coreIdToTxtMap = reduceTxtRowsToMap(coreIdAndTxtWithNumAsCountRows);
	let subParts = [
		...curPostTagIdWNumAsVersionAtPostIdRows,
		...curPostCoreIdWNumAsVersionAtPostIdRows,
		...curVersionNumAndMsAtPostIdRows,
		...curSoftDeletedVersionNumAndMsAtPostIdRows,
		...rEmoTxtWUMsAndNAsCtAtPostIdRows,
		...rxnIdWEmoTxtAtPostIdRows,
	];
	for (let i = 0; i < subParts.length; i++) {
		let part = subParts[i];
		let partIdStr = getIdStr(part);
		let partAtIdStr = getAtIdStr(part);
		if (part.code === pc.currentPostTagIdWithVersionNumAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.tags!.push(tagIdToTxtMap[partIdStr]);
		} else if (part.code === pc.currentPostCoreIdWithVersionNumAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.core = coreIdToTxtMap[partIdStr];
		} else if (part.code === pc.currentVersionNumMsAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.ms = part.ms!;
		} else if (part.code === pc.currentSoftDeletedVersionNumMsAtPostId) {
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

	rEmoTxtWUMsAndNAsCtAtPostIdRows;
	rxnIdWEmoTxtAtPostIdRows;

	// TODO: delete any posts in idToPostMap that are deleted (null history) and have no non-deleted descendants
	// console.log('getPostFeed:', postIdStrFeed, idToPostMap);
	return {
		postIdStrFeed,
		idToPostMap,
		postAtBumpedPostIdObjsExclude,
		msToAccountNameTxtMap,
		spaceMsToMapOwnerAccountMs,
		spaceMsToMapModAccountMs,
	};
};
