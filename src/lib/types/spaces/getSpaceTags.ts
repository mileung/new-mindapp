import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, or } from 'drizzle-orm';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let tagsPerLoad = 88;

export let getSpaceTags = async (fromCount: number, lastTag?: string) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getSpaceTags.query({ ...baseInput, fromCount, lastTag })
		: _getSpaceTags(await gsdb(), { ...baseInput, fromCount, lastTag });
};

export let _getSpaceTags = async (
	db: Database,
	input: WhoWhereObj & {
		fromCount: number; //
		lastTag?: string;
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
				input.spaceMs ? pf.p1.eq(input.spaceMs) : undefined,
				or(
					pf.p4.lt(input.fromCount), //
					input.lastTag
						? and(
								pf.txt.gt(input.lastTag), //
								pf.p4.eq(input.fromCount),
							)
						: undefined,
				),
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
