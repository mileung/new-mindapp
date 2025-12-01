import { trpc } from '$lib/trpc/client';
import { and, eq, or } from 'drizzle-orm';
import { type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, type PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getIdStr, type FullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let getPostHistory = async (fullPostId: FullIdObj, version: number, useRpc: boolean) => {
	return useRpc
		? trpc().getPostHistory.query({ ...fullPostId, fullPostId, version })
		: _getPostHistory(await gsdb(), fullPostId, version);
};

// TODO: paginate history versions?
export let _getPostHistory = async (db: Database, fullPostId: FullIdObj, version: number) => {
	if (fullPostId.in_ms > 0 && !fullPostId.by_ms) throw new Error('Invalid by_ms');
	let postSubParts = await db
		.select()
		.from(pTable)
		.where(
			and(
				pt.idAsAtId(fullPostId),
				or(
					...[
						pc.currentPostTagIdWithNumAsVersionAtPostId,
						pc.currentPostCoreIdWithNumAsVersionAtPostId,
						pc.exPostTagIdWithNumAsVersionAtPostId,
						pc.exPostCoreIdWithNumAsVersionAtPostId,
					].map((code) => pt.code.eq(code)),
				),
				eq(pTable.num, version),
			),
		);

	let tagIdsSet = new Set<string>();
	let tagIdRows: PartSelect[] = [];
	let coreRows: PartSelect[] = [];

	for (let i = 0; i < postSubParts.length; i++) {
		let part = postSubParts[i];
		if (
			part.code === pc.currentPostTagIdWithNumAsVersionAtPostId ||
			part.code === pc.exPostTagIdWithNumAsVersionAtPostId
		) {
			let tagId = getIdStr(part);
			if (part.ms && !tagIdsSet.has(tagId)) {
				tagIdsSet.add(tagId);
				tagIdRows.push(part);
			}
		} else if (
			part.code === pc.currentPostCoreIdWithNumAsVersionAtPostId ||
			part.code === pc.exPostCoreIdWithNumAsVersionAtPostId
		) {
			coreRows.push(part);
		}
	}
	assert1Row(coreRows);
	let tagRows = tagIdRows.length
		? await db
				.select()
				.from(pTable)
				.where(
					and(
						pt.at_ms.eq0,
						pt.at_by_ms.eq0,
						pt.at_in_ms.eq0,
						or(...tagIdRows.map((row) => pt.id(row))),
						pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
						pt.txt.isNotNull,
						pt.num.isNotNull,
					),
				)
		: [];

	let parts = [...postSubParts, ...tagRows];
	let tagIdToTxtMap: Record<string, string> = {};
	let history: Post['history'] = {
		[version]: { ms: fullPostId.ms!, tags: [], core: '' },
	};

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		if (
			part.code === pc.currentPostTagIdWithNumAsVersionAtPostId ||
			part.code === pc.exPostTagIdWithNumAsVersionAtPostId
		) {
			if (part.ms) {
				history[version]!.tags = [getIdStr(part), ...(history[version]!.tags || [])];
			}
		} else if (
			part.code === pc.currentPostCoreIdWithNumAsVersionAtPostId ||
			part.code === pc.exPostCoreIdWithNumAsVersionAtPostId
		) {
			history[version]!.core = part.txt || undefined;
			history[version]!.ms = part.ms!;
		} else if (part.code === pc.tagIdAndTxtWithNumAsCount) {
			tagIdToTxtMap[getIdStr(part)] = part.txt!;
		}
	}

	if (history[version]?.tags) {
		for (let i = 0; i < history[version].tags.length; i++) {
			history[version].tags[i] = tagIdToTxtMap[history[version].tags[i]];
		}
	}

	return { history };
};
