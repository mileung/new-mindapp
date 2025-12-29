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
import { gsdb, type Database } from '../../local-db';
import {
	assert1Row,
	channelPartsByCode,
	getWhoWhereObj,
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

export let addPost = async (post: Post, forceUsingLocalDb?: boolean) => {
	let baseInput = await getWhoWhereObj();
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) {
		console.log(String(JSON.stringify(parsedPost.error.issues, null, 2)));
		throw new Error(`Invalid post`);
	}
	return forceUsingLocalDb || !baseInput.spaceMs
		? _addPost(await gsdb(), parsedPost.data)
		: trpc().addPost.mutate({ ...baseInput, post: parsedPost.data });
};

export let _addPost = async (db: Database, post: Post) => {
	let lastVersion = getLastVersion(post);
	let mainPostIdWithNumAsLastVersionAtParentPostIdObj: PartInsert = {
		at_ms: post.at_ms,
		at_by_ms: post.at_by_ms,
		at_in_ms: post.at_in_ms,
		ms: post.ms || Date.now(),
		by_ms: post.by_ms,
		in_ms: post.in_ms,
		code: pc.postIdWithNumAsLastVersionAtParentPostId,
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
						code: pc.postIdAtBumpedRootId,
						num: 0,
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
						? pc.currentSoftDeletedVersionNumAndMsAtPostId
						: pc.exSoftDeletedVersionNumAndMsAtPostId
					: isLastVersion
						? pc.currentVersionNumAndMsAtPostId
						: pc.exVersionNumAndMsAtPostId,
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
				partsToInsert.push(
					...getCitedPostIds(layer.core).map((id) => ({
						...getIdStrAsAtIdObj(id),
						...postIdObj,
						code: pc.postIdAtCitedPostId,
						num: 0,
					})),
				);
			}
		}
	}

	tagStrsFromAllLayers = [...new Set(tagStrsFromAllLayers)];
	coreStrsFromAllLayers = [...new Set(coreStrsFromAllLayers)];
	let {
		[pc.childPostIdWithNumAsDepthAtRootId]: postIdWithNumAsDepthAtRootIdRows = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.tagId8AndTxtWithNumAsCount]: existingTagIdAndTxtWithNumAsCountRows = [],
		[pc.coreId8AndTxtWithNumAsCount]: existingCoreIdAndTxtWithNumAsCountRows = [],
	} = channelPartsByCode(
		postIsChild || tagStrsFromAllLayers.length || coreStrsFromAllLayers.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							...(postIsChild
								? [
										and(
											pf.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
											pf.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
											pf.num.gte0,
											pf.txt.isNull,
										),
										and(
											pf.noParent,
											pf.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
											pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
											pf.num.gte0,
											pf.txt.isNull,
										),
									]
								: []),
							tagStrsFromAllLayers.length
								? and(
										pf.noParent,
										pf.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
										pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
										pf.num.gte0,
										or(...tagStrsFromAllLayers.map((t) => pf.txt.eq(t))),
									)
								: undefined,
							coreStrsFromAllLayers.length
								? and(
										pf.noParent,
										pf.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
										pf.code.eq(pc.coreId8AndTxtWithNumAsCount),
										pf.num.gte0,
										or(...coreStrsFromAllLayers.map((t) => pf.txt.eq(t))),
									)
								: undefined,
						),
					)
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
			code: pc.childPostIdWithNumAsDepthAtRootId,
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
					pf.code.eq(pc.postIdAtBumpedRootId),
					pf.num.eq0,
					pf.txt.isNull,
				),
			)
			.returning();
		if (!bumpedRootRow?.length) {
			partsToInsert.push({
				...atRootIdObj,
				...postIdObj,
				code: pc.postIdAtBumpedRootId,
				num: 0,
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
							? pc.currentPostTagIdWithNumAsVersionAtPostId
							: pc.exPostTagIdWithNumAsVersionAtPostId,
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
						? pc.currentPostCoreIdWithNumAsVersionAtPostId
						: pc.exPostCoreIdWithNumAsVersionAtPostId,
					num: version,
				});
			}
		}
	}

	await db.insert(pTable).values(partsToInsert);

	// console.log('partsToInsert:', partsToInsert);
	return { ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.ms };
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
	let code = isTag ? pc.tagId8AndTxtWithNumAsCount : pc.coreId8AndTxtWithNumAsCount;
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
