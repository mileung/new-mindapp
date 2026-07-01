import { tdb } from '$lib/server/db';
import type { PublicProfile } from '$lib/types/accounts';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
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
		// [pc._flair_i_accountMs_mb]: _flair_i_accountMs_mbRows = [],
		// [pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows = [],
		[pc.acceptIbm_inviteMb]: acceptIbm_inviteMbRows = [],
		[pc.accountMs_banMb]: accountMs_banMbRows = [],
		[pc._accountEmail_bm]: _accountEmail_bmRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
		[pc._accountBio_bm]: _accountBio_bmRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						or(
							ownerCalled ? pf.code.eq(pc._accountEmail_bm) : undefined,
							pf.code.eq(pc._accountName_bm),
							pf.code.eq(pc._accountBio_bm),
						),
						pf.p1.eq(input.profileMs),
					),
					input.profileMs !== input.callerMs &&
						(ownerCalled || input.possibleMutualSpaceMss?.length)
						? and(
								pf.code.eq(pc.acceptIbm_inviteMb),
								ownerCalled
									? undefined
									: or(...input.possibleMutualSpaceMss!.map((ms) => pf.p1.eq(ms))),
								or(
									pf.p2.eq(input.profileMs), //
									ownerCalled ? undefined : pf.p2.eq(input.callerMs),
								),
							)
						: undefined,
					and(
						pf.code.eq(pc.accountMs_banMb),
						pf.p1.eq(input.profileMs), //
					),
				),
			),
	);

	let _accountName_bmRow = assert1Row(_accountName_bmRows);
	let _accountBio_bmRow = assert1Row(_accountBio_bmRows);
	let mutualSpaceMsToJoinMsMap: undefined | Record<number, number>;

	if (acceptIbm_inviteMbRows.length) {
		let acceptIbm_inviteMbCallerRows: PartInsert[] = [];
		let acceptIbm_inviteMbProfileRows: PartInsert[] = [];
		for (let i = 0; i < acceptIbm_inviteMbRows.length; i++) {
			let acceptIbm_inviteMbRow = acceptIbm_inviteMbRows[i];
			(acceptIbm_inviteMbRow.p2 === input.callerMs
				? acceptIbm_inviteMbCallerRows
				: acceptIbm_inviteMbProfileRows
			).push(acceptIbm_inviteMbRow);
		}

		mutualSpaceMsToJoinMsMap = {};
		if (ownerCalled) {
			for (let i = 0; i < acceptIbm_inviteMbProfileRows.length; i++) {
				let acceptIbm_inviteMbProfileRow = acceptIbm_inviteMbProfileRows[i];
				let spaceMs = acceptIbm_inviteMbProfileRow.p1!;
				mutualSpaceMsToJoinMsMap[spaceMs] = acceptIbm_inviteMbProfileRow.p3!;
			}
		} else {
			for (let i = 0; i < acceptIbm_inviteMbCallerRows.length; i++) {
				let spaceMs = acceptIbm_inviteMbCallerRows[i].p1!;
				let acceptIbm_inviteMbProfileRow = acceptIbm_inviteMbProfileRows.find(
					(r) => r.p1 === spaceMs,
				);
				if (acceptIbm_inviteMbProfileRow) {
					mutualSpaceMsToJoinMsMap[spaceMs] = acceptIbm_inviteMbProfileRow.p3!;
				}
			}
		}
	}

	let accountMs_banMbRow = assertLt2Rows(accountMs_banMbRows);
	let bannerNameTxt = '';
	if (accountMs_banMbRow) {
		bannerNameTxt = assert1Row(
			await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pf.code.eq(pc._accountName_bm), //
						pf.p1.eq(accountMs_banMbRow.p2!),
					),
				),
		).txt!;
	}

	return {
		email: ownerCalled //
			? { txt: assert1Row(_accountEmail_bmRows).txt! }
			: undefined,
		banned: accountMs_banMbRow
			? { bannerNameTxt, ms: accountMs_banMbRow.p2!, by_ms: accountMs_banMbRow.p3! }
			: undefined,
		mutualSpaceMsToJoinMsMap,
		name: { txt: _accountName_bmRow.txt! },
		bio: { txt: _accountBio_bmRow.txt! },
	} satisfies Omit<PublicProfile, 'ms' | 'callerMsToMutualSpaceMsToJoinMsMap'> & {
		mutualSpaceMsToJoinMsMap?: Record<number, number>;
	};
};
