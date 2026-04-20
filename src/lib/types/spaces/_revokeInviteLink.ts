import { tdb } from '$lib/server/db';
import { minute, week } from '$lib/time';
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
				pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
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
					and(
						pf.noAtId,
						pf.ms.lt(ms - 5 * minute),
						pf.code.eq(pc.otpMs_Pin_StrikeCountIdAndEmailTxt),
						pf.num.eq0,
					),
					and(
						pf.at_ms.gt0,
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						pf.ms.gt0,
						or(
							pf.ms.lt(ms - week),
							and(
								pf.by_ms.gt0, //
								pf.by_ms.lt(ms),
							),
						),
						pf.in_ms.eq0,
						pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
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
						pf.code.eq(pc.inviteIdAtExpiryMs_UseCount_MaxUsesIdAndNumAsRevokedMsAndSlugEndTxt),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			)
			.returning();
	}

	return {};
};
