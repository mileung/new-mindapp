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
		[pc.acceptBm_inviteIbm]: acceptBm_inviteIbmRows = [],
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
								pf.code.eq(pc.acceptBm_inviteIbm),
								or(
									pf.p1.eq(input.profileMs), //
									ownerCalled ? undefined : pf.p1.eq(input.callerMs),
								),
								ownerCalled
									? undefined
									: or(...input.possibleMutualSpaceMss!.map((ms) => pf.p3.eq(ms))),
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

	if (acceptBm_inviteIbmRows.length) {
		let acceptBm_inviteIbmCallerRows: PartInsert[] = [];
		let acceptBm_inviteIbmProfileRows: PartInsert[] = [];
		for (let i = 0; i < acceptBm_inviteIbmRows.length; i++) {
			let acceptBm_inviteIbmRow = acceptBm_inviteIbmRows[i];
			(acceptBm_inviteIbmRow.p1 === input.callerMs
				? acceptBm_inviteIbmCallerRows
				: acceptBm_inviteIbmProfileRows
			).push(acceptBm_inviteIbmRow);
		}

		mutualSpaceMsToJoinMsMap = {};
		if (ownerCalled) {
			for (let i = 0; i < acceptBm_inviteIbmProfileRows.length; i++) {
				let acceptBm_inviteIbmProfileRow = acceptBm_inviteIbmProfileRows[i];
				let spaceMs = acceptBm_inviteIbmProfileRow.p3!;
				mutualSpaceMsToJoinMsMap[spaceMs] = acceptBm_inviteIbmProfileRow.p2!;
			}
		} else {
			for (let i = 0; i < acceptBm_inviteIbmCallerRows.length; i++) {
				let spaceMs = acceptBm_inviteIbmCallerRows[i].p3!;
				let acceptBm_inviteIbmProfileRow = acceptBm_inviteIbmProfileRows.find(
					(r) => r.p3 === spaceMs,
				);
				if (acceptBm_inviteIbmProfileRow) {
					mutualSpaceMsToJoinMsMap[spaceMs] = acceptBm_inviteIbmProfileRow.p2!;
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
