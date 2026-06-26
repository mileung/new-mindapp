import { tdb } from '$lib/server/db';
import { and } from 'drizzle-orm';
import { type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _updateSidePriority = async (
	input: WhoObj & {
		spaceMsToSidePriorityMap: Record<string, number>;
	},
) => {
	await Promise.all(
		Object.entries(input.spaceMsToSidePriorityMap)
			.slice(0, 8888)
			.map(([msStr, sidePriority]) =>
				tdb
					.update(pTable)
					.set({ p5: sidePriority })
					.where(
						and(
							pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
							pf.p1.eq(+msStr),
							pf.p2.eq(input.callerMs),
						),
					),
			),
	);
	return {};
};
