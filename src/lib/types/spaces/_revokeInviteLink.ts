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
	let ms = Date.now();
	let updatedInviteRows = await tdb
		.update(pTable)
		.set({ num: ms })
		.where(
			and(
				or(
					pf.at_ms.eq0, //
					pf.at_ms.gt(ms),
				),
				pf.at_by_ms.gt0,
				pf.ms.eq(input.inviteMs),
				pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq(input.spaceMs),
				pf.code.eq(pc.inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd),
				pf.num.eq0,
				pf.txt.eq(input.slugEnd),
			),
		)
		.returning();

	console.log('updated revoked license');
	if (!updatedInviteRows.length) {
		console.log('deleting');
		await tdb
			.delete(pTable)
			.where(
				or(
					...getExpiredRowsFilters(ms),
					and(
						or(
							and(
								pf.at_ms.gt0, //
								pf.at_ms.lt(ms),
							),
							and(
								pf.ms.eq(input.inviteMs), //
								pf.txt.eq(input.slugEnd),
							),
						),
						pf.at_by_ms.eq0,
						pf.by_ms.gt0,
						pf.in_ms.gt0,
						pf.code.eq(pc.inviteId__expiryMs_useCount_maxUses_revokedMs_slugEnd),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			)
			.returning();
	}

	return {};
};
