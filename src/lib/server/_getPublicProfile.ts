import { tdb } from '$lib/server/db';
import type { PublicProfile } from '$lib/types/accounts';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartSelect,
	type WhoObj,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';

export let _getPublicProfile = async (
	input: WhoObj & { profileMs: number; possibleMutualSpaceMss?: number[] },
	ownerCalled: boolean,
) => {
	let {
		[pc.accountEmailTxtMsByMs]: accountEmailTxtMsByMsRows = [],
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
		[pc.accountBioTxtMsByMs]: accountBioTxtMsByMsRows = [],
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
		[pc.banMsByMsAtAccountId]: banMsByMsAtAccountIdRows = [],
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
							ownerCalled ? pf.code.eq(pc.accountEmailTxtMsByMs) : undefined,
							pf.code.eq(pc.accountNameTxtMsByMs),
							pf.code.eq(pc.accountBioTxtMsByMs),
						),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
					input.profileMs !== input.callerMs &&
						(ownerCalled || input.possibleMutualSpaceMss?.length)
						? and(
								pf.ms.gt0,
								or(
									pf.by_ms.eq(input.profileMs),
									ownerCalled ? undefined : pf.by_ms.eq(input.callerMs),
								),
								ownerCalled
									? undefined
									: or(...input.possibleMutualSpaceMss!.map((ms) => pf.at_in_ms.eq(ms))),
								pf.code.eq(pc.acceptMsByMsAtInviteId),
								pf.num.isNull,
								pf.txt.isNull,
							)
						: undefined,
					and(
						pf.atId({ at_ms: input.profileMs }),
						pf.ms.gt0,
						pf.by_ms.gt0,
						pf.in_ms.eq0,
						pf.code.eq(pc.banMsByMsAtAccountId),
						pf.num.isNull,
						pf.txt.isNull,
					),
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
		if (ownerCalled) {
			for (let i = 0; i < profile_acceptMsByMsAtInviteIdRows.length; i++) {
				let profile_acceptMsByMsAtInviteIdRow = profile_acceptMsByMsAtInviteIdRows[i];
				let spaceMs = profile_acceptMsByMsAtInviteIdRow.at_in_ms;
				mutualSpaceMsToJoinMsMap[spaceMs] = profile_acceptMsByMsAtInviteIdRow.ms;
			}
		} else {
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
	}

	let banMsByMsAtAccountIdRow = assertLt2Rows(banMsByMsAtAccountIdRows);
	let bannerNameTxt = '';
	if (banMsByMsAtAccountIdRow) {
		let owner_accountNameTxtMsByMsRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.eq(banMsByMsAtAccountIdRow.by_ms),
					pf.in_ms.eq0,
					pf.code.eq(pc.accountNameTxtMsByMs),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
		bannerNameTxt = assert1Row(owner_accountNameTxtMsByMsRows).txt!;
	}

	return {
		email: ownerCalled //
			? { txt: assert1Row(accountEmailTxtMsByMsRows).txt! }
			: undefined,
		banned: banMsByMsAtAccountIdRow
			? { bannerNameTxt, ms: banMsByMsAtAccountIdRow.ms, by_ms: banMsByMsAtAccountIdRow.by_ms }
			: undefined,
		mutualSpaceMsToJoinMsMap,
		name: { txt: accountNameTxtMsByMsRow.txt! },
		bio: { txt: accountBioTxtMsByMsRow.txt! },
	} satisfies Omit<PublicProfile, 'ms' | 'callerMsToMutualSpaceMsToJoinMsMap'> & {
		mutualSpaceMsToJoinMsMap?: Record<number, number>;
	};
};
