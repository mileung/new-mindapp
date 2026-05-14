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
		[pc.msByMs__accountEmail]: msByMs__accountEmailRows = [],
		[pc.msByMs__accountName]: msByMs__accountNameRows = [],
		[pc.msByMs__accountBio]: msByMs__accountBioRows = [],
		[pc.acceptMsByMs__inviteId]: acceptMsByMs__inviteIdRows = [],
		[pc.banMsByMs__accountMs]: banMsByMs__accountMsRows = [],
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
							ownerCalled ? pf.code.eq(pc.msByMs__accountEmail) : undefined,
							pf.code.eq(pc.msByMs__accountName),
							pf.code.eq(pc.msByMs__accountBio),
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
								pf.code.eq(pc.acceptMsByMs__inviteId),
								pf.num.isNull,
								pf.txt.isNull,
							)
						: undefined,
					and(
						pf.atId({ at_ms: input.profileMs }),
						pf.ms.gt0,
						pf.by_ms.gt0,
						pf.in_ms.eq0,
						pf.code.eq(pc.banMsByMs__accountMs),
						pf.num.isNull,
						pf.txt.isNull,
					),
				),
			),
	);

	let msByMs__accountNameRow = assert1Row(msByMs__accountNameRows);
	let msByMs__accountBioRow = assert1Row(msByMs__accountBioRows);
	let mutualSpaceMsToJoinMsMap: undefined | Record<number, number>;

	if (acceptMsByMs__inviteIdRows.length) {
		let caller_acceptMsByMs__inviteIdRows: PartSelect[] = [];
		let profile_acceptMsByMs__inviteIdRows: PartSelect[] = [];
		for (let i = 0; i < acceptMsByMs__inviteIdRows.length; i++) {
			let acceptMsByMs__inviteIdRow = acceptMsByMs__inviteIdRows[i];
			(acceptMsByMs__inviteIdRow.by_ms === input.callerMs
				? caller_acceptMsByMs__inviteIdRows
				: profile_acceptMsByMs__inviteIdRows
			).push(acceptMsByMs__inviteIdRow);
		}

		mutualSpaceMsToJoinMsMap = {};
		if (ownerCalled) {
			for (let i = 0; i < profile_acceptMsByMs__inviteIdRows.length; i++) {
				let profile_acceptMsByMs__inviteIdRow = profile_acceptMsByMs__inviteIdRows[i];
				let spaceMs = profile_acceptMsByMs__inviteIdRow.at_in_ms;
				mutualSpaceMsToJoinMsMap[spaceMs] = profile_acceptMsByMs__inviteIdRow.ms;
			}
		} else {
			for (let i = 0; i < caller_acceptMsByMs__inviteIdRows.length; i++) {
				let spaceMs = caller_acceptMsByMs__inviteIdRows[i].at_in_ms;
				let profile_acceptMsByMs__inviteIdRow = profile_acceptMsByMs__inviteIdRows.find(
					(r) => r.at_in_ms === spaceMs,
				);
				if (profile_acceptMsByMs__inviteIdRow) {
					mutualSpaceMsToJoinMsMap[spaceMs] = profile_acceptMsByMs__inviteIdRow.ms;
				}
			}
		}
	}

	let banMsByMs__accountMsRow = assertLt2Rows(banMsByMs__accountMsRows);
	let bannerNameTxt = '';
	if (banMsByMs__accountMsRow) {
		let owner_msByMs__accountNameRows = await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.noAtId,
					pf.ms.gt0,
					pf.by_ms.eq(banMsByMs__accountMsRow.by_ms),
					pf.in_ms.eq0,
					pf.code.eq(pc.msByMs__accountName),
					pf.num.isNull,
					pf.txt.isNotNull,
				),
			);
		bannerNameTxt = assert1Row(owner_msByMs__accountNameRows).txt!;
	}

	return {
		email: ownerCalled //
			? { txt: assert1Row(msByMs__accountEmailRows).txt! }
			: undefined,
		banned: banMsByMs__accountMsRow
			? { bannerNameTxt, ms: banMsByMs__accountMsRow.ms, by_ms: banMsByMs__accountMsRow.by_ms }
			: undefined,
		mutualSpaceMsToJoinMsMap,
		name: { txt: msByMs__accountNameRow.txt! },
		bio: { txt: msByMs__accountBioRow.txt! },
	} satisfies Omit<PublicProfile, 'ms' | 'callerMsToMutualSpaceMsToJoinMsMap'> & {
		mutualSpaceMsToJoinMsMap?: Record<number, number>;
	};
};
