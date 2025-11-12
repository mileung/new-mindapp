import { dev } from '$app/environment';
// import { tdb } from '$lib/server/db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, eq, gte, isNotNull, isNull, like, lte, not, or, sql } from 'drizzle-orm';
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
	splitId,
	filterIdSegs,
	filterIdSegsAsToIdSegs,
	filterToIdSegs,
	getToId,
	filterToIdSegsAsIdSegs,
} from '../parts';
import { type Post } from '.';

export let rootPostsPerLoad = 15;

export let getPostFeedSchema = z.object({
	callerMs: z.number().optional(),
	useRpc: z.boolean().optional(),
	nested: z.boolean().optional(),
	oldestFirst: z.boolean().optional(), // TODO: implementing this will require more data analyzing to ensure the right fromMs is sent. e.g. What to do when appending a new post to an oldest first feed and the newest posts haven't been fetched yet?
	fromMs: z.number(),
	idsInclude: z.array(z.string()).optional(),
	idsExclude: z.array(z.string()).optional(),
	mssInclude: z.array(z.number().nullable()).optional(),
	mssExclude: z.array(z.number().nullable()).optional(),
	byMssInclude: z.array(z.number().nullable()).optional(),
	byMssExclude: z.array(z.number().nullable()).optional(),
	inMssInclude: z.array(z.number().nullable()).optional(),
	inMssExclude: z.array(z.number().nullable()).optional(),
	tagsInclude: z.array(z.string()).optional(),
	tagsExclude: z.array(z.string()).optional(),
	txtIncludes: z.array(z.string()).optional(),
	txtExcludes: z.array(z.string()).optional(),
});

export let getPostFeed = async (q: Parameters<typeof _getPostFeed>[1]) => {
	// TODO: Search local and global spaces in one query
	return q.useRpc ? trpc().getPostFeed.mutate(q) : _getPostFeed(await gsdb(), q);
};

export let _getPostFeed = async (db: Database, q: z.infer<typeof getPostFeedSchema>) => {
	let idsExcludeSet = new Set(q.idsExclude);
	let rootPosts: Post[] = [];
	let postIds: string[] = [];
	let postMap: Record<string, Post> = {};
	let postTagsMap: Record<string, string[]> = {};
	let postSubIdsMap: Record<string, string[]> = {};
	let byMss: (null | number)[] = [];
	let toIds: string[] = [];
	let citedIds: string[] = [];
	let auxPosts: Record<string, PartSelect> = {};

	if (q.useRpc && !q.inMssInclude?.length) throw new Error('Must include at least one inMs');

	let rootConditions = [
		(q.oldestFirst ? gte : lte)(partsTable.ms, q.fromMs),

		isNotNull(partsTable.ms),
		...(q.useRpc ? [isNotNull(partsTable.by_ms), isNotNull(partsTable.in_ms)] : []),
		and(
			and(isNull(partsTable.to_ms), isNull(partsTable.to_by_ms), isNull(partsTable.to_in_ms)),
			eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
			isNull(partsTable.txt),
			eq(partsTable.num, 0),
		),
		// or(
		// 	...(q.inMssInclude || []).map((ms) =>
		// 		ms === null
		// 			? q.useRpc
		// 				? (() => {
		// 						throw new Error('inMss cannot include null when useRpc');
		// 					})()
		// 				: isNull(partsTable.in_ms)
		// 			: !ms
		// 				? and(
		// 						eq(partsTable.in_ms, 0),
		// 						eq(
		// 							partsTable.by_ms,
		// 							q.callerMs ||
		// 								(() => {
		// 									throw new Error('Missing callerMs');
		// 								})(),
		// 						),
		// 					)
		// 				: eq(partsTable.in_ms, ms),
		// 	),
		// ),

		// or(...(q.idsInclude || []).map((id) => filterId(id))),
		// ...(q.idsExclude || []).map((id) => {
		// 	let filter = filterId(id);
		// 	return filter ? not(filter) : undefined;
		// }),

		// or(
		// 	...(q.byMssInclude || []).map((ms) =>
		// 		ms === null ? isNull(partsTable.by_ms) : eq(partsTable.by_ms, ms),
		// 	),
		// ),

		// ...(q.byMssExclude || []).map((ms) =>
		// 	ms === null ? isNotNull(partsTable.ms) : not(eq(partsTable.by_ms, ms)),
		// ),

		// or(...(q.tagsInclude || []).map((tag) => like(partsTable.tag, `%"${tag}"%`))),
		// ...(q.tagsExclude || []).map((tag) => notLike(partsTable.tag, `%"${tag}"%`)),

		// or(...(q.txtIncludes || []).map((term) => like(partsTable.txt, `%${term}%`))),
		// ...(q.txtExcludes || []).map((term) => notLike(partsTable.txt, `%${term}%`)),
	];

	let all = await db.select().from(partsTable);
	console.table(all);

	if (q.nested) {
		let idFilter = [
			isNotNull(partsTable.ms),
			...(q.useRpc
				? [
						isNotNull(partsTable.by_ms),
						or(...(q.inMssInclude || []).map((ms) => eq(partsTable.in_ms, ms!))),
					]
				: []),
		];

		let priorityLevelsToRootPostIds = await db
			.select()
			.from(partsTable)
			.where(
				and(
					(q.oldestFirst ? gte : lte)(partsTable.ms, q.fromMs),
					isNotNull(partsTable.to_ms),
					...(q.useRpc ? [isNotNull(partsTable.to_by_ms), isNotNull(partsTable.to_in_ms)] : []),
					...idFilter,
					eq(partsTable.code, partCodes.postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId),
					isNull(partsTable.txt),
					isNotNull(partsTable.num),
				),
			)
			.orderBy((q.oldestFirst ? asc : desc)(partsTable.ms))
			.limit(rootPostsPerLoad);
		postIds = priorityLevelsToRootPostIds.map((part) => getToId(part)!);

		let allPostIdToRootPostIds = [
			// ...priorityLevelsToRootPostIds.map(
			// 	(segs) =>
			// 		({
			// 			ms: segs.ms,
			// 			by_ms: segs.by_ms,
			// 			in_ms: segs.in_ms,
			// 		}) as PartInsert,
			// ),
			...(await db
				.select()
				.from(partsTable)
				.where(
					and(
						or(...priorityLevelsToRootPostIds.map((segs) => filterToIdSegs(segs))),
						...idFilter,
						eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				)),
		];

		let postPartsAndSubParts = await db
			.select()
			.from(partsTable)
			.where(
				or(
					and(
						...idFilter,
						or(
							and(
								or(...allPostIdToRootPostIds.map((segs) => filterIdSegs(segs))),
								eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
								isNull(partsTable.txt),
							),
						),
					),
					and(
						or(...allPostIdToRootPostIds.map((segs) => filterIdSegsAsToIdSegs(segs))),
						or(
							...[
								partCodes.currentPostTagIdWithNumAsVersionToPostId,
								partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId,
								// partCodes.numAsReplyCountToPostId,
								// partCodes.numAsCiteCountToPostId,
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
			if (part.code === partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId) {
				let tagId = getId(part);
				if (!tagIdsSet.has(tagId)) {
					tagIdsSet.add(tagId);
					currentTagIdRows.push(part);
				}
			}
			if (part.code === partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId) {
				currentBodyRows.push(part);
			}
		}

		let versionMsAndTagRows = await db
			.select()
			.from(partsTable)
			.where(
				or(
					and(
						or(...currentTagIdRows.map((row) => filterIdSegs(row))),
						isNull(partsTable.to_ms),
						isNull(partsTable.to_by_ms),
						isNull(partsTable.to_in_ms),
						eq(partsTable.code, partCodes.txtAsTagAndNumAsCount),
						isNotNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
					and(
						or(...currentBodyRows.map((row) => filterToIdSegs(row))),
						isNotNull(partsTable.ms),
						isNull(partsTable.by_ms),
						isNull(partsTable.in_ms),
						eq(partsTable.code, partCodes.msWithNumAsVersionToPostId),
						isNull(partsTable.txt),
						isNotNull(partsTable.num),
					),
				),
			);

		let parts = [...postPartsAndSubParts, ...versionMsAndTagRows];
		// console.table(parts);
		let tagIdToTxtMap: Record<string, string> = {};
		let addPostToMapIfDne = (id: string) => (postMap[id] = postMap[id] || { history: {} });

		for (let i = 0; i < parts.length; i++) {
			let part = parts[i];
			let toId: undefined | string;
			if (
				part.code === partCodes.postIdWithNumAsLastVersionToParentPostId ||
				part.code === partCodes.postIdWithNumAsLastVersionToParentPostId ||
				part.code === partCodes.postIdWithNumAsLastVersionToParentPostId
			) {
				let id = getId(part);
				addPostToMapIfDne(id);
				postMap[id] = {
					...postMap[id],
					to_ms: part.to_ms,
					to_by_ms: part.to_by_ms,
					to_in_ms: part.to_in_ms,
					ms: part.ms,
					by_ms: part.by_ms,
					in_ms: part.in_ms,
				};
			} else {
				toId = getToId(part);
				toId && addPostToMapIfDne(toId);
			}

			// if (part.code === partCodes.postIdWithNumAsDepthToRootPostId) {}

			// if (part.code === partCodes.numAsCiteCountToPostId) {
			// 	let id = getToId(part)!;
			// 	addPostToMapIfDne(id);
			// 	postMap[id].citeCount = part.num;
			// }
			// if (part.code === partCodes.numAsReplyCountToPostId) {
			// 	postMap[toId!].replyCount = part.num;
			// }

			if (part.code === partCodes.msWithNumAsVersionToPostId) {
				postMap[toId!].history['' + part.num] = {
					...postMap[toId!].history['' + part.num],
					ms: part.ms!,
				};
			}

			if (part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId) {
				let id = getId(part);
				postTagsMap[toId!] = [id, ...(postTagsMap[toId!] || [])];
				postMap[toId!].history['' + part.num] = {
					...postMap[toId!].history['' + part.num],
					tags: postTagsMap[toId!],
				};
			}
			if (part.code === partCodes.txtAsTagAndNumAsCount) {
				let id = getId(part);
				tagIdToTxtMap[id] = part.txt!;
			}
			if (part.code === partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId) {
				postMap[toId!].history['' + part.num] = {
					...postMap[toId!].history['' + part.num],
					body: part.txt!,
				};
			}
		}
		// console.log('postMap:', postMap);
		let postTagsMapKeys = Object.keys(postTagsMap);
		for (let keyI = 0; keyI < postTagsMapKeys.length; keyI++) {
			let postTags = postTagsMap[postTagsMapKeys[keyI]];
			for (let i = 0; i < postTags.length; i++) {
				postTags[i] = tagIdToTxtMap[postTags[i]];
			}
			// postTags.sort();
		}
	} else {
		// rootPosts = await db
		// 	.select()
		// 	.from(partsTable)
		// 	.where(and(...rootConditions))
		// 	.orderBy((q.oldestFirst ? asc : desc)(partsTable.ms))
		// 	.limit(rootPostsPerLoad);
		// // TODO: I shouldn't have to add a bang to r.to_id!. TypeScript bug? Don't want to use typeof i==='string' in filter
		// toIds = rootPosts.map((r) => r.to_id!).filter((i) => !!i);
		// citedIds = rootPosts.flatMap((r) =>
		// 	[...(r.txt || '').matchAll(idsRegex)].map((m) => m[0].trim()).filter((i) => !!i),
		// );
		// getCitedPostIds
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

	console.log('postMap:', postMap);
	console.log('postIds:', postIds);
	return { postIds, postMap };
};
