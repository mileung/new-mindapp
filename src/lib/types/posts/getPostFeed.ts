import { trpc } from '$lib/trpc/client';
import { and, not, or } from 'drizzle-orm';
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
import { atIdObjAsIdObj, getAtIdStr, getIdStr, IdObjSchema, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let postsPerLoad = 15;
export let bracketRegex = /\[([^\[\]]+)]/g;

export let GetPostFeedSchema = z.object({
	useRpc: z.boolean(),
	callerMs: z.number().nullable(),
	view: z.enum(['nested', 'flat']),
	sortedBy: z.enum(['bumped', 'new', 'old']),
	fromMs: z.number(),

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
		? trpc().getPostFeed.mutate({ ...q, ...getBaseInput() })
		: _getPostFeed(await gsdb(), q);
};

export let _getPostFeed = async (db: Database, q: GetPostFeedQuery) => {
	let all = await db.select().from(pTable);
	console.table(all);

	// console.log('q:', q);

	let bumpedFirst = !q.sortedBy || q.sortedBy === 'bumped';
	let newFirst = q.sortedBy === 'new';
	let oldFirst = q.sortedBy === 'old';
	let postIdObjFeed: IdObj[] = [];
	let postIdStrFeed: string[] = [];
	let postsToFetchByIdObjs: IdObj[] = [];

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

	if (q.coreExcludes || q.coreIncludes || q.tagsExclude || q.tagsInclude) {
		//
	}

	let excludePostIdsFilter = q.postIdObjsExclude?.length
		? q.postIdObjsExclude.map((pio) => not(pt.id(pio)!))
		: [];

	// for fetching cited posts right after submitting post
	let includePostIdsFilter = q.postIdObjsInclude?.length
		? q.postIdObjsInclude.map((pio) => pt.id(pio))
		: [];

	if (q.view === 'nested') {
		let rootPostIdObjs: IdObj[] = [];
		// let rootPostParts: PartSelect[] = [];
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
						...excludePostIdsFilter,
						pt.code.eq(pc.postIdAtBumpedRootId),
						pt.txt.isNull,
						pt.num.isNull,
					),
				)
				.orderBy(pt.ms.desc)
				.limit(postsPerLoad);
			rootPostIdObjs = atBumpedRootIdObjs.map((idObj) => atIdObjAsIdObj(idObj));
		} else if (newFirst || oldFirst) {
			rootPostIdObjs = await db
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
		let descendentPostIdObjs = rootPostIdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						and(
							or(...rootPostIdObjs.map((pio) => pt.idAsAtId(pio))),
							// pf.ms.gt0,
							// byMssFilter,
							// inMssFilter,
							pt.code.eq(pc.postIdWithNumAsDepthAtRootId),
							pt.txt.isNull,
							pt.num.isNotNull,
						),
					)
			: [];

		postsToFetchByIdObjs = [...rootPostIdObjs, ...descendentPostIdObjs];
		postIdObjFeed = rootPostIdObjs;
	} else if (q.view === 'flat') {
		let rootPostIdObjs = await db
			.select()
			.from(pTable)
			// .where(and(...rootConditions))
			.orderBy(oldFirst ? pt.ms.asc : pt.ms.desc)
			.limit(postsPerLoad);
		postsToFetchByIdObjs = [
			...rootPostIdObjs,
			...rootPostIdObjs.flatMap((rpio) => (hasParent(rpio) ? [atIdObjAsIdObj(rpio)] : [])),
		];
		postIdObjFeed = rootPostIdObjs;
	}

	postIdStrFeed = postIdObjFeed.map((pio) => getIdStr(pio));
	// 	postIdStrFeed = [
	// 		...(spotPostIdRow ? [getIdStr(spotPostIdRow)] : []),
	// 		...postIdObjsThatCiteSpotPost.map((r) => getIdStr(r)),
	// 	];
	// }

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
								pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId,
								pc.currentVersionNumAndMsAtPostId,
								pc.currentSoftDeletedVersionNumAndMsAtPostId,
							].map((code) =>
								and(
									pt.code.eq(code),
									pt.num.isNotNull,
									pt.txt.isNull, //
								),
							),
						),
					),
				),
			);

	let {
		[pc.postIdAtCitedPostId]: postIdAtCitedPostIdObjs = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: pIdWNumAsLastVersionAtPPIdObjs = [],
		[pc.currentPostTagIdWithNumAsVersionAtPostId]: cPTagIdWNumAsVersionAtPIdObjs = [],
		[pc.currentPostCoreIdWithNumAsVersionAtPostId]: cPCoreIdWNumAsVersionAtPIdObjs = [],
		[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmojiTxtWMsAndNAsCtAtPIdObjs = [],
		[pc.currentVersionNumAndMsAtPostId]: cVersionNumAndMsAtPIdObjs = [],
		[pc.currentSoftDeletedVersionNumAndMsAtPostId]: cSoftDeletedVersionNumAndMsAtPIdObjs = [],
	} = channelPartsByCode(
		postsToFetchByIdObjs.length ? await getPostParts(postsToFetchByIdObjs) : [],
	);

	let atCitedIdObjsThatNeedFetching = postIdAtCitedPostIdObjs
		.filter((aio) => !postsToFetchByIdObjs.find((fetchedIo) => atIdObjMatchesIdObj(aio, fetchedIo)))
		.map((aio) => atIdObjAsIdObj(aio));
	if (atCitedIdObjsThatNeedFetching.length) {
		let {
			[pc.postIdWithNumAsLastVersionAtParentPostId]: pIdWNumAsLastVersionAtPPIdObjs_ = [],
			[pc.currentPostTagIdWithNumAsVersionAtPostId]: cPTagIdWNumAsVersionAtPIdObjs_ = [],
			[pc.currentPostCoreIdWithNumAsVersionAtPostId]: cPCoreIdWNumAsVersionAtPIdObjs_ = [],
			[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmojiTxtWMsAndNAsCtAtPIdObjs_ = [],
			[pc.currentVersionNumAndMsAtPostId]: cVersionNumAndMsAtPIdObjs_ = [],
			[pc.currentSoftDeletedVersionNumAndMsAtPostId]: cSoftDeletedVersionNumAndMsAtPIdObjs_ = [],
		} = channelPartsByCode(await getPostParts(atCitedIdObjsThatNeedFetching, true));
		pIdWNumAsLastVersionAtPPIdObjs.push(...pIdWNumAsLastVersionAtPPIdObjs_);
		cPTagIdWNumAsVersionAtPIdObjs.push(...cPTagIdWNumAsVersionAtPIdObjs_);
		cPCoreIdWNumAsVersionAtPIdObjs.push(...cPCoreIdWNumAsVersionAtPIdObjs_);
		rEmojiTxtWMsAndNAsCtAtPIdObjs.push(...rEmojiTxtWMsAndNAsCtAtPIdObjs_);
		cVersionNumAndMsAtPIdObjs.push(...cVersionNumAndMsAtPIdObjs_);
		cSoftDeletedVersionNumAndMsAtPIdObjs.push(...cSoftDeletedVersionNumAndMsAtPIdObjs_);
	}

	let {
		[pc.tagIdAndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreIdAndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountObjs = [],
	} = channelPartsByCode(
		cPTagIdWNumAsVersionAtPIdObjs.length || cPCoreIdWNumAsVersionAtPIdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								or(...makePartsUniqueById(cPTagIdWNumAsVersionAtPIdObjs).map((row) => pt.id(row))),
								pt.noParent,
								pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
								pt.txt.isNotNull,
								pt.num.isNotNull,
							),
							and(
								or(...makePartsUniqueById(cPCoreIdWNumAsVersionAtPIdObjs).map((row) => pt.id(row))),
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
	for (let i = 0; i < pIdWNumAsLastVersionAtPPIdObjs.length; i++) {
		let mainPartObj = pIdWNumAsLastVersionAtPPIdObjs[i];
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
		...cPTagIdWNumAsVersionAtPIdObjs,
		...cPCoreIdWNumAsVersionAtPIdObjs,
		...cVersionNumAndMsAtPIdObjs,
		...cSoftDeletedVersionNumAndMsAtPIdObjs,
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
		}
	}

	pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId;
	rEmojiTxtWMsAndNAsCtAtPIdObjs;

	// TODO: delete any posts in idToPostMap that are deleted (null history) and have no non-deleted descendants
	console.log('getPostFeed', postIdStrFeed, idToPostMap);
	return { postIdStrFeed, idToPostMap };
};
