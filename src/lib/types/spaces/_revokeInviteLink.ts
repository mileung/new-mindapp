import { tdb } from '$lib/server/db';
import { getExpiredRowsFilters } from '$lib/server/sessions';
import { and, or } from 'drizzle-orm';
import { type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let _revokeInviteLink = async (
	input: WhoWhereObj & {
		inviteMs: number;
		slugEnd: string;
	},
) => {
	let now = Date.now();
	let updatedInviteRows = await tdb
		.update(pTable)
		.set({ p7: now })
		.where(
			and(
				pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),
				pf.txt.eq(input.slugEnd),
				pf.p1.eq(input.spaceMs),
				pf.p2.eq(input.callerMs),
				pf.p3.eq(input.inviteMs),
				or(
					pf.p4.eq0, //
					pf.p4.gt(now),
				),
				pf.p5.gt0,
				pf.p7.eq0,
			),
		)
		.returning();

	if (!updatedInviteRows.length) {
		await tdb
			.delete(pTable)
			.where(
				or(
					...getExpiredRowsFilters(now),
					and(
						pf.code.eq(pc._slugEnd_inviteIbm_expiryMs_useCount_maxUses_revokedMs),
						pf.txt.eq(input.slugEnd),
						pf.p1.eq(input.spaceMs),
						pf.p2.eq(input.callerMs),
						pf.p3.eq(input.inviteMs),
						or(
							pf.p4.eq0, //
							pf.p4.gt(now),
						),
						pf.p5.eq0,
						pf.p7.eq0,
					),
				),
			)
			.returning();
	}

	return {};
};
