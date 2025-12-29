import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import { gsdb } from '../../local-db';
import { getWhoWhereObj, type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let accountsPerLoad = 88;

export let getSpaceAccounts = async (fromMs: number) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getSpaceAccounts.query({ ...baseInput, fromMs })
		: _getSpaceAccounts(await gsdb(), { ...baseInput, fromMs });
};

export let _getSpaceAccounts = async (
	db: Database,
	input: WhoWhereObj & {
		fromMs: number; //
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	let tagIdAndTxtWithNumAsCountRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.at_ms.eq0,
				pf.at_by_ms.eq0,
				pf.at_in_ms.eq0,
				pf.ms.gt0,
				pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.tagId8AndTxtWithNumAsCount),
				pf.num.lte(input.fromMs),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(accountsPerLoad);

	return {
		accounts: [],
	};
};
