import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import { ranInt } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or, sql } from 'drizzle-orm';
import { getCitedPostIds, getLastVersion, moveTagOrRxnCountsBy1, type Post } from '.';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, hasParent, type PartInsert } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';
import { accentCodes } from '../spaces';

export let addPost = async (
	post: Post,
	useLocalDb: boolean,
	usePostMs: boolean,
	getIdToCitedPostMap: boolean,
) => {
	let baseInput = await getWhoWhereObj(useLocalDb);
	return useLocalDb || !baseInput.spaceMs
		? _addPost(await gsdb(), post, true, usePostMs, getIdToCitedPostMap)
		: trpc().addPost.mutate({ ...baseInput, post });
};

export let _addPost = async (
	db: Database,
	post: Post,
	dbIsLocal: boolean,
	usePostMs: boolean,
	getIdToCitedPostMap: boolean,
) => {
	let postMs = usePostMs ? post.ms : Date.now();
	let postImb_parentMb_rootMb_childCountMainRow: PartInsert = {
		code: pc.postImb_parentMb_rootMb_childCount,
		p1: post.in_ms,
		p2: postMs,
		p3: post.by_ms,
		p4: post.at_ms,
		p5: post.at_by_ms,
		p6: null,
		p7: null,
		p8: 0,
	};
	let partsToInsert: PartInsert[] = [postImb_parentMb_rootMb_childCountMainRow];
	let historyEntries = post.history ? Object.entries(post.history) : [];
	let lastVersion = getLastVersion(post);
	let idToCitedPostMap: Record<string, Post> = {};
	let tagStrsFromAllLayersSet = new Set<string>();
	let currentTagStrs: string[] = [];
	let citedPostIdStrs: string[] = [];
	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;
		partsToInsert.push({
			code: isLastVersion //
				? pc._core_postImb_lastVersion_m
				: pc._core_postImb_oldVersion_m,
			txt: layer.core,
			p1: post.in_ms,
			p2: usePostMs ? post.ms : postMs,
			p3: post.by_ms,
			p4: version,
			p5: usePostMs ? layer.ms : postMs,
		});
		if (layer.tags?.length) {
			layer.tags.forEach((t) => tagStrsFromAllLayersSet.add(t));
			if (isLastVersion) currentTagStrs = layer.tags;
		}
		if (isLastVersion && layer.core) citedPostIdStrs = getCitedPostIds(layer.core);
	}

	if (getIdToCitedPostMap) {
		// citedPostIdStrs
		// TODO: getPostFeed
	}
	let postIsChild = hasParent(post);
	let tagStrsFromAllLayers = [...tagStrsFromAllLayersSet];
	let filters = [
		postIsChild
			? and(
					pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
					pf.p1.eq(post.in_ms),
					pf.p2.eq(post.at_ms!),
					pf.p3.eq(post.at_by_ms!),
				)
			: undefined,
		tagStrsFromAllLayers.length
			? and(
					pf.code.eq(pc._tag_imBy8_count),
					or(...tagStrsFromAllLayers.map((t) => pf.txt.eq(t))),
					pf.p1.eq(post.in_ms),
				)
			: undefined,
	];

	let {
		[pc.postImb_parentMb_rootMb_childCount]: postImb_parentMb_rootMb_childCountParentRows = [],
		[pc._tag_imBy8_count]: _tag_imBy8_countRows = [],
	} = channelPartsByCode(
		filters.some((f) => f)
			? await db
					.select()
					.from(pTable)
					.where(or(...filters))
			: [],
	);
	if (postIsChild) {
		let { p1, p2, p3, p6, p7 } = assert1Row(postImb_parentMb_rootMb_childCountParentRows);
		postImb_parentMb_rootMb_childCountMainRow.p6 = p6 ?? p2;
		postImb_parentMb_rootMb_childCountMainRow.p7 = p7 ?? p3;
		await db
			.update(pTable)
			.set({ p8: sql`${pTable.p8} + 1` })
			.where(
				and(
					pf.code.eq(pc.postImb_parentMb_rootMb_childCount),
					pf.p1.eq(p1!),
					pf.p2.eq(p2!),
					pf.p3.eq(p3!),
				),
			);
	}
	let txtTo_tag_imBy8_countRowMap: Record<string, PartInsert> = {};
	for (let i = 0; i < _tag_imBy8_countRows.length; i++) {
		let _tag_imBy8_countRow = _tag_imBy8_countRows[i];
		txtTo_tag_imBy8_countRowMap[_tag_imBy8_countRow.txt!] = _tag_imBy8_countRow;
	}
	let newTagCount = 0;
	let by8 = 0;
	for (let i = 0; i < tagStrsFromAllLayers.length; i++) {
		let tagStr = tagStrsFromAllLayers[i];
		let _tag_imBy8_countRow = txtTo_tag_imBy8_countRowMap[tagStr];
		if (!_tag_imBy8_countRow) {
			if (!by8) by8 = ranInt(8, 88888888);
			_tag_imBy8_countRow = {
				code: pc._tag_imBy8_count,
				txt: tagStr,
				p1: post.in_ms,
				p2: postMs,
				p3: by8 + newTagCount++, // The random by_ms is to prevent tagId collisions
				p4: currentTagStrs.includes(tagStr) ? 1 : 0,
			};
			txtTo_tag_imBy8_countRowMap[tagStr] = _tag_imBy8_countRow;
			partsToInsert.push(_tag_imBy8_countRow);
		}
	}

	await moveTagOrRxnCountsBy1(
		db,
		currentTagStrs.map((t) => txtTo_tag_imBy8_countRowMap[t]),
		[],
		true,
	);

	for (let i = 0; i < historyEntries.length; i++) {
		let [v, l] = historyEntries[i];
		let version = +v;
		let layer = l!;
		let isLastVersion = version === lastVersion;
		if (layer.tags?.length) {
			for (let i = 0; i < layer.tags.length; i++) {
				const tag = layer.tags[i];
				let _tag_imBy8_countRow = txtTo_tag_imBy8_countRowMap[tag];
				partsToInsert.push({
					code: isLastVersion //
						? pc.tagImb_postMb_lastVersion
						: pc.tagImb_postMb_oldVersion,
					p1: _tag_imBy8_countRow.p1,
					p2: _tag_imBy8_countRow.p2,
					p3: _tag_imBy8_countRow.p3,
					p4: postMs,
					p5: post.by_ms,
					p6: version,
				});
			}
		}
	}
	await db.insert(pTable).values(partsToInsert);
	if (!dbIsLocal) {
		if (post.at_by_ms !== undefined) {
			await db
				.update(pTable)
				.set({ p3: accentCodes.newPostsForCaller })
				.where(
					and(
						pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
						pf.p1.eq(post.in_ms),
						pf.p2.eq(post.at_by_ms),
						pf.p3.notEq(accentCodes.newPostsForCaller),
					),
				);
		}
		await db
			.update(pTable)
			.set({ p3: accentCodes.newPosts })
			.where(
				and(
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
					pf.p1.eq(post.in_ms),
					pf.p3.eq(accentCodes.none),
				),
			);
	}

	return { idToCitedPostMap, ms: postMs };
};
