import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import {
	getAnother_roleCodeNumIdAtAccountIdRow,
	moveSpaceMemberCountBy1,
} from '../spaces/db-spaces';

export let _removeSpaceMember = async (
	input: WhoWhereObj & {
		accountMs: number;
		callerRoleCodeNum: number;
	},
) => {
	let { callerRoleCodeNum, callerMs, spaceMs, accountMs } = input;
	if (callerRoleCodeNum === roleCodes.owner) {
		if (!(await getAnother_roleCodeNumIdAtAccountIdRow(spaceMs, callerMs)))
			throw new Error(m.assignAnotherOwnerToLeaveThisSpace());
	}
	await moveSpaceMemberCountBy1(spaceMs, false);
	await tdb.delete(pTable).where(
		or(
			and(
				pf.atId({ at_ms: accountMs }),
				pf.in_ms.eq(spaceMs),
				or(
					pf.code.eq(pc.roleCodeNumIdAtAccountId),
					pf.code.eq(pc.permissionCodeNumIdAtAccountId),
					pf.code.eq(pc.flairTxtIdAtAccountId),
					pf.code.eq(pc.spacePriorityIdAccentCodeNumAtAccountId),
				),
			),
			and(
				pf.at_in_ms.eq(spaceMs),
				pf.by_ms.eq(accountMs), //
				pf.code.eq(pc.acceptMsByMsAtInviteId),
			),
		),
	);

	return {};
};
