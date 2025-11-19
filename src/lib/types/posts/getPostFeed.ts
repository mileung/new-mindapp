import { dev } from '$app/environment';
// import { tdb } from '$lib/server/db';
import { trpc } from '$lib/trpc/client';
import {
	and,
	asc,
	desc,
	eq,
	gte,
	isNotNull,
	isNull,
	like,
	lte,
	not,
	notLike,
	or,
	sql,
} from 'drizzle-orm';
import type { LibSQLDatabase } from 'drizzle-orm/libsql';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { z } from 'zod';
import { gsdb } from '../../local-db';
import { partsTable } from '../parts-table';
import {
	assert1Row,
	getId,
	hasParent,
	partCodes,
	type Database,
	type PartInsert,
	type PartSelect,
	idsRegex,
	getSplitId,
	filterSplitId,
	filterSplitIdAsToSplitId,
	filterToSplitId,
	getToId,
	filterToSplitIdAsSplitId,
	getToSplitIdAsSplitId,
	SplitIdSchema,
	type SplitId,
	assertLt2Rows,
} from '../parts';
import { type Post } from '.';

export let postsPerLoad = 15;

export let GetPostFeedSchema = z.object({
	useRpc: z.boolean().optional(),
	callerMs: z.number().optional(),
	view: z.enum(['nested', 'linear']).optional(),
	sortedBy: z.enum(['bumped', 'new', 'old']).optional(),
	fromMs: z.number(),

	byMssInclude: z.array(z.number().nullable()).optional(),
	byMssExclude: z.array(z.number().nullable()).optional(),
	inMssInclude: z.array(z.number().nullable()).optional(),
	inMssExclude: z.array(z.number().nullable()).optional(),

	splitIdsInclude: z.array(SplitIdSchema).optional(),
	splitIdsExclude: z.array(SplitIdSchema).optional(),
	tagsInclude: z.array(z.string()).optional(),
	tagsExclude: z.array(z.string()).optional(),
	bodyIncludes: z.array(z.string()).optional(),
	bodyExcludes: z.array(z.string()).optional(),
});

export let getPostFeed = async (q: Parameters<typeof _getPostFeed>[1]) => {
	// TODO: Search local and global spaces in one query
	return q.useRpc ? trpc().getPostFeed.mutate(q) : _getPostFeed(await gsdb(), q);
};

export let _getPostFeed = async (db: Database, q: z.infer<typeof GetPostFeedSchema>) => {
	console.log('q:', q);
	let postIds: string[] = [];
	let postMap: Record<string, Post> = {};
	let postsToFetchBySplitId: SplitId[] = [];

	if (q.useRpc && !q.inMssInclude?.length) throw new Error('Must include at least one inMs');

	let all = await db.select().from(partsTable);
	console.table(all);

	let bumpedFirst = !q.sortedBy || q.sortedBy === 'bumped';
	let newFirst = q.sortedBy === 'new';
	let oldFirst = q.sortedBy === 'old';

	let searchConditions = [
		...(q.useRpc ? [isNotNull(partsTable.by_ms), isNotNull(partsTable.in_ms)] : []),
	];
	// or(...(q.tagsInclude || []).map((tag) => like(partsTable.tag, `%"${tag}"%`))),
	// ...(q.tagsExclude || []).map((tag) => notLike(partsTable.tag, `%"${tag}"%`)),

	let splitIdsFilters = [
		// TODO: Think about how splitIdsInclude can be used - if it's even needed
		// or(...(q.splitIdsInclude || []).map((splitId) => filterSplitId(splitId))),
		or(
			...(q.splitIdsExclude || []).map((splitId) => {
				let filter = filterSplitId(splitId);
				return filter ? not(filter) : undefined;
			}),
		),
	];

	let bodyFilter = q.bodyIncludes?.length
		? or(
				...(q.bodyIncludes || []).map((term) => like(partsTable.txt, `%${term}%`)),
				...(q.bodyExcludes || []).map((term) => notLike(partsTable.txt, `%${term}%`)),
			)
		: undefined;

	let byMssFilter =
		q.byMssInclude?.length || q.byMssExclude?.length
			? or(
					...(q.byMssInclude || []).map((ms) =>
						ms === null ? isNull(partsTable.by_ms) : eq(partsTable.by_ms, ms),
					),
					...(q.byMssExclude || []).map((ms) =>
						ms === null ? isNotNull(partsTable.by_ms) : not(eq(partsTable.by_ms, ms)),
					),
				)
			: undefined;

	let inMssFilter =
		q.inMssInclude?.length || q.inMssExclude?.length
			? or(
					...(q.inMssInclude || []).map((ms) =>
						ms === null //
							? q.useRpc
								? (() => {
										throw new Error('inMss cannot include null when useRpc');
									})()
								: isNull(partsTable.in_ms)
							: !ms
								? and(
										eq(partsTable.in_ms, 0),
										eq(
											partsTable.by_ms,
											q.callerMs ||
												(() => {
													throw new Error('Missing callerMs');
												})(),
										),
									)
								: eq(partsTable.in_ms, ms),
					),
					...(q.inMssExclude || []).map((ms) =>
						ms === null ? isNotNull(partsTable.in_ms) : not(eq(partsTable.in_ms, ms)),
					),
				)
			: undefined;

	if (q.splitIdsInclude?.length) {
		// TODO: allow arbitrary length splitIdsInclude
		if (q.splitIdsInclude?.length > 1) throw new Error(`splitIdsInclude length must be 1 or 0`);
		let spotSplitId = q.splitIdsInclude[0];
		let postPartsAndSubParts = await db
			.select()
			.from(partsTable)
			.where(
				or(
					and(
						filterSplitId(spotSplitId),
						isNotNull(partsTable.ms),
						byMssFilter,
						inMssFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
					and(
						or(filterSplitIdAsToSplitId(spotSplitId), filterSplitId(spotSplitId)),
						byMssFilter,
						inMssFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				),
			);

		let spotPostIdRows: PartSelect[] = [];
		let rootPostDescendantRows: PartSelect[] = [];
		for (let i = 0; i < postPartsAndSubParts.length; i++) {
			let part = postPartsAndSubParts[i];
			if (part.code === partCodes.postIdWithNumAsLastVersionToParentPostId) {
				spotPostIdRows.push(part);
			} else if (part.code === partCodes.postIdWithNumAsDepthToRootPostId) {
				rootPostDescendantRows.push(part);
			}
		}

		let spotPostIdRow = assertLt2Rows(spotPostIdRows);
		if (spotPostIdRow && hasParent(spotPostIdRow)) {
			let spotIdToRootPostId = assert1Row(rootPostDescendantRows);
			rootPostDescendantRows = await db
				.select()
				.from(partsTable)
				.where(
					and(
						filterToSplitId(spotIdToRootPostId),
						isNotNull(partsTable.ms),
						byMssFilter,
						inMssFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				);
		}

		let postIdsThatCiteSpotRows = await db
			.select()
			.from(partsTable)
			.where(
				and(
					filterSplitIdAsToSplitId(spotSplitId),
					isNotNull(partsTable.ms),
					byMssFilter,
					inMssFilter,
					eq(partsTable.code, partCodes.postIdToCitedPostId),
					isNull(partsTable.txt),
					isNull(partsTable.num),
				),
			)
			.orderBy(desc(partsTable.ms))
			.limit(postsPerLoad);

		postsToFetchBySplitId = [
			...(spotPostIdRow ? [spotPostIdRow] : []), //
			...rootPostDescendantRows,
			...postIdsThatCiteSpotRows,
		];

		postIds = [
			...(spotPostIdRow ? [getId(spotPostIdRow)] : []),
			...postIdsThatCiteSpotRows.map((r) => getId(r)),
		];
	} else if (q.view === 'nested') {
		let rootPostIdRows: SplitId[] = [];
		// let priorityLevelsToRootPostIds: PartSelect[] = [];
		// let rootPostParts: PartSelect[] = [];
		if (bumpedFirst) {
			let priorityLevelsToRootPostIds = await db
				.select()
				.from(partsTable)
				.where(
					and(
						lte(partsTable.ms, q.fromMs),
						isNotNull(partsTable.to_ms),
						...(q.useRpc ? [isNotNull(partsTable.to_by_ms), isNotNull(partsTable.to_in_ms)] : []),
						isNotNull(partsTable.ms),
						byMssFilter,
						inMssFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				)
				.orderBy(desc(partsTable.ms))
				.limit(postsPerLoad);
			rootPostIdRows = priorityLevelsToRootPostIds.map((splitId) => getToSplitIdAsSplitId(splitId));
		} else if (newFirst || oldFirst) {
			rootPostIdRows = await db
				.select()
				.from(partsTable)
				.where(
					and(
						isNull(partsTable.to_ms),
						isNull(partsTable.to_by_ms),
						isNull(partsTable.to_in_ms),
						...(q.useRpc ? [isNotNull(partsTable.by_ms), isNotNull(partsTable.in_ms)] : []),
						isNotNull(partsTable.ms),
						(oldFirst ? gte : lte)(partsTable.ms, q.fromMs),
						byMssFilter,
						inMssFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				)
				.orderBy((oldFirst ? asc : desc)(partsTable.ms))
				.limit(postsPerLoad);
		}
		postIds = rootPostIdRows.map((part) => getId(part));

		let descendentPostIdRows = await db
			.select()
			.from(partsTable)
			.where(
				and(
					or(...rootPostIdRows.map((splitId) => filterSplitIdAsToSplitId(splitId))),
					isNotNull(partsTable.ms),
					byMssFilter,
					inMssFilter,
					eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
					isNull(partsTable.txt),
					isNotNull(partsTable.num),
				),
			);

		postsToFetchBySplitId = [...rootPostIdRows, ...descendentPostIdRows];
	} else if (q.view === 'linear') {
		// 		postIds
		// postsToFetchBySplitId
		// rootPosts = await db
		// 	.select()
		// 	.from(partsTable)
		// 	.where(and(...rootConditions))
		// 	.orderBy((q.sortedBy==='old' ? asc : desc)(partsTable.ms))
		// 	.limit(postsPerLoad);
		// // TODO: I shouldn't have to add a bang to r.to_id!. TypeScript bug? Don't want to use typeof i==='string' in filter
		// toIds = rootPosts.map((r) => r.to_id!).filter((i) => !!i);
		// citedIds = rootPosts.flatMap((r) =>
		// 	[...(r.txt || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
		// );
		// getCitedPostIds;
	}

	let postPartsAndSubParts = await db
		.select()
		.from(partsTable)
		.where(
			or(
				and(
					isNotNull(partsTable.ms),
					byMssFilter,
					inMssFilter,
					or(...postsToFetchBySplitId.map((splitId) => filterSplitId(splitId))),
					eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
					isNull(partsTable.txt),
				),
				and(
					or(...postsToFetchBySplitId.map((splitId) => filterSplitIdAsToSplitId(splitId))),
					or(
						...[
							partCodes.currentPostTagIdWithNumAsVersionToPostId,
							partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId,
						].map((code) =>
							and(
								eq(partsTable.code, code), //
								isNotNull(partsTable.num),
							),
						),
					),
				),
			),
		);

	let tagIdsSet = new Set<string>();
	let currentTagIdRows: PartSelect[] = [];
	let currentBodyRows: PartSelect[] = [];

	for (let i = 0; i < postPartsAndSubParts.length; i++) {
		let part = postPartsAndSubParts[i];
		if (part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId) {
			let tagId = getId(part);
			if (part.ms && !tagIdsSet.has(tagId)) {
				tagIdsSet.add(tagId);
				currentTagIdRows.push(part);
			}
		}
		if (part.code === partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId) {
			currentBodyRows.push(part);
		}
	}

	let tagRows = currentTagIdRows.length
		? await db
				.select()
				.from(partsTable)
				.where(
					or(
						currentTagIdRows.length
							? and(
									or(...currentTagIdRows.map((row) => filterSplitId(row))),
									isNull(partsTable.to_ms),
									isNull(partsTable.to_by_ms),
									isNull(partsTable.to_in_ms),
									eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
									isNotNull(partsTable.txt),
									isNotNull(partsTable.num),
								)
							: undefined,
					),
				)
		: [];

	let parts = [...postPartsAndSubParts, ...tagRows];
	let tagIdToTxtMap: Record<string, string> = {};
	let postTagsMap: Record<string, string[]> = {};

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		if (part.code === partCodes.postIdWithNumAsLastVersionToParentPostId) {
			let id = getId(part);
			postMap[id] = postMap[id] || { history: part.num === null ? null : { [part.num]: {} } };
			postMap[id] = {
				...postMap[id],
				to_ms: part.to_ms,
				to_by_ms: part.to_by_ms,
				to_in_ms: part.to_in_ms,
				ms: part.ms!,
				by_ms: part.by_ms,
				in_ms: part.in_ms,
			};
		} else if (part.code === partCodes.tagTxtAndNumAsCount) {
			tagIdToTxtMap[getId(part)] = part.txt!;
		} else {
			let toId = getToId(part)!;
			if (part.num === null) throw new Error(`part.num dne`);
			postMap[toId] = postMap[toId] || { history: { [part.num]: {} } };
			if (part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId) {
				if (part.ms !== null) {
					postTagsMap[toId] = [getId(part), ...(postTagsMap[toId] || [])];
					postMap[toId].history![part.num]!.tags = postTagsMap[toId];
				}
			} else if (part.code === partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId) {
				postMap[toId].history![part.num]!.body = part.txt;
				postMap[toId].history![part.num]!.ms = part.ms!;
			}
		}
	}

	// TODO: delete any posts in postMap that are deleted (null history) and have no non-deleted descendants
	// console.log('postMap:', postMap);

	let postTagsMapKeys = Object.keys(postTagsMap);
	// console.log('postTagsMap:', postTagsMap);
	for (let keyI = 0; keyI < postTagsMapKeys.length; keyI++) {
		let postTags = postTagsMap[postTagsMapKeys[keyI]];
		for (let i = 0; i < postTags.length; i++) {
			postTags[i] = tagIdToTxtMap[postTags[i]];
		}
	}

	// await Promise.all(
	// 	[...new Set([...citedIds, ...(q.nested ? toIds : [])])].map((id) => {
	// 		return _selectToPostPart(db, id).then((post) => {
	// 			if (post) {
	// 				auxPosts[id] = post;
	// 				byMss.push(auxPosts[id].by_ms);
	// 			}
	// 		});
	// 	}),
	// );

	// await Promise.all(
	// 	[...new Set(byMss)].map((id) => {
	// 		if (id) return getPostById().then((a) => a && (authors[id] = a));
	// 	}),
	// );

	// console.log('postIds:', postIds);
	// console.log('postMap:', postMap);
	return { postIds, postMap };
};
