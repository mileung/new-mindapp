import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import {
	addNewTagOrCoreRows,
	getCitedPostIds,
	getLastVersion,
	moveTagOrCoreCountsBy1,
	PostSchema,
	type Post,
} from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, hasParent, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import {
	getIdObj,
	getIdObjAsAtIdObj,
	getIdStrAsAtIdObj,
	zeros,
	type AtIdObj,
} from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let addPost = async (post: Post, useRpc: boolean) => {
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) {
		console.log(String(JSON.stringify(parsedPost.error.issues, null, 2)));
		throw new Error(`Invalid post`);
	}
	return useRpc ? trpc().addPost.mutate(parsedPost.data) : _addPost(await gsdb(), parsedPost.data);
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
		txt: null,
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
					},
				]),
	];
	let tagsFromAllLayers: string[] = [];
	let coresFromAllLayers: string[] = [];
	let currentTags: string[] = [];
	let currentCore = '';

	if (!post.history) {
		mainPostIdWithNumAsLastVersionAtParentPostIdObj.num = null;
	}

	let historyEntries = post.history ? Object.entries(post.history) : [];
	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;

		partsToInsert.push({
			...zeros,
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
			tagsFromAllLayers.push(...layer.tags);
			if (isLastVersion) currentTags = layer.tags;
		}
		if (layer.core) {
			coresFromAllLayers.push(layer.core);
			if (isLastVersion) {
				currentCore = layer.core;
				partsToInsert.push(
					...getCitedPostIds(layer.core).map((id) => ({
						...getIdStrAsAtIdObj(id),
						...postIdObj,
						code: pc.postIdAtCitedPostId,
					})),
				);
			}
		}
	}

	tagsFromAllLayers = [...new Set(tagsFromAllLayers)];
	coresFromAllLayers = [...new Set(coresFromAllLayers)];
	let {
		[pc.childPostIdWithNumAsDepthAtRootId]: postIdWithNumAsDepthAtRootIdObjs = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: postIdWNumAsLastVersionAtPPostIdObjs = [],
		[pc.tagIdAndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreIdAndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountObjs = [],
	} = channelPartsByCode(
		postIsChild || tagsFromAllLayers.length || coresFromAllLayers.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							...(postIsChild
								? [
										and(
											pt.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
											pt.code.eq(pc.childPostIdWithNumAsDepthAtRootId),
											pt.txt.isNull,
											pt.num.isNotNull,
										),
										and(
											pt.noParent,
											pt.atIdAsId(mainPostIdWithNumAsLastVersionAtParentPostIdObj),
											pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
											pt.txt.isNull,
											pt.num.isNotNull,
										),
									]
								: []),
							tagsFromAllLayers.length
								? and(
										pt.noParent,
										pt.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
										pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
										or(...tagsFromAllLayers.map((t) => pt.txt.eq(t))),
										pt.num.isNotNull,
									)
								: undefined,
							coresFromAllLayers.length
								? and(
										pt.noParent,
										pt.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
										pt.code.eq(pc.coreIdAndTxtWithNumAsCount),
										or(...coresFromAllLayers.map((t) => pt.txt.eq(t))),
										pt.num.isNotNull,
									)
								: undefined,
						),
					)
			: [],
	);

	if (postIsChild) {
		let parentRow = assert1Row([
			...postIdWithNumAsDepthAtRootIdObjs,
			...postIdWNumAsLastVersionAtPPostIdObjs,
		]);
		let parentIsRoot = !!postIdWNumAsLastVersionAtPPostIdObjs.length;
		let atRootIdObj: AtIdObj = parentIsRoot
			? {
					at_ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.at_ms,
					at_by_ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.at_by_ms,
					at_in_ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.at_in_ms,
				}
			: {
					at_ms: parentRow.at_ms,
					at_by_ms: parentRow.at_by_ms,
					at_in_ms: parentRow.at_in_ms,
				};

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
					pt.atId(atRootIdObj),
					pt.ms.gt0,
					pt.in_ms.eq(mainPostIdWithNumAsLastVersionAtParentPostIdObj.in_ms),
					pt.code.eq(pc.postIdAtBumpedRootId),
					pt.txt.isNull,
					pt.num.isNull,
				),
			)
			.returning();
		if (!bumpedRootRow?.length) {
			partsToInsert.push({
				...atRootIdObj,
				...postIdObj,
				code: pc.postIdAtBumpedRootId,
			});
		}
	}

	let tagTxtToRowMap = addNewTagOrCoreRows(
		mainPostIdWithNumAsLastVersionAtParentPostIdObj, //
		tagsFromAllLayers,
		tagIdAndTxtWithNumAsCountObjs,
		true,
		partsToInsert,
	);
	let coreTxtToRowMap = addNewTagOrCoreRows(
		mainPostIdWithNumAsLastVersionAtParentPostIdObj, //
		coresFromAllLayers,
		coreIdAndTxtWithNumAsCountObjs,
		false,
		partsToInsert,
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

	await moveTagOrCoreCountsBy1(
		db,
		currentTags.map((t) => tagTxtToRowMap[t]),
		[coreTxtToRowMap[currentCore]],
	);
	await db.insert(pTable).values(partsToInsert);

	// console.log('partsToInsert:', partsToInsert);
	return { ms: mainPostIdWithNumAsLastVersionAtParentPostIdObj.ms };
};
