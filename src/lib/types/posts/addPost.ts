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
import { getCitedPostIds, normalizeTags, type Post } from '.';

export let addPost = async (post: Post, useRpc: boolean) => {
	return useRpc ? trpc().addPost.mutate(post) : _addPost(await gsdb(), post);
};

export let _addPost = async (db: Database, post: Post) => {
	if (Object.keys(post.history).length !== 1 || !post.history['0'])
		throw new Error('History must have only version 0');
	if (Number.isInteger(post.in_ms) && !post.by_ms) throw new Error('Missing by_ms');
	let ms = Date.now();
	post.ms = ms;

	let postPart: PartInsert = {
		to_ms: post.to_ms,
		to_by_ms: post.to_by_ms,
		to_in_ms: post.to_in_ms,
		ms,
		by_ms: post.by_ms,
		in_ms: post.in_ms,
		code: partCodes.postIdWithNumAsLastVersionToParentPostId,
		txt: null,
		num: 0,
	};

	let partsToInsert: PartInsert[] = [
		postPart,
		{
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms,
			by_ms: null,
			in_ms: null,
			code: partCodes.msWithNumAsVersionToPostId,
			txt: null,
			num: 0,
		},
		// ...[partCodes.numAsReplyCountToPostId, partCodes.numAsCiteCountToPostId].map((code) => ({
		// 	to_ms: ms,
		// 	to_by_ms: postPart.by_ms,
		// 	to_in_ms: postPart.in_ms,
		// 	ms: null,
		// 	by_ms: null,
		// 	in_ms: null,
		// 	code,
		// 	txt: null,
		// 	num: 0,
		// })),
	];

	let isChild = hasParent(post);
	let insertPriorityLevel = !isChild;
	let postTags = normalizeTags(post.history['0'].tags || []);

	if (isChild) {
		if (post.in_ms !== post.to_in_ms) throw new Error(`in_ms must match to_in_ms`);
		let parentPostIdToRootIdRows = await db
			.select()
			.from(partsTable)
			.where(
				and(
					filterToIdSegsAsIdSegs(postPart),
					eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
					isNull(partsTable.txt),
					isNotNull(partsTable.num),
				),
			);
		let postIdToRootIdRow = assert1Row(parentPostIdToRootIdRows);
		partsToInsert.push({
			to_ms: postIdToRootIdRow.to_ms,
			to_by_ms: postIdToRootIdRow.to_by_ms,
			to_in_ms: postIdToRootIdRow.to_in_ms,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.postIdWithNumAsDepthToRootPostId,
			txt: null,
			num: postIdToRootIdRow.num! + 1,
		});

		let updatedPriorityLevelRow = await db
			.update(partsTable)
			.set({
				ms,
				by_ms: postPart.by_ms,
				in_ms: postPart.in_ms,
				num: ms,
			})
			.where(
				and(
					filterToIdSegs(postIdToRootIdRow),
					isNotNull(partsTable.ms),
					postPart.in_ms === null || postPart.in_ms === undefined
						? isNull(partsTable.in_ms)
						: eq(partsTable.in_ms, postPart.in_ms),
					eq(partsTable.code, partCodes.postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId),
					isNull(partsTable.txt),
					isNotNull(partsTable.num),
				),
			)
			.returning();

		insertPriorityLevel = !updatedPriorityLevelRow.length;
	} else {
		partsToInsert.push({
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.postIdWithNumAsDepthToRootPostId,
			txt: null,
			num: 0,
		});
	}

	insertPriorityLevel &&
		partsToInsert.push({
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId,
			txt: null,
			num: ms,
		});

	let existingTagRows: PartSelect[] = [];
	if (postTags.length) {
		let existingTagRows = await db
			.select()
			.from(partsTable)
			.where(
				and(
					isNull(partsTable.to_ms),
					isNull(partsTable.to_by_ms),
					isNull(partsTable.to_in_ms),
					post.in_ms === null || post.in_ms === undefined
						? isNull(partsTable.in_ms)
						: eq(partsTable.in_ms, post.in_ms),
					eq(partsTable.code, partCodes.txtAsTagAndNumAsCount),
					or(...postTags.map((t) => eq(partsTable.txt, t))),
					isNotNull(partsTable.num),
				),
			);

		let existingTagsDict: Record<string, PartInsert> = {};
		for (let i = 0; i < existingTagRows.length; i++) {
			let tagRow = existingTagRows[i];
			existingTagsDict[tagRow.txt!] = tagRow;
		}

		for (let i = 0; i < postTags.length; i++) {
			let tag = postTags[i];
			let tagRow = existingTagsDict[tag];
			console.log('tagRow:', tag, tagRow);
			let newTagsCount = 0;
			if (!tagRow) {
				tagRow = {
					to_ms: null,
					to_by_ms: null,
					to_in_ms: null,
					ms: ms + newTagsCount++,
					by_ms: post.by_ms,
					in_ms: post.in_ms,
					code: partCodes.txtAsTagAndNumAsCount,
					txt: tag,
					num: 1,
				};
				partsToInsert.push(tagRow);
			}
			partsToInsert.push({
				to_ms: ms,
				to_by_ms: postPart.by_ms,
				to_in_ms: postPart.in_ms,
				ms: tagRow.ms,
				by_ms: tagRow.by_ms,
				in_ms: tagRow.in_ms,
				code: partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId,
				num: 0,
			});
		}
	}

	let bodyTxt = post.history['0'].body;

	let citedPostIds: string[] = [];
	if (bodyTxt) {
		citedPostIds = getCitedPostIds(bodyTxt);
		// TODO: return citedPostMap to cover cases where user cites a post their feed hasn't fetched
		partsToInsert.push({
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.currentPostTxtAsBodyWithNumAsVersionToPostId,
			txt: bodyTxt,
			num: 0,
		} satisfies PartInsert);
	}

	console.log('citedPostIds:', citedPostIds);
	console.log('existingTagRows:', existingTagRows);
	let citedPostIdSegs = citedPostIds.map((id) => splitId(id));
	partsToInsert.push(
		...citedPostIdSegs.map((segs) => ({
			to_ms: segs.ms,
			to_by_ms: segs.by_ms,
			to_in_ms: segs.in_ms,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.postIdToCitedPostId,
			txt: null,
			num: null,
		})),
	);

	existingTagRows.length &&
		(await db
			.update(partsTable)
			.set({ num: sql`${partsTable.num} + 1` })
			.where(
				and(
					isNull(partsTable.to_ms),
					isNull(partsTable.to_by_ms),
					isNull(partsTable.to_in_ms),
					or(
						...existingTagRows.map((tagRow) =>
							and(filterIdSegs(tagRow), eq(partsTable.txt, tagRow.txt!)),
						),
					),
					eq(partsTable.code, partCodes.txtAsTagAndNumAsCount),
					isNotNull(partsTable.num),
				),
			));

	// await db
	// 	.update(partsTable)
	// 	.set({ num: sql`${partsTable.num} + 1` })
	// 	.where(
	// 		or(
	// 			existingTagRows.length
	// 				? and(
	// 						isNull(partsTable.to_ms),
	// 						isNull(partsTable.to_by_ms),
	// 						isNull(partsTable.to_in_ms),
	// 						or(
	// 							...existingTagRows.map((tagRow) =>
	// 								and(filterIdSegs(tagRow), eq(partsTable.txt, tagRow.txt!)),
	// 							),
	// 						),
	// 						eq(partsTable.code, partCodes.txtAsTagAndNumAsCount),
	// 						isNotNull(partsTable.num),
	// 					)
	// 				: undefined,
	// 			citedPostIdSegs.length
	// 				? and(
	// 						or(...citedPostIdSegs.map((segs) => filterIdSegsAsToIdSegs(segs))),
	// 						isNull(partsTable.ms),
	// 						isNull(partsTable.by_ms),
	// 						isNull(partsTable.in_ms),
	// 						eq(partsTable.code, partCodes.numAsCiteCountToPostId),
	// 						isNull(partsTable.txt),
	// 						isNotNull(partsTable.num),
	// 					)
	// 				: undefined,
	// 			and(
	// 				filterToIdSegs(postPart),
	// 				isNull(partsTable.ms),
	// 				isNull(partsTable.by_ms),
	// 				isNull(partsTable.in_ms),
	// 				eq(partsTable.code, partCodes.numAsReplyCountToPostId),
	// 				isNull(partsTable.txt),
	// 				isNotNull(partsTable.num),
	// 			),
	// 		),
	// 	);

	await db.insert(partsTable).values(partsToInsert);
	// console.log('partsToInsert:', partsToInsert);
	return { ms };
};
