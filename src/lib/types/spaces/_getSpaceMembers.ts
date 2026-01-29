import type { Database } from '$lib/local-db';
import { and, or } from 'drizzle-orm';
import type { Membership } from '.';
import { channelPartsByCode, type PartSelect, type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

export let membersPerLoad = 88;

export let _getSpaceMembers = async (
	db: Database,
	input: WhoWhereObj & {
		fromMs?: number;
	},
) => {
	let getMyInviteLinks = input.fromMs === undefined;

	let acceptMsByMsAtInviteIdRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.at_in_ms.eq(input.spaceMs),
				pf.ms.lte(input.fromMs || Number.MAX_SAFE_INTEGER),
				// pf.by_ms.eq(input.callerMs),
				pf.in_ms.eq0,
				pf.code.eq(pc.acceptMsByMsAtInviteId),
				pf.num.eq0,
				pf.txt.isNull,
			),
		)
		.orderBy(pf.ms.desc)
		.limit(membersPerLoad);

	// TODO: sort all owners and mods to the top

	let {
		[pc.canReactBinIdAtAccountId]: canReactBinIdAtAccountIdRows = [],
		[pc.canPostBinIdAtAccountId]: canPostBinIdAtAccountIdRows = [],
		[pc.promotionToModIdAtAccountId]: promotionToModIdAtAccountIdRows = [],
		[pc.promotionToOwnerIdAtAccountId]: promotionToOwnerIdAtAccountIdRows = [],
		[pc.nameTxtMsAtAccountId]: nameTxtMsAtAccountIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						or(
							...acceptMsByMsAtInviteIdRows.map((r) =>
								pf.atId({
									at_ms: r.at_by_ms,
									at_by_ms: 0,
									at_in_ms: 0,
								}),
							),
						),
						pf.code.eq(pc.nameTxtMsAtAccountId),
					),
					and(
						or(
							...acceptMsByMsAtInviteIdRows.map((r) =>
								pf.atId({
									at_ms: r.by_ms,
									at_by_ms: 0,
									at_in_ms: 0,
								}),
							),
						),
						or(
							and(
								pf.in_ms.eq(input.spaceMs),
								or(
									pf.code.eq(pc.canReactBinIdAtAccountId),
									pf.code.eq(pc.canPostBinIdAtAccountId),
									pf.code.eq(pc.promotionToModIdAtAccountId),
									pf.code.eq(pc.promotionToOwnerIdAtAccountId),
								),
							),
							and(
								pf.by_ms.eq0,
								pf.in_ms.eq0, //
								pf.code.eq(pc.nameTxtMsAtAccountId),
							),
						),
					),
				),
			),
	);

	let msToAccountNameMap: Record<number, string> = {};
	for (let i = 0; i < nameTxtMsAtAccountIdRows.length; i++) {
		let { txt, at_ms } = nameTxtMsAtAccountIdRows[i];
		msToAccountNameMap[at_ms] = txt!;
	}
	let mapByAtMs = (rows: PartSelect[]) => {
		let map: Record<number, PartSelect> = {};
		for (let row of rows) map[row.at_ms] = row;
		return map;
	};
	let accountMsToCanReactBinIdMap = mapByAtMs(canReactBinIdAtAccountIdRows);
	let accountMsToCanPostBinIdMap = mapByAtMs(canPostBinIdAtAccountIdRows);
	let accountMsToPromotionToModIdMap = mapByAtMs(promotionToModIdAtAccountIdRows);
	let accountMsToPromotionToOwnerIdMap = mapByAtMs(promotionToOwnerIdAtAccountIdRows);

	let memberships: Membership[] = acceptMsByMsAtInviteIdRows.map((acceptMsByMsAtInviteIdRow) => {
		let accountMs = acceptMsByMsAtInviteIdRow.by_ms;
		return {
			invite: {
				by_ms: acceptMsByMsAtInviteIdRow.at_by_ms,
				in_ms: acceptMsByMsAtInviteIdRow.at_in_ms,
			},
			accept: {
				ms: acceptMsByMsAtInviteIdRow.ms,
				by_ms: accountMs,
			},
			canPostBin: {
				num: accountMsToCanPostBinIdMap[accountMs].num,
				ms: accountMsToCanPostBinIdMap[accountMs].ms,
				by_ms: accountMsToCanPostBinIdMap[accountMs].by_ms,
			},
			canReactBin: {
				num: accountMsToCanReactBinIdMap[accountMs].num,
				ms: accountMsToCanReactBinIdMap[accountMs].ms,
				by_ms: accountMsToCanReactBinIdMap[accountMs].by_ms,
			},
			promo: accountMsToPromotionToModIdMap[accountMs]
				? {
						ms: accountMsToPromotionToModIdMap[accountMs].ms,
						by_ms: accountMsToPromotionToModIdMap[accountMs].by_ms,
					}
				: accountMsToPromotionToOwnerIdMap[accountMs]
					? {
							owner: true,
							ms: accountMsToPromotionToOwnerIdMap[accountMs].ms,
							by_ms: accountMsToPromotionToOwnerIdMap[accountMs].by_ms,
						}
					: undefined,
		};
	});

	let settingIdRows = [
		...promotionToModIdAtAccountIdRows,
		...promotionToOwnerIdAtAccountIdRows,
		...canPostBinIdAtAccountIdRows,
		...canReactBinIdAtAccountIdRows,
	];
	let missingNameAccountMss = [];
	for (let i = 0; i < settingIdRows.length; i++) {
		let promoIdRow = settingIdRows[i];
		if (promoIdRow.by_ms && !msToAccountNameMap[promoIdRow.by_ms]) {
			missingNameAccountMss.push(promoIdRow.by_ms);
		}
	}
	if (missingNameAccountMss.length) {
		let nameTxtMsAtAccountIdRows2 = await db
			.select()
			.from(pTable)
			.where(
				and(
					or(
						...missingNameAccountMss.map((ms) =>
							pf.atId({
								at_ms: ms,
								at_by_ms: 0,
								at_in_ms: 0,
							}),
						),
					),
					pf.by_ms.eq0,
					pf.in_ms.eq0,
					pf.code.eq(pc.nameTxtMsAtAccountId),
				),
			);
		for (let i = 0; i < nameTxtMsAtAccountIdRows2.length; i++) {
			let { txt, at_ms } = nameTxtMsAtAccountIdRows2[i];
			msToAccountNameMap[at_ms] = txt!;
		}
	}

	return {
		memberships,
		msToAccountNameMap,
	};
};
