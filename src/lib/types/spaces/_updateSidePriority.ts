import { tdb } from '$lib/server/db';
import { and, or } from 'drizzle-orm';
import { type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _updateSidePriority = async (
	input: WhoObj & {
		spaceMsToSidePriorityMap: Record<string, number>;
	},
) => {
	let acceptBm_inviteIbmRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc.acceptBm_inviteIbm),
				pf.p1.eq(input.callerMs),
				pf.p3.notEq(1),
				or(...Object.keys(input.spaceMsToSidePriorityMap).map((k) => pf.p3.eq(+k))),
			),
		);
	await Promise.all(
		acceptBm_inviteIbmRows.map((r) =>
			tdb
				.update(pTable)
				.set({ p5: input.spaceMsToSidePriorityMap[r.p3!] })
				.where(
					and(
						pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
						pf.p1.eq(r.p3!),
						pf.p2.eq(input.callerMs),
					),
				),
		),
	);
	return {};
};
