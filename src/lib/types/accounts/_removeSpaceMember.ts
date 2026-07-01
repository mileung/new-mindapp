import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import {
	getAnotherAdminRow4i_accountMs_roleCode_mbRow,
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
		if (!(await getAnotherAdminRow4i_accountMs_roleCode_mbRow(spaceMs, callerMs)))
			throw new Error(m.assignAnotherAdminToLeaveThisSpace());
	}
	await moveSpaceMemberCountBy1(spaceMs, false);
	await tdb
		.delete(pTable)
		.where(
			and(
				or(
					pf.code.eq(pc.i_accountMs_accentCode_lastViewMs_sidePriority),
					pf.code.eq(pc.i_accountMs_roleCode_mb),
					pf.code.eq(pc.i_accountMs_permCode_mb),
					pf.code.eq(pc._flair_i_accountMs_mb),
					pf.code.eq(pc._apiKey_ibm_expiryMs),
					pf.code.eq(pc.acceptIbm_inviteMb),
				),
				pf.p1.eq(spaceMs),
				pf.p2.eq(accountMs),
			),
		);

	return {};
};
