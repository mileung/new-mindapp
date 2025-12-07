import { trpc } from '$lib/trpc/client';
import { and, eq, or } from 'drizzle-orm';
import { type Post } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, assertLt2Rows, channelPartsByCode, getBaseInput } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { getIdStr, type FullIdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let getPostHistory = async (fullPostId: FullIdObj, version: number) => {
	let baseInput = await getBaseInput();
	return baseInput.spaceMs
		? trpc().getPostHistory.query({ ...baseInput, fullPostId, version })
		: _getPostHistory(await gsdb(), fullPostId, version);
};

// TODO: paginate history versions?
export let _getPostHistory = async (db: Database, fullPostId: FullIdObj, version: number) => {
	let {
		[pc.exVersionNumAndMsAtPostId]: exVersionNumAndMsAtPostIdObjs = [],
		[pc.exPostTagIdWithNumAsVersionAtPostId]: exPostTagIdWithNumAsVersionAtPostIdObjs = [],
		[pc.exPostCoreIdWithNumAsVersionAtPostId]: exPostCoreIdWithNumAsVersionAtPostIdObjs = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				and(
					pt.idAsAtId(fullPostId),
					or(
						...[
							pc.exVersionNumAndMsAtPostId,
							pc.exPostTagIdWithNumAsVersionAtPostId,
							pc.exPostCoreIdWithNumAsVersionAtPostId,
						].map((code) => pt.code.eq(code)),
					),
					eq(pTable.num, version),
				),
			),
	);

	let exVersionNumAndMsAtPostIdObj = assert1Row(exVersionNumAndMsAtPostIdObjs);
	assertLt2Rows(exPostCoreIdWithNumAsVersionAtPostIdObjs);

	let {
		[pc.tagId8AndTxtWithNumAsCount]: tagIdAndTxtWithNumAsCountObjs = [],
		[pc.coreId8AndTxtWithNumAsCount]: coreIdAndTxtWithNumAsCountObjs = [],
	} = channelPartsByCode(
		exPostTagIdWithNumAsVersionAtPostIdObjs.length ||
			exPostCoreIdWithNumAsVersionAtPostIdObjs.length
			? await db
					.select()
					.from(pTable)
					.where(
						or(
							and(
								pt.noParent,
								or(...exPostTagIdWithNumAsVersionAtPostIdObjs.map((row) => pt.id(row))),
								pt.code.eq(pc.tagId8AndTxtWithNumAsCount),
								pt.num.gte0,
								pt.txt.isNotNull,
							),
							and(
								pt.noParent,
								or(...exPostCoreIdWithNumAsVersionAtPostIdObjs.map((row) => pt.id(row))),
								pt.code.eq(pc.coreId8AndTxtWithNumAsCount),
								pt.num.gte0,
								pt.txt.isNotNull,
							),
						),
					)
			: [],
	);

	let parts = [
		...exPostTagIdWithNumAsVersionAtPostIdObjs,
		...exPostCoreIdWithNumAsVersionAtPostIdObjs,
		...tagIdAndTxtWithNumAsCountObjs,
		...coreIdAndTxtWithNumAsCountObjs,
	];
	let tagIdToTxtMap: Record<string, string> = {};
	let coreIdToTxtMap: Record<string, string> = {};
	let history: Post['history'] = {
		[version]: { ms: exVersionNumAndMsAtPostIdObj.ms!, tags: [], core: '' },
	};

	for (let i = 0; i < parts.length; i++) {
		let part = parts[i];
		if (part.code === pc.exPostTagIdWithNumAsVersionAtPostId) {
			history[version]!.tags = [getIdStr(part), ...(history[version]!.tags || [])];
		} else if (part.code === pc.exPostCoreIdWithNumAsVersionAtPostId) {
			history[version]!.core = getIdStr(part);
		} else if (part.code === pc.tagId8AndTxtWithNumAsCount) {
			tagIdToTxtMap[getIdStr(part)] = part.txt!;
		} else if (part.code === pc.coreId8AndTxtWithNumAsCount) {
			coreIdToTxtMap[getIdStr(part)] = part.txt!;
		}
	}

	if (history[version]?.tags?.length) {
		for (let i = 0; i < history[version].tags.length; i++) {
			history[version].tags[i] = tagIdToTxtMap[history[version].tags[i]];
		}
	}
	if (history[version]?.core) {
		history[version].core = coreIdToTxtMap[history[version].core];
	}

	return { history };
};
