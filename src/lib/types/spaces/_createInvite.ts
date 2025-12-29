import { ranStr } from '$lib/js';
import { tdb } from '$lib/server/db';
import { and, asc, desc } from 'drizzle-orm';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let inviteLinksPerLoad = 88;

export let _createInvite = async (
	input: WhoWhereObj & {
		validFor: number;
		maxUses: number;
	},
) => {
	let inviteSlug = ranStr(42);
	console.log('inviteSlug:', inviteSlug);

	if (false) {
		let tagIdAndTxtWithNumAsCountRows = await tdb
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
				),
			)
			.orderBy(desc(pTable.num), asc(pTable.txt));
	}

	return { inviteSlug };
};
