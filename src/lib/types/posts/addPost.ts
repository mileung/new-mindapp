import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import {
	addNewTagOrCoreRows,
	bumpCoreCountBy1,
	bumpTagCountsBy1,
	getCitedPostIds,
	getLastVersion,
	PostSchema,
	type Post,
} from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, hasParent, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getIdObj, idObjAsAtIdObj, idStrAsAtIdObj, zeros, type AtIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let addPost = async (post: Post, useRpc: boolean) => {
	let parsedPost = PostSchema.safeParse(post);
	if (!parsedPost.success) throw new Error(`Invalid post`);
	return useRpc ? trpc().addPost.mutate(parsedPost.data) : _addPost(await gsdb(), parsedPost.data);
};

export let _addPost = async (db: Database, post: Post) => {
	let lastVersion = getLastVersion(post);
	let mainPart: PartInsert = {
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
	let postIdObj = getIdObj(mainPart);
	let atPostIdObj = idObjAsAtIdObj(mainPart);
	let partsToInsert: PartInsert[] = [
		mainPart,
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
		mainPart.num = null;
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
			ms: layer.ms || mainPart.ms,
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
						...idStrAsAtIdObj(id),
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
		[pc.postIdWithNumAsDepthAtRootId]: postIdWithNumAsDepthAtRootIdObjs = [],
		[pc.postIdWithNumAsLastVersionAtParentPostId]: pIdWNumAsLastVersionAtPPIdObjs = [],
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
											pt.atIdAsId(mainPart),
											pt.code.eq(pc.postIdWithNumAsDepthAtRootId),
											pt.txt.isNull,
											pt.num.isNotNull,
										),
										and(
											pt.noParent,
											pt.atIdAsId(mainPart),
											pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
											pt.txt.isNull,
											pt.num.isNotNull,
										),
									]
								: []),
							tagsFromAllLayers.length
								? and(
										pt.noParent,
										pt.in_ms.eq(mainPart.in_ms),
										pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
										or(...tagsFromAllLayers.map((t) => pt.txt.eq(t))),
										pt.num.isNotNull,
									)
								: undefined,
							coresFromAllLayers.length
								? and(
										pt.noParent,
										pt.in_ms.eq(mainPart.in_ms),
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
			...pIdWNumAsLastVersionAtPPIdObjs,
		]);
		let parentIsRoot = !!pIdWNumAsLastVersionAtPPIdObjs.length;
		let atRootIdObj: AtIdObj = parentIsRoot
			? {
					at_ms: mainPart.at_ms,
					at_by_ms: mainPart.at_by_ms,
					at_in_ms: mainPart.at_in_ms,
				}
			: {
					at_ms: parentRow.at_ms,
					at_by_ms: parentRow.at_by_ms,
					at_in_ms: parentRow.at_in_ms,
				};

		partsToInsert.push({
			...atRootIdObj,
			...postIdObj,
			code: pc.postIdWithNumAsDepthAtRootId,
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
					pt.in_ms.eq(mainPart.in_ms),
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
		mainPart, //
		tagsFromAllLayers,
		tagIdAndTxtWithNumAsCountObjs,
		true,
		partsToInsert,
	);
	let coreTxtToRowMap = addNewTagOrCoreRows(
		mainPart, //
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

	await bumpTagCountsBy1(
		db,
		currentTags.map((t) => tagTxtToRowMap[t]),
	);
	await bumpCoreCountBy1(db, coreTxtToRowMap[currentCore]);

	await db.insert(pTable).values(partsToInsert);
	// console.log('partsToInsert:', partsToInsert);
	return { ms: mainPart.ms };
};
