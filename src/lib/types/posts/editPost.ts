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
import { bumpTagCountsBy1, getLastVersion, normalizeTags, type Post } from '.';

export let editPost = async (post: Post, useRpc: boolean) => {
	return useRpc ? trpc().editPost.mutate(post) : _editPost(await gsdb(), post);
};

export let _editPost = async (db: Database, post: Post) => {
	let newLastVersion = getLastVersion(post);
	if (newLastVersion === null) throw new Error(`Cannot edit deleted posts`);
	if (newLastVersion <= 0) throw new Error('newLastVersion must be gt0');
	if (Number.isInteger(post.in_ms) && !post.by_ms) throw new Error('Missing by_ms');
	if (!post.ms) throw new Error('Missing ms');
	let currentLastVersion = newLastVersion - 1;

	let postPartFilter = and(
		filterToSplitId(post),
		filterSplitId(post),
		eq(partsTable.code, partCodes.postIdWithNumAsLastVersionToParentPostId),
		isNull(partsTable.txt),
		isNotNull(partsTable.num),
	);

	let currentPostPartAndSubParts = await db
		.select()
		.from(partsTable)
		.where(
			or(
				postPartFilter,
				and(
					filterSplitIdAsToSplitId(post),
					or(
						...[
							partCodes.currentPostTagIdWithNumAsVersionToPostId,
							partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId,
						].map((code) => eq(partsTable.code, code)),
					),
					eq(partsTable.num, currentLastVersion),
				),
			),
		);
	let postPartRows: PartSelect[] = [];
	let currentTagIdRows: PartSelect[] = [];
	let currentPostBodyRows: PartSelect[] = [];
	for (let i = 0; i < currentPostPartAndSubParts.length; i++) {
		let part = currentPostPartAndSubParts[i];
		if (part.code === partCodes.currentPostTagIdWithNumAsVersionToPostId) {
			if (part.ms !== null) {
				currentTagIdRows.push(part);
			}
		} else if (part.code === partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId) {
			currentPostBodyRows.push(part);
		} else if (part.code === partCodes.postIdWithNumAsLastVersionToParentPostId) {
			postPartRows.push(part);
		}
	}

	let postPart = assert1Row(postPartRows);
	if (postPart.num === null) throw new Error('Cannot edit deleted posts');
	// TODO: what do if trying to edit post in cloud space from local space
	// and the last versions don't match?
	if (postPart.num !== currentLastVersion) throw new Error(`Invalid newLastVersion`);
	let ms = Date.now();
	let partsToInsert: PartInsert[] = [];

	let newPostTags = normalizeTags(post.history![newLastVersion]!.tags || []);

	let existingTagTxtRows =
		currentTagIdRows.length || newPostTags.length
			? await db
					.select()
					.from(partsTable)
					.where(
						and(
							isNull(partsTable.to_ms),
							isNull(partsTable.to_by_ms),
							isNull(partsTable.to_in_ms),
							isNotNull(partsTable.ms),
							eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
							or(
								...currentTagIdRows.map((r) => filterSplitId(r)),
								...newPostTags.map((t) => eq(partsTable.txt, t)),
							),
							isNotNull(partsTable.num),
						),
					)
			: [];

	let existingTagTxtRowsDict: Record<string, undefined | PartInsert> = {};
	let existingTagIdToTxtDict: Record<string, string> = {};
	for (let i = 0; i < existingTagTxtRows.length; i++) {
		let tagTxtRow = existingTagTxtRows[i];
		existingTagTxtRowsDict[tagTxtRow.txt!] = tagTxtRow;
		existingTagIdToTxtDict[getId(tagTxtRow)] = tagTxtRow.txt!;
	}

	let tagTxtRowsToIncrementCountBy1: PartInsert[] = [];
	for (let i = 0; i < newPostTags.length; i++) {
		let tag = newPostTags[i];
		let tagTxtRow = existingTagTxtRowsDict[tag];
		let newTagsCount = 0;
		if (tagTxtRow) {
			tagTxtRowsToIncrementCountBy1.push(tagTxtRow);
		} else {
			tagTxtRow = {
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
			partsToInsert.push(tagTxtRow);
		}
		partsToInsert.push({
			to_ms: postPart.ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms: tagTxtRow.ms,
			by_ms: tagTxtRow.by_ms,
			in_ms: tagTxtRow.in_ms,
			code: partCodes.currentPostTagIdWithNumAsVersionToPostId,
			num: newLastVersion,
		});
	}

	bumpTagCountsBy1(db, tagTxtRowsToIncrementCountBy1);

	!newPostTags.length &&
		partsToInsert.push({
			to_ms: postPart.ms,
			to_by_ms: postPart.by_ms,
			to_in_ms: postPart.in_ms,
			ms: null,
			by_ms: null,
			in_ms: null,
			code: partCodes.currentPostTagIdWithNumAsVersionToPostId,
			txt: null,
			num: newLastVersion,
		});

	let currentPostTags = currentTagIdRows.map((r) => existingTagIdToTxtDict[getId(r)]);
	let removedTags = currentPostTags.filter((t) => !newPostTags.includes(t));

	if (removedTags.length) {
		let tagTxtRowsToDelete: PartInsert[] = [];
		let tagTxtRowsToDecrementCountBy1: PartInsert[] = [];

		for (let i = 0; i < removedTags.length; i++) {
			let tag = removedTags[i];
			let tagTxtRow = existingTagTxtRowsDict[tag];
			if (tagTxtRow) {
				if (tagTxtRow.num === 1) {
					tagTxtRowsToDelete.push(tagTxtRow);
				} else if (tagTxtRow.num! > 1) {
					tagTxtRowsToDecrementCountBy1.push(tagTxtRow);
				}
			}
		}
		if (tagTxtRowsToDelete.length) {
			await db.delete(partsTable).where(
				and(
					isNull(partsTable.to_ms),
					isNull(partsTable.to_by_ms),
					isNull(partsTable.to_in_ms),
					or(
						...tagTxtRowsToDelete.map((r) =>
							and(
								filterSplitId(r), //
								eq(partsTable.txt, r.txt!),
							),
						),
					),
					eq(partsTable.code, partCodes.tagTxtAndNumAsCount),
					eq(partsTable.num, 1),
				),
			);
		}
		bumpTagCountsBy1(db, tagTxtRowsToDecrementCountBy1, false);
	}

	let tagsChanged =
		currentTagIdRows.length !== newPostTags.length ||
		!currentTagIdRows.every(
			(currentTagIdRow) =>
				!!existingTagTxtRows.find(
					(newPostTagTxtRow) =>
						currentTagIdRow.ms === newPostTagTxtRow.ms &&
						currentTagIdRow.by_ms === newPostTagTxtRow.by_ms &&
						currentTagIdRow.in_ms === newPostTagTxtRow.in_ms,
				),
		);

	let currentPostBodyRow = assert1Row(currentPostBodyRows);
	let newPostBody = (post.history![newLastVersion]!.body || '').trim();
	let bodyChanged = currentPostBodyRow?.txt !== newPostBody;

	if (!tagsChanged && !bodyChanged) throw new Error(`No edit detected`);

	await db
		.update(partsTable)
		.set({ code: partCodes.exPostTagIdWithNumAsVersionToPostId })
		.where(
			and(
				filterSplitIdAsToSplitId(postPart),
				eq(partsTable.code, partCodes.currentPostTagIdWithNumAsVersionToPostId),
				isNull(partsTable.txt),
				eq(partsTable.num, currentLastVersion),
			),
		);
	await db
		.update(partsTable)
		.set({ code: partCodes.exPostBodyTxtWithMsAndNumAsVersionToPostId })
		.where(
			and(
				filterSplitIdAsToSplitId(postPart),
				eq(partsTable.code, partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId),
				eq(partsTable.num, currentLastVersion),
			),
		);

	partsToInsert.push({
		to_ms: postPart.ms,
		to_by_ms: postPart.by_ms,
		to_in_ms: postPart.in_ms,
		ms,
		by_ms: null,
		in_ms: null,
		code: partCodes.currentPostBodyTxtWithMsAndNumAsVersionToPostId,
		txt: newPostBody,
		num: newLastVersion,
	});

	await db.update(partsTable).set({ num: newLastVersion }).where(postPartFilter);
	await db.insert(partsTable).values(partsToInsert);

	return { ms };
};
