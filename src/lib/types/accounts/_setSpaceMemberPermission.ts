import { throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { getRow4i_accountMs_roleCode_mb } from '../spaces/db-spaces';

export let _setSpaceMemberPermission = async (
	{
		spaceMs,
		callerMs,
		accountMs,
		callerRoleCodeNum,
		newPermissionCodeNum,
	}: WhoWhereObj & {
		accountMs: number;
		callerRoleCodeNum?: number;
		newPermissionCodeNum: number;
	},
	ownerCalled: boolean,
) => {
	throwIf(callerMs === accountMs);

	let i_accountMs_roleCode_mbUpdateeRow = await getRow4i_accountMs_roleCode_mb(spaceMs, accountMs);
	!ownerCalled &&
		throwIf(
			!i_accountMs_roleCode_mbUpdateeRow || //
				callerRoleCodeNum! <= i_accountMs_roleCode_mbUpdateeRow.p3!,
		);

	let now = Date.now();
	await tdb
		.update(pTable)
		.set({
			p3: newPermissionCodeNum,
			p4: now,
			p5: callerMs,
		})
		.where(
			and(
				pf.code.eq(pc.i_accountMs_permCode_mb),
				pf.p1.eq(spaceMs), //
				pf.p2.eq(accountMs),
			),
		);
	return { ms: now };
};
