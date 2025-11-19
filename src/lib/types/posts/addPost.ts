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
	getSplitId,
	filterSplitId,
	filterSplitIdAsToSplitId,
	filterToSplitId,
	getToId,
	filterToSplitIdAsSplitId,
	assertLt2Rows,
} from '../parts';
import { getCitedPostIds, bumpTagCountsBy1, normalizeTags, type Post } from '.';

export let addPost = async (post: Post, useRpc: boolean) => {
	return useRpc ? trpc().addPost.mutate(post) : _addPost(await gsdb(), post);
};

export let _addPost = async (db: Database, post: Post) => {
	if (!post.history || Object.keys(post.history).length !== 1 || !post.history['0'])
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

	let partsToInsert: PartInsert[] = [postPart];
	let isChildPost = hasParent(post);

	if (isChildPost) {
		let parentPostIdToRootPostIdRows = await db
			.select()
			.from(partsTable)
			.where(
				and(
					filterToSplitIdAsSplitId(postPart),
					eq(partsTable.code, partCodes.postIdWithNumAsDepthToRootPostId),
					isNull(partsTable.txt),
					isNotNull(partsTable.num),
				),
			);
		let parentPostIdToRootPostIdRow = assertLt2Rows(parentPostIdToRootPostIdRows);
		let rootPostSplitId = parentPostIdToRootPostIdRow
			? {
					to_ms: parentPostIdToRootPostIdRow.to_ms,
					to_by_ms: parentPostIdToRootPostIdRow.to_by_ms,
					to_in_ms: parentPostIdToRootPostIdRow.to_in_ms,
				}
			: {
					to_ms: postPart.to_ms,
					to_by_ms: postPart.to_by_ms,
					to_in_ms: postPart.to_in_ms,
				};
		partsToInsert.push({
			...rootPostSplitId,
			ms,
			by_ms: postPart.by_ms,
			in_ms: postPart.in_ms,
			code: partCodes.postIdWithNumAsDepthToRootPostId,
			txt: null,
			num: (parentPostIdToRootPostIdRow?.num || 0) + 1,
		});
		let updatedPriorityLevelRows = await db
			.update(partsTable)
			.set({
				ms,
				by_ms: postPart.by_ms,
				in_ms: postPart.in_ms,
				num: ms,
			})
			.where(
				and(
					filterToSplitId(parentPostIdToRootPostIdRow || postPart),
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
		if (!updatedPriorityLevelRows?.length) {
			partsToInsert.push({
				...rootPostSplitId,
				ms,
				by_ms: postPart.by_ms,
				in_ms: postPart.in_ms,
				code: partCodes.postIdWithNumAsNestedUpdatesFeedPriorityToRootPostId,
				txt: null,
				num: ms,
			});
		}
	} else {
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
	}
	let postTags = normalizeTags(post.history['0'].tags || []);
	let existingTagTxtRows: PartSelect[] = [];
	if (postTags.length) {
		let existingTagTxtRows = await db
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
					eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
					or(...postTags.map((t) => eq(partsTable.txt, t))),
					isNotNull(partsTable.num),
				),
			);

		let existingTagTxtRowsDict: Record<string, PartInsert> = {};
		for (let i = 0; i < existingTagTxtRows.length; i++) {
			let tagRow = existingTagTxtRows[i];
			existingTagTxtRowsDict[tagRow.txt!] = tagRow;
		}
		for (let i = 0; i < postTags.length; i++) {
			let tag = postTags[i];
			let tagRow = existingTagTxtRowsDict[tag];
			let newTagsCount = 0;
			if (!tagRow) {
				tagRow = {
					to_ms: null,
					to_by_ms: null,
					to_in_ms: null,
					ms: ms + newTagsCount++,
					by_ms: post.by_ms,
					in_ms: post.in_ms,
					code: partCodes.tagTxtAndNumAsCount,
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
				code: partCodes.currentPostTagIdWithNumAsVersionToPostId,
				num: 0,
			});
		}
	} else {
		partsToInsert.push({
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms: null,
			by_ms: null,
			in_ms: null,
			code: partCodes.currentPostTagIdWithNumAsVersionToPostId,
			num: 0,
		});
	}

	let bodyTxt = (post.history['0'].body || '').trim();
	let citedPostIds: string[] = bodyTxt ? getCitedPostIds(bodyTxt) : [];
	// TODO: return citedPostMap to cover cases where user cites a post their feed hasn't fetched
	partsToInsert.push(
		{
			to_ms: ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms,
			by_ms: null,
			in_ms: null,
			code: partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId,
			txt: bodyTxt,
			num: 0,
		},
		...citedPostIds.map((id) => {
			let splitId = getSplitId(id);
			return {
				to_ms: splitId.ms,
				to_by_ms: splitId.by_ms,
				to_in_ms: splitId.in_ms,
				ms,
				by_ms: postPart.by_ms,
				in_ms: postPart.in_ms,
				code: partCodes.postIdToCitedPostId,
				txt: null,
				num: null,
			};
		}),
	);

	bumpTagCountsBy1(db, existingTagTxtRows);

	await db.insert(partsTable).values(partsToInsert);
	// console.log('partsToInsert:', partsToInsert);
	return { ms };
};
