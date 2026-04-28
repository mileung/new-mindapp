import { tdb } from '$lib/server/db';
import { assert1Row, channelPartsByCode, type PartSelect, type WhoObj } from '$lib/types/parts';
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
						or(
							pf.code.eq(pc.accountNameTxtMsByMs),
							pf.code.eq(pc.accountBioTxtMsByMs), //
						),
						pf.num.eq0,
					),
					input.profileMs !== input.callerMs && input.possibleMutualSpaceMss?.length
						? and(
								pf.ms.gt0,
								or(
									pf.by_ms.eq(input.profileMs),
									pf.by_ms.eq(input.callerMs), //
								),
								or(...input.possibleMutualSpaceMss.map((ms) => pf.at_in_ms.eq(ms))),
								pf.code.eq(pc.acceptMsByMsAtInviteId),
								pf.num.eq0,
								pf.txt.isNull,
							)
						: undefined,
				),
			),
	);

	let accountNameTxtMsByMsRow = assert1Row(accountNameTxtMsByMsRows);
	let accountBioTxtMsByMsRow = assert1Row(accountBioTxtMsByMsRows);
	let mutualSpaceMsToJoinMsMap: undefined | Record<number, number>;

	if (acceptMsByMsAtInviteIdRows.length) {
		let caller_acceptMsByMsAtInviteIdRows: PartSelect[] = [];
		let profile_acceptMsByMsAtInviteIdRows: PartSelect[] = [];
		for (let i = 0; i < acceptMsByMsAtInviteIdRows.length; i++) {
			let acceptMsByMsAtInviteIdRow = acceptMsByMsAtInviteIdRows[i];
			(acceptMsByMsAtInviteIdRow.by_ms === input.callerMs
				? caller_acceptMsByMsAtInviteIdRows
				: profile_acceptMsByMsAtInviteIdRows
			).push(acceptMsByMsAtInviteIdRow);
		}
		mutualSpaceMsToJoinMsMap = {};
		for (let i = 0; i < caller_acceptMsByMsAtInviteIdRows.length; i++) {
			let spaceMs = caller_acceptMsByMsAtInviteIdRows[i].at_in_ms;
			let profile_acceptMsByMsAtInviteIdRow = profile_acceptMsByMsAtInviteIdRows.find(
				(r) => r.at_in_ms === spaceMs,
			);
			if (profile_acceptMsByMsAtInviteIdRow) {
				mutualSpaceMsToJoinMsMap[spaceMs] = profile_acceptMsByMsAtInviteIdRow.ms;
			}
		}
	}

	return {
		mutualSpaceMsToJoinMsMap,
		name: { txt: accountNameTxtMsByMsRow.txt! },
		bio: { txt: accountBioTxtMsByMsRow.txt! },
	};
};
