import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc } from 'drizzle-orm';
import { gsdb } from '../../local-db';
import { getBaseInput, type BaseInput } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let accountsPerLoad = 88;

export let getSpaceAccounts = async (fromAccountMs: number) => {
	let baseInput = await getBaseInput();
	return baseInput.in_ms > 0
		? trpc().getSpaceAccounts.query({ ...baseInput, fromAccountMs })
		: _getSpaceAccounts(await gsdb(), { ...baseInput, fromAccountMs });
};

export let _getSpaceAccounts = async (
	db: Database,
	input: BaseInput & {
		fromAccountMs: number; //
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));

	if (input.in_ms !== 0 && input.in_ms !== 1 && !input.by_ms) throw new Error('Missing byMs');
	let tagIdAndTxtWithNumAsCountObjs = await db
		.select()
		.from(pTable)
		.where(
			and(
				pt.at_ms.eq0,
				pt.at_by_ms.eq0,
				pt.at_in_ms.eq0,
				pt.ms.gt0,
				pt.in_ms.eq(input.in_ms),
				pt.code.eq(pc.tagIdAndTxtWithNumAsCount),
				pt.num.lte(input.fromAccountMs),
			),
		)
		.orderBy(desc(pTable.num), asc(pTable.txt))
		.limit(accountsPerLoad);

	return {
		accounts: [],
	};
};
