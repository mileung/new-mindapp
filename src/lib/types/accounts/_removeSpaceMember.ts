import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import {
	getAnotherAdmin_id__accountMs_roleCodeRow,
	moveSpaceMemberCountBy1,
} from '../spaces/db-spaces';

export let _removeSpaceMember = async (
	input: WhoWhereObj & {
		accountMs: number;
		callerRoleCodeNum?: number;
	},
	ownerCalled: boolean,
) => {
	let { callerRoleCodeNum, callerMs, spaceMs, accountMs } = input;
	if (!ownerCalled && callerRoleCodeNum === roleCodes.admin) {
		if (!(await getAnotherAdmin_id__accountMs_roleCodeRow(spaceMs, callerMs)))
			throw new Error(m.assignAnotherAdminToLeaveThisSpace());
	}
	await moveSpaceMemberCountBy1(spaceMs, false);
	await tdb.delete(pTable).where(
		or(
			and(
				pf.atId({ at_ms: accountMs }),
				pf.in_ms.eq(spaceMs),
				or(
					pf.code.eq(pc.id__accountMs_roleCode),
					pf.code.eq(pc.id__accountMs_permissionCode),
					pf.code.eq(pc.id__accountMs__flair),
					pf.code.eq(pc.spacePriorityId__accountMs_accentCode),
				),
			),
			and(
				pf.at_in_ms.eq(spaceMs),
				pf.by_ms.eq(accountMs), //
				pf.code.eq(pc.acceptMsByMs__inviteId),
			),
		),
	);

	return {};
};
