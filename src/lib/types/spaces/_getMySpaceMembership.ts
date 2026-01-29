import { tdb } from '$lib/server/db';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import type { Membership } from '.';
import { assert1Row, assertLt2Rows, channelPartsByCode, type WhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';

export let _getMySpaceMembership = async (
	input: WhoWhereObj,
): Promise<{ membership: null | Membership }> => {
	let {
		[pc.acceptMsByMsAtInviteId]: acceptMsByMsAtInviteIdRows = [],
		[pc.canReactBinIdAtAccountId]: canReactBinIdAtAccountIdRows = [],
		[pc.canPostBinIdAtAccountId]: canPostBinIdAtAccountIdRows = [],
		[pc.promotionToModIdAtAccountId]: promotionToModIdAtAccountIdRows = [],
		[pc.promotionToOwnerIdAtAccountId]: promotionToOwnerIdAtAccountIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.at_in_ms.eq(input.spaceMs),
						pf.ms.gt0,
						pf.by_ms.eq(input.callerMs),
						pf.in_ms.eq0,
						pf.code.eq(pc.acceptMsByMsAtInviteId),
					),
					and(
						pf.msAsAtId(input.callerMs),
						pf.ms.gt0,
						pf.in_ms.eq(input.spaceMs),
						or(
							pf.code.eq(pc.canReactBinIdAtAccountId),
							pf.code.eq(pc.canPostBinIdAtAccountId),
							pf.code.eq(pc.promotionToModIdAtAccountId),
							pf.code.eq(pc.promotionToOwnerIdAtAccountId),
						),
					),
				),
			),
	);

	let acceptMsByMsAtInviteIdRow = assertLt2Rows(acceptMsByMsAtInviteIdRows);
	if (!acceptMsByMsAtInviteIdRow) return { membership: null };

	let canReactBinIdAtAccountIdRow = assert1Row(canReactBinIdAtAccountIdRows);
	let canPostBinIdAtAccountIdRow = assert1Row(canPostBinIdAtAccountIdRows);
	let promotionToModIdAtAccountIdRow = assertLt2Rows(promotionToModIdAtAccountIdRows);
	let promotionToOwnerIdAtAccountIdRow = assertLt2Rows(promotionToOwnerIdAtAccountIdRows);

	let membership: Membership = {
		invite: {
			by_ms: acceptMsByMsAtInviteIdRow.at_by_ms,
			in_ms: acceptMsByMsAtInviteIdRow.at_in_ms,
		},
		accept: {
			ms: acceptMsByMsAtInviteIdRow.ms,
			by_ms: acceptMsByMsAtInviteIdRow.by_ms,
		},
		canReactBin: {
			by_ms: canReactBinIdAtAccountIdRow.by_ms,
			ms: canReactBinIdAtAccountIdRow.by_ms,
			num: canReactBinIdAtAccountIdRow.num,
		},
		canPostBin: {
			by_ms: canPostBinIdAtAccountIdRow.by_ms,
			ms: canPostBinIdAtAccountIdRow.by_ms,
			num: canPostBinIdAtAccountIdRow.num,
		},
		promo: promotionToModIdAtAccountIdRow
			? {
					ms: promotionToModIdAtAccountIdRow.ms,
					by_ms: promotionToModIdAtAccountIdRow.by_ms,
				}
			: promotionToOwnerIdAtAccountIdRow
				? {
						owner: true,
						ms: promotionToOwnerIdAtAccountIdRow.ms,
						by_ms: promotionToOwnerIdAtAccountIdRow.by_ms,
					}
				: undefined,
	};

	return { membership };
};
