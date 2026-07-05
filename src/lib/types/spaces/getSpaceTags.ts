import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let tagsPerLoad = 88;

export let getSpaceTags = async (fromCount: number, excludeTags: string[]) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getSpaceTags.query({ ...baseInput, fromCount, excludeTags })
		: _getSpaceTags(await gsdb(), { ...baseInput, fromCount, excludeTags });
};

export let _getSpaceTags = async (
	db: Database,
	input: WhoWhereObj & {
		fromCount: number; //
		excludeTags: string[];
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));
	let tagIdAndTxtWithNumAsCountRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc._tag_imBy8_count),
				and(...input.excludeTags.map((t) => pf.txt.notEq(t))),
				!input.spaceMs ? undefined : pf.p1.eq(input.spaceMs),
				pf.p4.lte(input.fromCount),
				pf.p4.gt(0),
			),
		)
		.orderBy(desc(pTable.p4), asc(pTable.txt))
		.limit(tagsPerLoad);

	return {
		tags: tagIdAndTxtWithNumAsCountRows.map((r) => ({
			txt: r.txt!,
			num: r.p4!,
			...(!input.spaceMs && r.p1 ? { in_ms: r.p1 } : {}),
		})),
	};
};
