import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import { getTagNumVal, ranInt } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { getCitedPostIds, getLastVersion, moveTagOrRxnCountsBy1, PostSchema, type Post } from '.';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, hasParent, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import {
	getAtIdObj,
	getIdObj,
	getIdObjAsAtIdObj,
	getIdStrAsIdObj,
	id0,
	type AtIdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let addPost = async (post: Post, useLocalDb?: boolean, getIdToCitedPostMap = true) => {
	let baseInput = await getWhoWhereObj(useLocalDb);
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) {
		console.log(String(JSON.stringify(parsedPost.error.issues, null, 2)));
		throw new Error(`Invalid post`);
	}
	return useLocalDb || !baseInput.spaceMs
		? _addPost(await gsdb(), parsedPost.data, getIdToCitedPostMap, true)
		: trpc().addPost.mutate({ ...baseInput, post: parsedPost.data });
};

export let _addPost = async (
	db: Database,
	post: Post,
	getIdToCitedPostMap = true,
	allowPostMs = false,
) => {
	let now = Date.now();
	if (!allowPostMs && post.ms !== now) throw new Error(`cannot set post.ms`);
	let ms = allowPostMs ? post.ms : now;
	let lastVersion = getLastVersion(post);
	let postIsChild = hasParent(post);
	let main_postId__parentPostId_lastVersionRow: PartInsert = {
		at_ms: post.at_ms,
		at_by_ms: post.at_by_ms,
		at_in_ms: post.at_in_ms,
		ms,
		by_ms: post.by_ms,
		in_ms: post.in_ms,
		code: pc.postId__parentPostId_lastVersion,
		num: lastVersion,
	};
	let partsToInsert: PartInsert[] = [main_postId__parentPostId_lastVersionRow];
	let postIdObj = getIdObj(main_postId__parentPostId_lastVersionRow);
	let citedPostIdStrs: string[] = [];
	let idToCitedPostMap: Record<string, Post> = {};
	let tagStrsFromAllLayers: string[] = [];
	let currentTagStrs: string[] = [];

	let historyEntries = post.history ? Object.entries(post.history) : [];
	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l || { ms: 0, tags: null };
		let softDeleted = layer.tags === null;
		let isLastVersion = version === lastVersion;

		partsToInsert.push({
			...id0,
			at_ms: layer.ms,
			at_by_ms: softDeleted ? 1 : 0,
			at_in_ms: version,
			...postIdObj,
			code: isLastVersion //
				? pc.postId__ms_sd_lastVersion__core
				: pc.postId__ms_sd_oldVersion__core,
			txt: softDeleted ? undefined : (layer.core ?? ''),
		});

		if (layer.tags?.length) {
			tagStrsFromAllLayers.push(...layer.tags);
			if (isLastVersion) currentTagStrs = layer.tags;
		}
		if (isLastVersion && layer.core) citedPostIdStrs = getCitedPostIds(layer.core);
	}

	tagStrsFromAllLayers = [...new Set(tagStrsFromAllLayers)];

	let filters = [
		...(getIdToCitedPostMap
			? citedPostIdStrs.map(
					(idStr) =>
						and(
							pf.id(getIdStrAsIdObj(idStr)),
							// pf.code.eq(pc.postId__ms_softDeletedNewestVersion)
						),
					// TODO: get cited posts
				)
			: []),
		...(postIsChild
			? [
					and(
						pf.noAtId,
						pf.atIdAsId(main_postId__parentPostId_lastVersionRow),
						pf.code.eq(pc.postId__parentPostId_lastVersion),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.atIdAsId(main_postId__parentPostId_lastVersionRow),
						pf.code.eq(pc.childPostId__rootId_depth),
						pf.num.gte0,
						pf.txt.isNull,
					),
				]
			: []),
		tagStrsFromAllLayers.length
			? and(
					pf.noAtId,
					pf.in_ms.eq(main_postId__parentPostId_lastVersionRow.in_ms),
					pf.code.eq(pc.idBy8__count_val_tag),
					or(...tagStrsFromAllLayers.map((t) => pf.txt.eq(t))),
				)
			: undefined,
	];

	let {
		[pc.postId__parentPostId_lastVersion]: postId__parentPostId_lastVersionRows = [],
		[pc.childPostId__rootId_depth]: childPostId__rootId_depthRows = [],
		[pc.idBy8__count_val_tag]: existing_idBy8__count_val_tagRows = [],
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
			...childPostId__rootId_depthRows,
			...postId__parentPostId_lastVersionRows,
		]);
		let parentIsRoot = !!postId__parentPostId_lastVersionRows.length;
		let atRootIdObj: AtIdObj = getAtIdObj(
			parentIsRoot ? main_postId__parentPostId_lastVersionRow : parentRow,
		);

		partsToInsert.push({
			...atRootIdObj,
			...postIdObj,
			code: pc.childPostId__rootId_depth,
			num: (parentIsRoot ? 0 : parentRow.num!) + 1,
		});
	}

	let tagTxtToRowMap: Record<string, PartInsert> = {};
	for (let i = 0; i < existing_idBy8__count_val_tagRows.length; i++) {
		let existingTagTxtObj = existing_idBy8__count_val_tagRows[i];
		tagTxtToRowMap[existingTagTxtObj.txt!] = existingTagTxtObj;
	}
	let newTagCount = 0;
	let by8 = 0;
	for (let i = 0; i < tagStrsFromAllLayers.length; i++) {
		let tagStr = tagStrsFromAllLayers[i];
		let tagRow = tagTxtToRowMap[tagStr];
		if (!tagRow) {
			if (!by8) by8 = ranInt(8, 88888888);
			tagRow = {
				...id0,
				at_ms: currentTagStrs.includes(tagStr) ? 1 : 0,
				ms: main_postId__parentPostId_lastVersionRow.ms,
				by_ms: by8 + newTagCount++, // The random by_ms is to prevent tagId collisions
				in_ms: main_postId__parentPostId_lastVersionRow.in_ms,
				code: pc.idBy8__count_val_tag,
				num: getTagNumVal(tagStr),
				txt: tagStr,
			};
			tagTxtToRowMap[tagStr] = tagRow;
			partsToInsert.push(tagRow);
		}
	}

	await moveTagOrRxnCountsBy1(
		db,
		currentTagStrs.map((t) => tagTxtToRowMap[t]),
		[],
		true,
	);

	let atPostIdObj = getIdObjAsAtIdObj(main_postId__parentPostId_lastVersionRow);
	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;
		if (layer.tags?.length) {
			for (let i = 0; i < layer.tags.length; i++) {
				const tag = layer.tags[i];
				let tagRow = tagTxtToRowMap[tag];
				partsToInsert.push({
					...atPostIdObj,
					ms: tagRow.ms,
					by_ms: tagRow.by_ms,
					in_ms: tagRow.in_ms,
					code: isLastVersion //
						? pc.postTagId__postId_lastVersion
						: pc.postTagId__postId_oldVersion,
					num: version,
				});
			}
		}
	}

	await db.insert(pTable).values(partsToInsert);

	return { idToCitedPostMap, ms };
};
