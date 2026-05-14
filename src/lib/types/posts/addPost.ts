import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import { ranInt } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import {
	getCitedPostIds,
	getLastVersion,
	moveTagCoreOrRxnCountsBy1,
	PostSchema,
	type Post,
} from '.';
import { type Database } from '../../local-db';
import {
	assert1Row,
	channelPartsByCode,
	hasParent,
	type PartInsert,
	type PartSelect,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import {
	getAtIdObj,
	getIdObj,
	getIdObjAsAtIdObj,
	getIdStrAsAtIdObj,
	id0,
	type AtIdObj,
	type IdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let addPost = async (post: Post, useLocalDb?: boolean) => {
	let baseInput = await getWhoWhereObj(useLocalDb);
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) {
		console.log(String(JSON.stringify(parsedPost.error.issues, null, 2)));
		throw new Error(`Invalid post`);
	}
	return useLocalDb || !baseInput.spaceMs
		? _addPost(await gsdb(), parsedPost.data)
		: trpc().addPost.mutate({ ...baseInput, post: parsedPost.data });
};

export let _addPost = async (db: Database, post: Post, getIdToCitedPostMap = false) => {
	let lastVersion = getLastVersion(post);
	let citedPostIds: string[] = [];
	let idToCitedPostMap: Record<string, Post> = {};
	let mainPostIdWithNumAsLastVersionAtParentPostIdObj: PartInsert = {
		at_ms: post.at_ms,
		at_by_ms: post.at_by_ms,
		at_in_ms: post.at_in_ms,
		ms: post.ms || Date.now(),
		by_ms: post.by_ms,
		in_ms: post.in_ms,
		code: pc.postId__parentPostId_lastVersion,
		num: lastVersion,
	};
	let postIsChild = hasParent(post);
	let postIdObj = getIdObj(mainPostIdWithNumAsLastVersionAtParentPostIdObj);
	let atPostIdObj = getIdObjAsAtIdObj(mainPostIdWithNumAsLastVersionAtParentPostIdObj);
	let partsToInsert: PartInsert[] = [
		mainPostIdWithNumAsLastVersionAtParentPostIdObj,
		...(postIsChild
			? []
			: [
					{
						...atPostIdObj,
						...postIdObj,
						code: pc.postId__bumpedRootId,
					},
				]),
	];
	let tagStrsFromAllLayers: string[] = [];
	let coreStrsFromAllLayers: string[] = [];
	let currentTagStrs: string[] = [];
	let currentCoreStr = '';

	let historyEntries = post.history ? Object.entries(post.history) : [];
	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;

		partsToInsert.push({
			...id0,
			...atPostIdObj,
			ms: layer.ms || mainPostIdWithNumAsLastVersionAtParentPostIdObj.ms,
			code:
				layer.tags === null
					? isLastVersion
						? pc.ms__postId_currentSoftDeletedVersion
						: pc.ms__postId_exSoftDeletedVersion
					: isLastVersion
						? pc.ms__postId_currentVersion
						: pc.ms__postId_exVersion,
			num: version,
		});

		if (layer.tags?.length) {
			tagStrsFromAllLayers.push(...layer.tags);
			if (isLastVersion) currentTagStrs = layer.tags;
		}
		if (layer.core) {
			coreStrsFromAllLayers.push(layer.core);
			if (isLastVersion) {
				currentCoreStr = layer.core;
				citedPostIds = getCitedPostIds(layer.core);
				partsToInsert.push(
					...citedPostIds.map((id) => ({
						...getIdStrAsAtIdObj(id),
						...postIdObj,
						code: pc.postId__citedPostId,
					})),
				);
			}
		}
	}

	tagStrsFromAllLayers = [...new Set(tagStrsFromAllLayers)];
	coreStrsFromAllLayers = [...new Set(coreStrsFromAllLayers)];

	let filters = [
		...(getIdToCitedPostMap
			? citedPostIds.map(
					(id) => and(),
					// TODO: get cited posts
				)
			: []),
		...(postIsChild
			? [
					and(
						pf.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
						pf.code.eq(pc.childPostId__rootId_depth),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.noAtId,
						pf.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
						pf.code.eq(pc.postId__parentPostId_lastVersion),
						pf.num.gte0,
						pf.txt.isNull,
					),
				]
			: []),
		tagStrsFromAllLayers.length
			? and(
					pf.noAtId,
					pf.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
					pf.code.eq(pc.tagId8_count_txt),
					pf.num.gte0,
					or(...tagStrsFromAllLayers.map((t) => pf.txt.eq(t))),
				)
			: undefined,
		coreStrsFromAllLayers.length
			? and(
					pf.noAtId,
					pf.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
					pf.code.eq(pc.coreId8_count_txt),
					pf.num.gte0,
					or(...coreStrsFromAllLayers.map((t) => pf.txt.eq(t))),
				)
			: undefined,
	];

	let {
		[pc.childPostId__rootId_depth]: postIdWithNumAsDepthAtRootIdRows = [],
		[pc.postId__parentPostId_lastVersion]: postIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.tagId8_count_txt]: existingTagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8_count_txt]: existingCoreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		filters.some((f) => f)
			? await db
					.select()
					.from(pTable)
					.where(or(...filters))
			: [],
	);

	if (postIsChild) {
		let parentRow = assert1Row([
			...postIdWithNumAsDepthAtRootIdRows,
			...postIdWNumAsLastVersionAtPPostIdRows,
		]);
		let parentIsRoot = !!postIdWNumAsLastVersionAtPPostIdRows.length;
		let atRootIdObj: AtIdObj = getAtIdObj(
			parentIsRoot ? mainPostIdWithNumAsLastVersionAtParentPostIdObj : parentRow,
		);

		partsToInsert.push({
			...atRootIdObj,
			...postIdObj,
			code: pc.childPostId__rootId_depth,
			txt: null,
			num: (parentIsRoot ? 0 : parentRow.num!) + 1,
		});
		let bumpedRootRow = await db
			.update(pTable)
			.set({ ...postIdObj })
			.where(
				and(
					pf.atId(atRootIdObj),
					pf.ms.gt0,
					pf.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
					pf.code.eq(pc.postId__bumpedRootId),
					pf.num.isNull,
					pf.txt.isNull,
				),
			)
			.returning();
		if (!bumpedRootRow?.length) {
			partsToInsert.push({
				...atRootIdObj,
				...postIdObj,
				code: pc.postId__bumpedRootId,
			});
		}
	}

	let tagTxtToRowMap = addNewTagOrCoreRows(
		mainPostIdWithNumAsLastVersionAtParentPostIdObj, //
		tagStrsFromAllLayers,
		existingTagIdAndTxtWithNumAsCountRows,
		true,
		partsToInsert,
	);
	let coreTxtToRowMap = addNewTagOrCoreRows(
		mainPostIdWithNumAsLastVersionAtParentPostIdObj, //
		coreStrsFromAllLayers,
		existingCoreIdAndTxtWithNumAsCountRows,
		false,
		partsToInsert,
	);

	await moveTagCoreOrRxnCountsBy1(
		db,
		currentTagStrs.map((t) => tagTxtToRowMap[t]),
		[coreTxtToRowMap[currentCoreStr]].filter((r) => !!r),
		[],
		true,
	);

	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;
		if (layer.tags !== null) {
			if (layer.tags.length) {
				for (let i = 0; i < layer.tags.length; i++) {
					const tag = layer.tags[i];
					let tagRow = tagTxtToRowMap[tag];
					partsToInsert.push({
						...atPostIdObj,
						ms: tagRow.ms,
						by_ms: tagRow.by_ms,
						in_ms: tagRow.in_ms,
						code: isLastVersion
							? pc.currentPostTagId__postId_version
							: pc.exPostTagId__postId_version,
						num: version,
					});
				}
			}
			if (layer.core) {
				let coreRow = coreTxtToRowMap[layer.core];
				partsToInsert.push({
					...atPostIdObj,
					ms: coreRow.ms,
					by_ms: coreRow.by_ms,
					in_ms: coreRow.in_ms,
					code: isLastVersion
						? pc.currentPostCoreId__postId_version
						: pc.exPostCoreId__postId_version,
					num: version,
				});
			}
		}
	}

	await db.insert(pTable).values(partsToInsert);

	return { idToCitedPostMap, ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.ms };
};

let addNewTagOrCoreRows = (
	mainPIdWNumAsLastVersionAtPPIdObj: IdObj,
	allTagOrCoreStrs: string[],
	existingTagOrCoreTxtRows: PartSelect[],
	isTag: boolean,
	partsToInsert: PartInsert[],
) => {
	let txtToIdAndTxtWithNumAsCountObjMap: Record<string, PartInsert> = {};
	for (let i = 0; i < existingTagOrCoreTxtRows.length; i++) {
		let existingTagOrCoreTxtObj = existingTagOrCoreTxtRows[i];
		txtToIdAndTxtWithNumAsCountObjMap[existingTagOrCoreTxtObj.txt!] = existingTagOrCoreTxtObj;
	}
	let newRowsCount = 0;
	let code = isTag ? pc.tagId8_count_txt : pc.coreId8_count_txt;
	for (let i = 0; i < allTagOrCoreStrs.length; i++) {
		let tagOrCoreStr = allTagOrCoreStrs[i];
		let tagOrCoreRow = txtToIdAndTxtWithNumAsCountObjMap[tagOrCoreStr];
		if (!tagOrCoreRow) {
			tagOrCoreRow = {
				...id0,
				ms: mainPIdWNumAsLastVersionAtPPIdObj.ms + newRowsCount++,
				by_ms: ranInt(8, 88888888),
				// If not for the random by_ms, a single user in the same space could add a lot (hundreds+) of the same tag or cores at the same time causing multiple tag or core rows to have the same id.
				in_ms: mainPIdWNumAsLastVersionAtPPIdObj.in_ms,
				code,
				txt: tagOrCoreStr,
				num: 1,
			};
			txtToIdAndTxtWithNumAsCountObjMap[tagOrCoreStr] = tagOrCoreRow;
			partsToInsert.push(tagOrCoreRow);
		}
	}

	return txtToIdAndTxtWithNumAsCountObjMap;
};
