import { getWhoObj, gsdb } from '$lib/global-state.svelte';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { z } from 'zod';
import { type Post } from '.';
import { type Database } from '../../local-db';
import {
	atIdObjMatchesIdObj,
	channelPartsByCode,
	hasParent,
	makePartsUniqueByAtId,
	makePartsUniqueById,
	reduceTxtRowsToMap,
	type GranularNumProp,
	type GranularTxtProp,
	type WhoObj,
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
	type FullIdObj,
	type IdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import type { RxnEmoji } from '../reactions';
import { ParsedSearchSchema } from './parseSearchQuery';

export let postsPerLoad = 15;
export let bracketRegex = /\[([^\[\]]+)]/g;

export let GetPostFeedArgSchema = ParsedSearchSchema.extend({
	view: z.enum(['nested', 'flat']),
	sortedBy: z.enum(['bumped', 'new', 'old']),
	postAtBumpedPostIdObjsExclude: z.array(FullIdObjSchema),
});

export type GetPostFeedArg = z.infer<typeof GetPostFeedArgSchema>;

export let getPostFeed = async (q: GetPostFeedArg, useLocalDb: boolean) => {
	let input = { ...q, ...(await getWhoObj()) };
	// TODO: use local db as a fallback when cloud db can't find a post
	return useLocalDb //
		? _getPostFeed(await gsdb(), input, false)
		: trpc().getPostFeed.query(input);
};

// TODO: fetch cited posts right after submitting post

export let _getPostFeed = async (db: Database, q: WhoObj & GetPostFeedArg, useLocalDb: boolean) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));
	// console.log('_getPostFeed q:', q);

	if (!useLocalDb) {
		// let c = await _getCallerContext(ctx, input, {signedIn: true,});
		// throwIf(input.callerMs && (!c.signedIn ));
	}

	let bumpedFirst = q.sortedBy === 'bumped';
	let newFirst = q.sortedBy === 'new';
	let topLvlPostIdStrs: string[] = [];
	let postsToFetchByIdObjs: IdObj[] = [];

	let excludePostIdsFilters = q.postIdObjsExclude.map((pio) => pf.notId(pio));

	let byMsInMsFilters = [
		q.byMssExclude.length ? and(...q.byMssExclude.map((ms) => pf.by_ms.notEq(ms))) : undefined,
		q.byMssInclude.length ? or(...q.byMssInclude.map((ms) => pf.by_ms.eq(ms))) : undefined,
		q.inMssExclude.length ? and(...q.inMssExclude.map((ms) => pf.in_ms.notEq(ms))) : undefined,
		q.inMssInclude.length ? or(...q.inMssInclude.map((ms) => pf.in_ms.eq(ms))) : undefined,
	];

	let topLvlIdObjs: FullIdObj[] = [];

	if (q.coreExcludes || q.coreIncludes || q.tagsExclude || q.tagsInclude) {
		// let searchConditions = q.baseInput.spaceMs? [pf.by_ms.gt0, pf.in_ms.gt0] : undefined;

		// or(
		// 	...(q.tagsExclude || []).map((tag) => notLike(pTable.tag, `%"${tag}"%`)),
		// 	...(q.tagsInclude || []).map((tag) => like(pTable.tag, `%"${tag}"%`)),
		// );

		q.tagsInclude;
		q.coreIncludes;

		// let coreFilter =
		// 	q.coreExcludes?.length || q.coreIncludes?.length
		// 		? or(
		// 				...(q.coreExcludes || []).map((term) => pf.txt.notLike(`%${term}%`)),
		// 				...(q.coreIncludes || []).map((term) => pf.txt.like(`%${term}%`)),
		// 			)
		// 		: undefined;

		topLvlIdObjs = await db
			.select()
			.from(pTable)
			.where(
				and(
					// pf.noParent,
					// newFirst //
					// 	? pf.ms.lt(q.fromMs || Number.MAX_SAFE_INTEGER)
					// 	: pf.ms.gt(q.fromMs || -Number.MAX_SAFE_INTEGER),
					// ...(q.spaceMs ? [pf.by_ms.gt0, pf.in_ms.gt0] : []),
					// ...byMsInMsFilters,
					// ...excludePostIdsFilters,
					pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
					// pf.num.gte0,
					// pf.txt.isNull,
				),
			)
			.orderBy(newFirst ? pf.ms.desc : pf.ms.asc)
			.limit(postsPerLoad);
	}

	let postAtBumpedPostIdObjsExclude: FullIdObj[] = [];
	if (bumpedFirst) {
		let postIdAtBumpedRootIdRows = await db
			.select()
			.from(pTable)
			.where(
				and(
					pf.at_ms.gt0,
					pf.ms.lt(q.msBefore || Number.MAX_SAFE_INTEGER),
					...byMsInMsFilters,
					...q.postAtBumpedPostIdObjsExclude.flatMap((fullIdObj) => [
						pf.notAtId(fullIdObj),
						pf.notId(fullIdObj),
					]),
					pf.code.eq(pc.postIdAtBumpedRootId),
					pf.num.eq0,
					pf.txt.isNull,
				),
			)
			.orderBy(pf.ms.desc)
			.limit(postsPerLoad);

		topLvlIdObjs = postIdAtBumpedRootIdRows.map((aio) => ({ ...id0, ...getAtIdObjAsIdObj(aio) }));

		let lastPostIdAtBumpedRootIdObj = postIdAtBumpedRootIdRows.slice(-1)[0];
		for (let i = postIdAtBumpedRootIdRows.length - 1; i >= 0; i--) {
			let postIdObj = postIdAtBumpedRootIdRows[i];
			if (postIdObj.ms === lastPostIdAtBumpedRootIdObj!.ms) {
				postAtBumpedPostIdObjsExclude.push(getFullIdObj(postIdObj));
			} else break;
		}
	}

	if (q.postIdObjsInclude.length) {
		// TODO: Could show all the other public spaces the included posts were cited in
		// or just spaces the caller is a member of, but this may be a privacy concern like maybe
		// you cited something from global in your personal space. Probably just better
		// to only show posts that cite the included posts from the same space.

		let {
			[pc.postIdLastVersionNumAtParentPostId]: postIdLastVersionNumAtParentPostIdRows = [],
			[pc.childPostIdWithNumAsDepthAtRootId]: childPostIdWithNumAsDepthAtRootIdRows = [],
			[pc.postIdAtCitedPostId]: postIdAtCitedPostIdRows = [],
		} = channelPartsByCode(
			await db
				.select()
				.from(pTable)
				.where(
					or(
						and(
							or(...q.postIdObjsInclude.map((pio) => pf.id(pio))),
							...byMsInMsFilters,
							or(
								and(
									pf.noAtId, //
									pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
								),
								pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
							),
							pf.num.gte0,
							pf.txt.isNull,
						),
						and(
							or(...q.postIdObjsInclude.map((pio) => pf.idAsAtId(pio))),
							pf.ms.gt0,
							...byMsInMsFilters, // TODO: Option to show posts from outside spaces that cite the highlighted post?
							pf.code.eq(pc.postIdAtCitedPostId),
							pf.num.eq0,
							pf.txt.isNull,
						),
					),
				)
				.orderBy(pf.ms.desc),
			// TODO: paginate postIdAtCitedPostIdRows and q.postIdObjsInclude
			// .limit(postsPerLoad),
		);

		let rootIdObjs = [
			...postIdLastVersionNumAtParentPostIdRows,
			...childPostIdWithNumAsDepthAtRootIdRows,
		].map((idObj) => ({
			...id0,
			...(idObj.code === pc.childPostIdWithNumAsDepthAtRootId
				? getAtIdObjAsIdObj(idObj)
				: getIdObj(idObj)),
		}));
		let {
			[pc.postIdLastVersionNumAtParentPostId]: citingPostIdWNumAsLastVersionAtPPostId = [],
			[pc.childPostIdWithNumAsDepthAtRootId]: descendentPostIdRows = [],
		} = channelPartsByCode(
			rootIdObjs.length
				? await db
						.select()
						.from(pTable)
						.where(
							or(
								and(
									or(...postIdAtCitedPostIdRows.map((pio) => pf.id(pio))),
									...byMsInMsFilters,
									pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
									pf.num.gte0,
									pf.txt.isNull,
								),
								and(
									or(...rootIdObjs.map((pio) => pf.idAsAtId(pio))),
									...byMsInMsFilters,
									pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
									pf.num.gte0,
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
			...citingPostIdWNumAsLastVersionAtPPostId.map((pi) => getAtIdObjAsIdObj(pi)),
		];

		topLvlIdObjs = [
			...rootIdObjs,
			...postIdAtCitedPostIdRows,
			// TODO: idk if I should do this. This may interfere with paginating cited in posts
			// Could just have the frontend not render cited in posts that are also a root descendent
			// ...postIdAtCitedPostIdRows.filter(
			// 	(pio) => !descendentPostIdRows.find((io) => idObjMatchesIdObj(io, pio)),
			// ),
		];
	} else if (q.view === 'nested') {
		if (!bumpedFirst) {
			topLvlIdObjs = await db
				.select()
				.from(pTable)
				.where(
					and(
						pf.noAtId,
						newFirst //
							? pf.ms.lt(q.msBefore || Number.MAX_SAFE_INTEGER)
							: pf.ms.gt(q.msAfter || -Number.MAX_SAFE_INTEGER),
						// ...(q.spaceMs ? [pf.by_ms.gt0, pf.in_ms.gt0] : []),
						...byMsInMsFilters,
						...excludePostIdsFilters,
						pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
				)
				.orderBy(newFirst ? pf.ms.desc : pf.ms.asc)
				.limit(postsPerLoad);
		}
		postsToFetchByIdObjs = [
			...topLvlIdObjs,
			...(topLvlIdObjs.length
				? await db
						.select()
						.from(pTable)
						.where(
							and(
								or(...topLvlIdObjs.map((pio) => pf.idAsAtId(pio))),
								pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
								pf.num.gte0,
								pf.txt.isNull,
							),
						)
				: []),
		];
	} else if (q.view === 'flat') {
		if (!bumpedFirst) {
			topLvlIdObjs = await db
				.select()
				.from(pTable)
				.where(
					and(
						newFirst
							? pf.ms.lt(q.msBefore || Number.MAX_SAFE_INTEGER)
							: pf.ms.gt(q.msAfter || -Number.MAX_SAFE_INTEGER),
						...byMsInMsFilters,
						...excludePostIdsFilters,
						pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
				)
				.orderBy(newFirst ? pf.ms.desc : pf.ms.asc)
				.limit(postsPerLoad);
		}
		postsToFetchByIdObjs = [
			...topLvlIdObjs,
			...topLvlIdObjs.flatMap((rio) => (hasParent(rio) ? [getAtIdObjAsIdObj(rio)] : [])),
		];
	}
	topLvlPostIdStrs = topLvlIdObjs.map((pio) => getIdStr(pio));

	let getPostParts = async (postIdObs: IdObj[], omitPostIdAtCitedPostId = false) => {
		// let accountMss = [...new Set(postIdObs.map((idObj)=>idObj.by_ms))];
		// let accountIdObjs
		// TODO: pf.txt.notEq('') for getting account/space names
		return await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						or(...postIdObs.map((idObj) => pf.id(idObj))),
						or(
							pf.code.eq(pc.postIdLastVersionNumAtParentPostId),
							omitPostIdAtCitedPostId ? undefined : pf.code.eq(pc.postIdAtCitedPostId),
						),
						pf.txt.isNull,
					),
					and(
						or(...postIdObs.map((io) => pf.id(io))),
						and(
							pf.ms.gt0,
							// pt.in_ms.eq(),
							pf.code.eq(pc.postIdRxnEmojiTxtAndCountNum),
							pf.num.gt0,
							pf.txt.isNotNull,
						),
					),
					and(
						or(...postIdObs.map((io) => pf.idAsAtId(io))),
						or(
							...[
								pc.currentVersionNumMsAtPostId,
								pc.currentSoftDeletedVersionNumMsAtPostId,
								pc.currentPostTagIdWithVersionNumAtPostId,
								pc.currentPostCoreIdWithVersionNumAtPostId,
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
								pf.by_ms.eq(q.callerMs),
								pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
								pf.num.isNull,
								pf.txt.isNotNull,
							),
						),
					),
				),
			);
	};

	let {
		[pc.postIdLastVersionNumAtParentPostId]: postIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.postIdAtCitedPostId]: postIdAtCitedPostIdRows = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdRows = [],
		[pc.currentVersionNumMsAtPostId]: curVersionNumAndMsAtPostIdRows = [],
		[pc.currentSoftDeletedVersionNumMsAtPostId]: curSoftDeletedVersionNumAndMsAtPostIdRows = [],
		[pc.currentPostTagIdWithVersionNumAtPostId]: curPostTagIdWNumAsVersionAtPostIdRows = [],
		[pc.currentPostCoreIdWithVersionNumAtPostId]: curPostCoreIdWNumAsVersionAtPostIdRows = [],
		[pc.postIdRxnEmojiTxtAndCountNum]: postIdRxnEmojiTxtAndCountNumRows = [],
		// [pc.assignedRoleNumIdAtAccountId]: assignedRoleNumIdAtAccountIdRows = [],
		// [pc.nameTxtMsAtAccountId]: nameTxtMsAtAccountIdRows = [],
	} = channelPartsByCode(
		postsToFetchByIdObjs.length ? await getPostParts(postsToFetchByIdObjs) : [],
	);

	let spaceMssToFetchSet = new Set<number>();

	let citedIdObjsToFetch = makePartsUniqueByAtId(
		postIdAtCitedPostIdRows.filter((aio) => {
			spaceMssToFetchSet.add(aio.at_in_ms);
			return !postsToFetchByIdObjs.find((fetchedIo) => atIdObjMatchesIdObj(aio, fetchedIo));
		}),
	).map((aio) => getAtIdObjAsIdObj(aio));

	if (q.callerMs) {
		if (q.inMssInclude.length) {
			for (let i = 0; i < q.inMssInclude.length; i++) {
				spaceMssToFetchSet.delete(q.inMssInclude[i]);
			}
		}
		if (spaceMssToFetchSet.size) {
			let citedInMss = [...spaceMssToFetchSet];
			let {
				[pc.spaceNameTxtId]: spaceNameTxtIdWithPublicBinRows = [],
				[pc.roleCodeNumIdAtAccountId]: roleCodeNumIdAtAccountIdRows = [],
			} = channelPartsByCode(
				await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								or(...citedInMss.map((ms) => pf.in_ms.eq(ms))),
								pf.code.eq(pc.spaceNameTxtId), //
							),
							and(
								or(...citedInMss.map((ms) => pf.in_ms.eq(ms))),
								pf.by_ms.eq(q.callerMs),
								pf.code.eq(pc.roleCodeNumIdAtAccountId),
							),
						),
					),
			);
		}
	}

	if (citedIdObjsToFetch.length) {
		let {
			// [pc.postIdAtCitedPostId]: postIdAtCitedPostIdRows = [],
			[pc.postIdLastVersionNumAtParentPostId]: _postIdWNumAsLastVersionAtPPostIdRows = [],
			[pc.reactionIdWithEmojiTxtAtPostId]: _reactionIdWithEmojiTxtAtPostIdRows = [],
			[pc.currentVersionNumMsAtPostId]: _curVersionNumAndMsAtPostIdRows = [],
			[pc.currentSoftDeletedVersionNumMsAtPostId]: _curSoftDeletedVersionNumAndMsAtPostIdRows = [],
			[pc.currentPostTagIdWithVersionNumAtPostId]: _curPostTagIdWNumAsVersionAtPostIdRows = [],
			[pc.currentPostCoreIdWithVersionNumAtPostId]: _curPostCoreIdWNumAsVersionAtPostIdRows = [],
			[pc.postIdRxnEmojiTxtAndCountNum]: _postIdRxnEmojiTxtAndCountNumRows = [],
			// [pc.assignedRoleNumIdAtAccountId]: _assignedRoleNumIdAtAccountIdRows = [],
			// [pc.nameTxtMsAtAccountId]: _nameTxtMsAtAccountIdRows = [],
		} = channelPartsByCode(await getPostParts(citedIdObjsToFetch, true));
		postIdWNumAsLastVersionAtPPostIdRows.push(..._postIdWNumAsLastVersionAtPPostIdRows);
		reactionIdWithEmojiTxtAtPostIdRows.push(..._reactionIdWithEmojiTxtAtPostIdRows);
		curVersionNumAndMsAtPostIdRows.push(..._curVersionNumAndMsAtPostIdRows);
		curSoftDeletedVersionNumAndMsAtPostIdRows.push(..._curSoftDeletedVersionNumAndMsAtPostIdRows);
		curPostTagIdWNumAsVersionAtPostIdRows.push(..._curPostTagIdWNumAsVersionAtPostIdRows);
		curPostCoreIdWNumAsVersionAtPostIdRows.push(..._curPostCoreIdWNumAsVersionAtPostIdRows);
		postIdRxnEmojiTxtAndCountNumRows.push(..._postIdRxnEmojiTxtAndCountNumRows);
		// assignedRoleNumIdAtAccountIdRows.push(..._assignedRoleNumIdAtAccountIdRows);
		// nameTxtMsAtAccountIdRows.push(..._nameTxtMsAtAccountIdRows);
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
								pf.noAtId,
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
								pf.noAtId,
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
		...postIdRxnEmojiTxtAndCountNumRows,
		...reactionIdWithEmojiTxtAtPostIdRows,
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
			idToPostMap[partAtIdStr].history![part.num!]!.ms = part.ms;
		} else if (part.code === pc.currentSoftDeletedVersionNumMsAtPostId) {
			idToPostMap[partAtIdStr].history![part.num!]!.tags = null;
		} else if (part.code === pc.postIdRxnEmojiTxtAndCountNum) {
			idToPostMap[partIdStr].rxnEmojiCount = {
				...idToPostMap[partIdStr].rxnEmojiCount,
				[part.txt!]: part.num!,
			};
		} else if (part.code === pc.reactionIdWithEmojiTxtAtPostId) {
			idToPostMap[partAtIdStr].myRxnEmojis = [
				part.txt as RxnEmoji,
				...(idToPostMap[partAtIdStr].myRxnEmojis || []),
			];
		}
	}

	postIdRxnEmojiTxtAndCountNumRows;
	reactionIdWithEmojiTxtAtPostIdRows;

	// let test = or(
	// 	and(
	// 		or(
	// 			...postIdObs.map((idObj) =>
	// 				and(pf.atId({at_ms:idObj.by_ms), pf.ms.gt0, pf.in_ms.eq(idObj.in_ms)),
	// 			),
	// 		),
	// 		pf.code.eq(pc.assignedRoleNumIdAtAccountId),
	// 	),
	// 	and(
	// 		// TODO: idk if filtering down arrays to be unique is worth it here. Same for querying promos
	// 		// or(...postIdObs.map((idObj) => pf.atId({at_ms:idObj.by_ms))),
	// 		or(...[...new Set(postIdObs.map((idObj) => idObj.by_ms))].map((byMs) => pf.atId({at_ms:byMs))),
	// 		pf.by_ms.eq0,
	// 		pf.in_ms.eq0,
	// 		pf.code.eq(pc.nameTxtMsAtAccountId),
	// 	),
	// );

	let msToAccountNameTxtMap: Record<number, string> = {};
	// for (let i = 0; i < nameTxtMsAtAccountIdRows.length; i++) {
	// 	let { txt, at_ms } = nameTxtMsAtAccountIdRows[i];
	// 	msToAccountNameTxtMap[at_ms] = txt!;
	// }

	let msToSpaceNameTxtMap: Record<number, string> = {};
	// for (let i = 0; i < nameTxtMsAtAccountIdRows.length; i++) {
	// 	let { txt, at_ms } = nameTxtMsAtAccountIdRows[i];
	// 	// msToSpaceNameTxtMap[at_ms] = txt!;
	// }

	let spaceMsToAccountMsToMembershipMap: Record<
		number,
		Record<
			number,
			{
				role?: GranularNumProp;
				flair?: GranularTxtProp;
			}
		>
	> = {};
	// for (let i = 0; i < assignedRoleNumIdAtAccountIdRows.length; i++) {
	// 	let { in_ms, at_ms } = assignedRoleNumIdAtAccountIdRows[i];
	// 	if (!spaceMsToAccountMsToMembershipMap[in_ms]) spaceMsToAccountMsToMembershipMap[in_ms] = {};
	// 	spaceMsToAccountMsToMembershipMap[in_ms]![at_ms] = true;
	// }

	// TODO: delete any posts in idToPostMap that are deleted (null history) and have no non-deleted descendants
	// console.log('getPostFeed:', topLvlPostIdStrs, idToPostMap);
	return {
		topLvlPostIdStrs,
		idToPostMap,
		postAtBumpedPostIdObjsExclude,
		msToAccountNameTxtMap,
		msToSpaceNameTxtMap,
		spaceMsToAccountMsToMembershipMap,
	};
};
