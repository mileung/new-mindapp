import { trpc } from '$lib/trpc/client';
import { and, eq, or } from 'drizzle-orm';
import { bumpTagCountsBy1, getLastVersion, normalizeTags, PostSchema, type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, type PartInsert, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getIdStr, zeros } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let editPost = async (post: Post, useRpc: boolean) => {
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) throw new Error(`Invalid post`);
	return useRpc
		? trpc().editPost.mutate(parsedPost.data)
		: _editPost(await gsdb(), parsedPost.data);
};

export let _editPost = async (db: Database, post: Post) => {
	let newLastVersion = getLastVersion(post);
	if (newLastVersion === null) throw new Error(`Cannot edit deleted posts`);
	if (newLastVersion <= 0) throw new Error('newLastVersion must be gt0');
	if (post.in_ms > 0 && !post.by_ms) throw new Error('Invalid by_ms');
	if (!post.ms) throw new Error('Missing ms');
	let currentLastVersion = newLastVersion - 1;

	let postPartFilter = and(
		pt.atId(post),
		pt.id(post),
		pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
		pt.txt.isNull,
		pt.num.isNotNull,
	);

	let currentPostPartAndSubParts = await db
		.select()
		.from(pTable)
		.where(
			or(
				postPartFilter,
				and(
					pt.idAsAtId(post),
					or(
						...[
							pc.currentPostTagIdWithNumAsVersionAtPostId,
							pc.currentPostCoreIdWithNumAsVersionAtPostId,
						].map((code) => pt.code.eq(code)),
					),
					eq(pTable.num, currentLastVersion),
				),
			),
		);
	let postPartRows: PartSelect[] = [];
	let currentTagIdRows: PartSelect[] = [];
	let currentPostCoreRows: PartSelect[] = [];
	for (let i = 0; i < currentPostPartAndSubParts.length; i++) {
		let part = currentPostPartAndSubParts[i];
		if (part.code === pc.currentPostTagIdWithNumAsVersionAtPostId) {
			if (part.ms) {
				currentTagIdRows.push(part);
			}
		} else if (part.code === pc.currentPostCoreIdWithNumAsVersionAtPostId) {
			currentPostCoreRows.push(part);
		} else if (part.code === pc.postIdWithNumAsLastVersionAtParentPostId) {
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

	let tagTxtRows =
		currentTagIdRows.length || newPostTags.length
			? await db
					.select()
					.from(pTable)
					.where(
						and(
							pt.at_ms.eq0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							pt.ms.gt0,
							pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
							or(...currentTagIdRows.map((r) => pt.id(r)), ...newPostTags.map((t) => pt.txt.eq(t))),
							pt.num.isNotNull,
						),
					)
			: [];

	let tagTxtToRowMap: Record<string, undefined | PartInsert> = {};
	let tagIdToTxtMap: Record<string, string> = {};
	for (let i = 0; i < tagTxtRows.length; i++) {
		let tagTxtRow = tagTxtRows[i];
		tagTxtToRowMap[tagTxtRow.txt!] = tagTxtRow;
		tagIdToTxtMap[getIdStr(tagTxtRow)] = tagTxtRow.txt!;
	}

	let tagTxtRowsToIncrementCountBy1: PartInsert[] = [];
	let newTagsCount = 0;
	for (let i = 0; i < newPostTags.length; i++) {
		let tag = newPostTags[i];
		let tagTxtRow = tagTxtToRowMap[tag];
		if (tagTxtRow) {
			if (
				!currentTagIdRows.find(
					(r) =>
						r.ms === tagTxtRow!.ms && //
						r.by_ms === tagTxtRow!.by_ms &&
						r.in_ms === tagTxtRow!.in_ms,
				)
			) {
				tagTxtRowsToIncrementCountBy1.push(tagTxtRow);
			}
		} else {
			tagTxtRow = {
				...zeros,
				ms: ms + newTagsCount++,
				by_ms: post.by_ms, // TODO: Multiple tagTxtRows can share the same id if the same user in the same space adds a lot (hundreds+) of the same tags at the same time. How to deal with this? Ok to ignore as this is unusual behavior and shouldn't break anything - just posts will have duplicate tags. Could bump tagTxtRow ms bxy randomInt but idk
				in_ms: post.in_ms,
				code: pc.tagIdAndTxtWithNumAsCount,
				txt: tag,
				num: 1,
			};
			partsToInsert.push(tagTxtRow);
		}
		partsToInsert.push({
			at_ms: postPart.ms,
			at_by_ms: postPart.by_ms,
			at_in_ms: postPart.in_ms,
			ms: tagTxtRow.ms,
			by_ms: tagTxtRow.by_ms,
			in_ms: tagTxtRow.in_ms,
			code: pc.currentPostTagIdWithNumAsVersionAtPostId,
			num: newLastVersion,
		});
	}

	!newPostTags.length &&
		partsToInsert.push({
			...zeros,
			at_ms: postPart.ms,
			at_by_ms: postPart.by_ms,
			at_in_ms: postPart.in_ms,
			code: pc.currentPostTagIdWithNumAsVersionAtPostId,
			num: newLastVersion,
		});

	let currentPostTags = currentTagIdRows.map((r) => tagIdToTxtMap[getIdStr(r)]);
	let removedTags = currentPostTags.filter((t) => !newPostTags.includes(t));

	let tagsChanged =
		!!newTagsCount || !!tagTxtRowsToIncrementCountBy1.length || !!removedTags.length;
	let currentPostCoreRow = assert1Row(currentPostCoreRows);
	let newPostCore = (post.history![newLastVersion]!.core || '').trim();
	let coreChanged = currentPostCoreRow?.txt !== newPostCore;

	if (!tagsChanged && !coreChanged) throw new Error(`No edit detected`);

	await bumpTagCountsBy1(db, tagTxtRowsToIncrementCountBy1);

	await db
		.update(pTable)
		.set({ code: pc.exPostTagIdWithNumAsVersionAtPostId })
		.where(
			and(
				pt.idAsAtId(postPart),
				pt.code.eq(pc.currentPostTagIdWithNumAsVersionAtPostId),
				pt.txt.isNull,
				eq(pTable.num, currentLastVersion),
			),
		);

	await db
		.update(pTable)
		.set({ code: pc.exPostCoreIdWithNumAsVersionAtPostId })
		.where(
			and(
				pt.idAsAtId(postPart),
				pt.code.eq(pc.currentPostCoreIdWithNumAsVersionAtPostId),
				eq(pTable.num, currentLastVersion),
			),
		);

	partsToInsert.push({
		...zeros,
		at_ms: postPart.ms,
		at_by_ms: postPart.by_ms,
		at_in_ms: postPart.in_ms,
		ms,
		code: pc.currentPostCoreIdWithNumAsVersionAtPostId,
		txt: newPostCore,
		num: newLastVersion,
	});

	await db.update(pTable).set({ num: newLastVersion }).where(postPartFilter);
	await db.insert(pTable).values(partsToInsert);

	if (removedTags.length) {
		let tagTxtRowsToDecrementCountBy1: PartInsert[] = [];
		for (let i = 0; i < removedTags.length; i++) {
			let tag = removedTags[i];
			let tagTxtRow = tagTxtToRowMap[tag];
			if (tagTxtRow) {
				tagTxtRowsToDecrementCountBy1.push(tagTxtRow);
			}
		}
		await bumpTagCountsBy1(db, tagTxtRowsToDecrementCountBy1, false);
	}

	return { ms };
};
