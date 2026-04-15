import { tdb } from '$lib/server/db';
import type { PublicProfile } from '$lib/types/accounts';
import { assertLt2Rows, channelPartsByCode, type WhoObj } from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';

export let _getPublicProfile = async (
	input: WhoObj & { profileMs: number; possibleMutualSpaceMss?: number[] },
) => {
	let {
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
		[pc.accountBioTxtMsByMs]: accountBioTxtMsByMsRows = [],
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.noAtId,
						pf.ms.gt0,
						pf.by_ms.eq(input.profileMs),
						pf.in_ms.eq0,
						or(pf.code.eq(pc.accountNameTxtMsByMs), pf.code.eq(pc.accountBioTxtMsByMs)),
						pf.num.eq0,
					),
					input.possibleMutualSpaceMss?.length
						? and(
								or(...input.possibleMutualSpaceMss.map((ms) => pf.at_in_ms.eq(ms))),
								pf.ms.gt0,
								or(
									pf.by_ms.eq(input.profileMs),
									pf.by_ms.eq(input.callerMs), //
								),
								pf.in_ms.eq0,
								pf.code.eq(pc.acceptMsByMsAtInviteId),
								pf.num.eq0,
								pf.txt.isNull,
							)
						: undefined,
				),
			),
	);

	let accountNameTxtMsByMsRow = assertLt2Rows(accountNameTxtMsByMsRows);
	let accountBioTxtMsByMsRow = assertLt2Rows(accountBioTxtMsByMsRows);
	let mutualSpaceMss: number[] = [];

	if (accountNameTxtMsByMsRow && accountBioTxtMsByMsRow) {
		let callerJoinedSpaceMss: number[] = [];
		let profileJoinedSpaceMss: number[] = [];

		if (acceptMsByMsAtInviteIdRows.length) {
			for (let i = 0; i < acceptMsByMsAtInviteIdRows.length; i++) {
				let acceptMsByMsAtInviteIdRow = acceptMsByMsAtInviteIdRows[i];
				(acceptMsByMsAtInviteIdRow.by_ms === input.callerMs
					? callerJoinedSpaceMss
					: profileJoinedSpaceMss
				).push(acceptMsByMsAtInviteIdRow.in_ms);
			}
			mutualSpaceMss = callerJoinedSpaceMss.filter((ms) => profileJoinedSpaceMss.includes(ms));
		}

		return {
			mutualSpaceMss,
			ms: accountNameTxtMsByMsRow.by_ms,
			name: { txt: accountNameTxtMsByMsRow.txt! },
			bio: { txt: accountBioTxtMsByMsRow.txt! },
		} satisfies PublicProfile;
	}
};
