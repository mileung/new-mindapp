import { tdb } from '$lib/server/db';
import { type WhoObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { reducePartialAccountRows } from '.';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _getMyAccountUpdates = async (
	input: WhoObj & {
		emailMs: number;
		nameMs: number;
		bioMs: number;
		savedTagsMs: number;
		spaceMssMs: number;
	},
) => {
	let accountUpdates = reducePartialAccountRows(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.ms.gt(input.emailMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.accountEmailTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.id({ ms: input.nameMs }),
						pf.code.eq(pc.accountNameTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.id({ ms: input.bioMs }),
						pf.code.eq(pc.accountBioTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.ms.gt(input.savedTagsMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.accountSavedTagsTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						pf.atId({ at_ms: input.callerMs }),
						pf.ms.gt(input.spaceMssMs),
						pf.by_ms.eq0,
						pf.in_ms.eq0,
						pf.code.eq(pc.accountSpaceMssTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			),
	);

	return accountUpdates;
};
