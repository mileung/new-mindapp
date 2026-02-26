import { ranInt } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, eq, or } from 'drizzle-orm';
import { getLastVersion, moveTagCoreOrRxnCountsBy1, PostSchema, type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	getWhoWhereObj,
	idObjMatchesIdObj,
	type PartInsert,
	type PartSelect,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getIdObjAsAtIdObj, getIdStr, id0, type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let editPost = async (post: Post, forceUsingLocalDb?: boolean) => {
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) {
		console.log(String(JSON.stringify(parsedPost.error.issues, null, 2)));
		throw new Error(`Invalid post`);
	}
	let baseInput = await getWhoWhereObj();
	return forceUsingLocalDb || !baseInput.spaceMs
		? _editPost(await gsdb(), parsedPost.data)
		: trpc().editPost.mutate({ ...baseInput, post: parsedPost.data });
};

export let _editPost = async (db: Database, post: Post) => {
	let newLastVersion = getLastVersion(post);
	if (!newLastVersion) throw new Error(`Cannot edit deleted posts`);
	if (newLastVersion <= 0) throw new Error('newLastVersion must be gt0');
	let curLastVersion = newLastVersion - 1;

	let mainPIdWNumAsLastVersionAtPPIdRowsFilter = and(
		pf.atId(post),
		pf.id(post),
		pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
		pf.num.gte0,
		pf.txt.isNull,
	);

	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.currentPostTagIdWithVersionNumAtPostId]: curPostTagIdWNumAsVrsnAtPIdRows = [],
		[pc.currentPostCoreIdWithVersionNumAtPostId]: curPostCoreIdWNumAsVrsnAtPIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					mainPIdWNumAsLastVersionAtPPIdRowsFilter,
					and(
						pf.idAsAtId(post),
						or(
							...[
								pc.currentPostTagIdWithVersionNumAtPostId,
								pc.currentPostCoreIdWithVersionNumAtPostId,
							].map((code) => pf.code.eq(code)),
						),
						eq(pTable.num, curLastVersion),
					),
				),
			),
	);

	let mainPIdWNumAsLastVersionAtPPIdRow = assert1Row(postIdWNumAsLastVersionAtPPostIdRows);
	if (!mainPIdWNumAsLastVersionAtPPIdRow.num) throw new Error('Cannot edit deleted posts');
	// TODO: what do if trying to edit post in cloud space from local space
	// and the last versions don't match?
	if (mainPIdWNumAsLastVersionAtPPIdRow.num > curLastVersion)
		throw new Error(`Post edit history out of sync`);
	if (mainPIdWNumAsLastVersionAtPPIdRow.num !== curLastVersion)
		throw new Error(`Invalid newLastVersion`);

	let ms = Date.now();
	let partsToInsert: PartInsert[] = [
		{
			...id0,
			...getIdObjAsAtIdObj(post),
			ms,
			code: pc.currentVersionNumMsAtPostId,
			num: newLastVersion,
		},
	];
	let newPostTagStrs = post.history![newLastVersion]!.tags || [];
	let newPostCoreStr = (post.history![newLastVersion]!.core || '').trim();
	assertLt2Rows(curPostCoreIdWNumAsVrsnAtPIdRows);

	let {
		[pc.tagId8AndTxtWithNumAsCount]: existingTagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8AndTxtWithNumAsCount]: existingCoreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		curPostTagIdWNumAsVrsnAtPIdRows.length ||
			newPostTagStrs.length ||
			curPostCoreIdWNumAsVrsnAtPIdRows.length ||
			newPostCoreStr
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								pf.noAtId,
								or(
									...curPostTagIdWNumAsVrsnAtPIdRows.map((r) => pf.id(r)),
									...newPostTagStrs.map((t) => pf.txt.eq(t)),
								),
								pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
								pf.num.gte0,
							),
							and(
								pf.noAtId,
								or(
									...curPostCoreIdWNumAsVrsnAtPIdRows.map((cio) => pf.id(cio)),
									pf.txt.eq(newPostCoreStr),
								),
								pf.code.eq(pc.coreId8AndTxtWithNumAsCount),
								pf.num.gte0,
							),
						),
					)
			: [],
	);

	let {
		txtToTagOrCoreIdAndTxtWNumAsCtObjMap: txtToTagIdAndTxtWNumAsCtObjMap,
		tagOrCoresChanged: tagsChanged,
		tagOrCoreTxtRowsToIncrementCountBy1: tagTxtRowsToIncrementCountBy1,
		removedTagOrCoreStrs: removedTags,
	} = processStuff(
		ms,
		newLastVersion,
		mainPIdWNumAsLastVersionAtPPIdRow,
		newPostTagStrs,
		existingTagIdAndTxtWithNumAsCountRows,
		curPostTagIdWNumAsVrsnAtPIdRows,
		true,
		partsToInsert,
	);

	let {
		txtToTagOrCoreIdAndTxtWNumAsCtObjMap: txtToCoreIdAndTxtWNumAsCtObjMap,
		tagOrCoresChanged: coreChanged,
		tagOrCoreTxtRowsToIncrementCountBy1: coreTxtRowsToIncrementCountBy1,
		removedTagOrCoreStrs: removedCores,
	} = processStuff(
		ms,
		newLastVersion,
		mainPIdWNumAsLastVersionAtPPIdRow,
		newPostCoreStr ? [newPostCoreStr] : [],
		existingCoreIdAndTxtWithNumAsCountRows,
		curPostCoreIdWNumAsVrsnAtPIdRows,
		false,
		partsToInsert,
	);

	if (!tagsChanged && !coreChanged) throw new Error(`No edit detected`);

	await moveTagCoreOrRxnCountsBy1(
		db,
		tagTxtRowsToIncrementCountBy1,
		coreTxtRowsToIncrementCountBy1,
		[],
		true,
	);

	let tagTxtRowsToDecrementCountBy1: PartInsert[] = [];
	for (let i = 0; i < removedTags.length; i++) {
		let tagTxtRow = txtToTagIdAndTxtWNumAsCtObjMap[removedTags[i]];
		if (tagTxtRow) tagTxtRowsToDecrementCountBy1.push(tagTxtRow);
	}
	let coreTxtRowsToDecrementCountBy1: PartInsert[] = [];
	for (let i = 0; i < removedCores.length; i++) {
		let coreTxtRow = txtToCoreIdAndTxtWNumAsCtObjMap[removedCores[i]];
		if (coreTxtRow) coreTxtRowsToDecrementCountBy1.push(coreTxtRow);
	}

	await moveTagCoreOrRxnCountsBy1(
		db,
		tagTxtRowsToDecrementCountBy1,
		coreTxtRowsToDecrementCountBy1,
		[],
		false,
	);
	await db
		.update(pTable)
		.set({ code: pc.exPostTagIdWithVersionNumAtPostId })
		.where(
			and(
				pf.idAsAtId(mainPIdWNumAsLastVersionAtPPIdRow),
				pf.code.eq(pc.currentPostTagIdWithVersionNumAtPostId),
				pf.txt.isNull,
				eq(pTable.num, curLastVersion),
			),
		);
	await db
		.update(pTable)
		.set({ code: pc.exPostCoreIdWithVersionNumAtPostId })
		.where(
			and(
				pf.idAsAtId(mainPIdWNumAsLastVersionAtPPIdRow),
				pf.code.eq(pc.currentPostCoreIdWithVersionNumAtPostId),
				eq(pTable.num, curLastVersion),
			),
		);
	await db
		.update(pTable)
		.set({ num: newLastVersion })
		.where(mainPIdWNumAsLastVersionAtPPIdRowsFilter);
	await db
		.update(pTable)
		.set({ code: pc.exVersionNumMsAtPostId })
		.where(
			and(
				pf.idAsAtId(post),
				pf.ms.gt0,
				pf.by_ms.eq0,
				pf.in_ms.eq0,
				pf.code.eq(pc.currentVersionNumMsAtPostId),
				pf.num.eq(curLastVersion),
				pf.txt.isNull,
			),
		);

	// partsToInsert.push({
	// 	at_ms: mainPIdWNumAsLastVersionAtPPIdObj.ms,
	// 	at_by_ms: mainPIdWNumAsLastVersionAtPPIdObj.by_ms,
	// 	at_in_ms: mainPIdWNumAsLastVersionAtPPIdObj.in_ms,
	// 	...(coreChanged
	// 		? {
	// 				ms,
	// 				by_ms: ranInt(8, 88888888),
	// 				in_ms: mainPIdWNumAsLastVersionAtPPIdObj.in_ms,
	// 			}
	// 		: {
	// 				ms: curPostCoreIdWNumAsVrsnAtPIdObj.ms,
	// 				by_ms: curPostCoreIdWNumAsVrsnAtPIdObj.by_ms,
	// 				in_ms: curPostCoreIdWNumAsVrsnAtPIdObj.in_ms,
	// 			}),
	// 	code: pc.currentPostCoreIdWithNumAsVersionAtPostId,
	// 	txt: newPostCore,
	// 	num: newLastVersion,
	// });

	await db.insert(pTable).values(partsToInsert);

	return { ms };
};

let processStuff = (
	ms: number,
	newLastVersion: number,
	mainPIdWNumAsLastVersionAtPPIdObj: IdObj,
	newPostTagOrCoreStrs: string[],
	existingTagOrCoreTxtRows: PartSelect[],
	curPostTagOrCoreIdWNumAsVersionAtPIdRows: PartSelect[],
	isTag: boolean,
	partsToInsert: PartInsert[],
) => {
	let txtToTagOrCoreIdAndTxtWNumAsCtObjMap: Record<string, undefined | PartInsert> = {};
	let tagIdToTxtMap: Record<string, string> = {};
	for (let i = 0; i < existingTagOrCoreTxtRows.length; i++) {
		let tagIdAndTxtWNumAsCtObj = existingTagOrCoreTxtRows[i];
		txtToTagOrCoreIdAndTxtWNumAsCtObjMap[tagIdAndTxtWNumAsCtObj.txt!] = tagIdAndTxtWNumAsCtObj;
		tagIdToTxtMap[getIdStr(tagIdAndTxtWNumAsCtObj)] = tagIdAndTxtWNumAsCtObj.txt!;
	}
	let tagOrCoreTxtRowsToIncrementCountBy1: PartInsert[] = [];
	let newTagOrCoresCount = 0;
	for (let i = 0; i < newPostTagOrCoreStrs.length; i++) {
		let tag = newPostTagOrCoreStrs[i];
		let tagTxtRow = txtToTagOrCoreIdAndTxtWNumAsCtObjMap[tag];
		if (tagTxtRow) {
			if (
				!curPostTagOrCoreIdWNumAsVersionAtPIdRows.find((curPostTagIdWNumAsVersionAtPIdObj) =>
					idObjMatchesIdObj(curPostTagIdWNumAsVersionAtPIdObj, tagTxtRow!),
				)
			)
				tagOrCoreTxtRowsToIncrementCountBy1.push(tagTxtRow);
		} else {
			tagTxtRow = {
				...id0,
				ms: ms + newTagOrCoresCount++,
				by_ms: ranInt(8, 88888888),
				in_ms: mainPIdWNumAsLastVersionAtPPIdObj.in_ms,
				code: isTag ? pc.tagId8AndTxtWithNumAsCount : pc.coreId8AndTxtWithNumAsCount,
				txt: tag,
				num: 1,
			};
			partsToInsert.push(tagTxtRow);
		}
		partsToInsert.push({
			at_ms: mainPIdWNumAsLastVersionAtPPIdObj.ms,
			at_by_ms: mainPIdWNumAsLastVersionAtPPIdObj.by_ms,
			at_in_ms: mainPIdWNumAsLastVersionAtPPIdObj.in_ms,
			ms: tagTxtRow.ms,
			by_ms: tagTxtRow.by_ms,
			in_ms: tagTxtRow.in_ms,
			code: isTag
				? pc.currentPostTagIdWithVersionNumAtPostId
				: pc.currentPostCoreIdWithVersionNumAtPostId,
			num: newLastVersion,
		});
	}

	let curPostTagStrs = curPostTagOrCoreIdWNumAsVersionAtPIdRows.map(
		(curPostTagOrCoreIdWNumAsVersionAtPIdObj) =>
			tagIdToTxtMap[getIdStr(curPostTagOrCoreIdWNumAsVersionAtPIdObj)],
	);
	let removedTagOrCoreStrs = curPostTagStrs.filter((t) => !newPostTagOrCoreStrs.includes(t));
	let tagOrCoresChanged =
		!!newTagOrCoresCount ||
		!!tagOrCoreTxtRowsToIncrementCountBy1.length ||
		!!removedTagOrCoreStrs.length;

	return {
		txtToTagOrCoreIdAndTxtWNumAsCtObjMap,
		tagOrCoresChanged,
		tagOrCoreTxtRowsToIncrementCountBy1,
		removedTagOrCoreStrs,
	};
};
