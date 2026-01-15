import { tdb } from '$lib/server/db';
import { type WhoObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { reduceAccountRows } from '.';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _getMyAccountUpdates = async (
	input: WhoObj & {
		emailMs: number;
		nameMs: number;
		bioMs: number;
		savedTagsMs: number;
		// spaceMssMs: number;
	},
) => {
	let accountUpdates = reduceAccountRows(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.at_ms.eq(input.callerMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt(input.emailMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.emailTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(input.callerMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt(input.nameMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.nameTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(input.callerMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt(input.bioMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.bioTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.at_ms.eq(input.callerMs),
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt(input.savedTagsMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.savedTagsTxtMsAtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			),
	);

	return accountUpdates;
};
