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
				pf.noAtId,
				pf.ms.gt0,
				!input.spaceMs ? undefined : pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.tagId8_count_txt),
				pf.num.lte(input.fromCount),
				pf.num.gt0,
				and(...input.excludeTags.map((t) => pf.txt.notEq(t))),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(tagsPerLoad);

	return {
		tags: tagIdAndTxtWithNumAsCountRows.map((r) => ({
			txt: r.txt!,
			num: r.num!,
			...(r.in_ms ? { in_ms: r.in_ms } : {}),
		})),
	};
};
