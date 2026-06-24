import { throwIf } from '$lib/js';
import { tdb } from '$lib/server/db';
import { assert1Row, type PartSelect, type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { permissionCodes, roleCodes } from '../spaces';
import { getAnotherAdminRow4i_accountMs_roleCode_mbRow } from '../spaces/db-spaces';

export let _setSpaceMemberRole = async (
	{
		spaceMs,
		callerMs,
		callerRoleCodeNum,
		accountMs,
		newRoleCodeNum,
	}: WhoWhereObj & {
		callerRoleCodeNum?: number;
		accountMs: number;
		newRoleCodeNum: number;
	},
	ownerCalled: boolean,
) => {
	let i_accountMs_roleCode_mbFilter = and(
		pf.code.eq(pc.i_accountMs_roleCode_mb),
		pf.p1.eq(spaceMs),
		pf.p2.eq(accountMs),
	);
	let toMember = newRoleCodeNum === roleCodes.member;
	let toMod = newRoleCodeNum === roleCodes.mod;
	let toAdmin = newRoleCodeNum === roleCodes.admin;

	if (!ownerCalled) {
		let updatingSelf = callerMs === accountMs;
		let updateeRoleCodeNum = updatingSelf
			? callerRoleCodeNum
			: (
					(
						await tdb //
							.select()
							.from(pTable)
							.where(i_accountMs_roleCode_mbFilter)
					)[0] as undefined | PartSelect
				)?.p3!;

		let callerIsMod = callerRoleCodeNum === roleCodes.mod;
		let callerIsAdmin = callerRoleCodeNum === roleCodes.admin;

		let updateeIsMod = updateeRoleCodeNum === roleCodes.mod;
		let updateeIsMember = updateeRoleCodeNum === roleCodes.member;

		throwIf(
			updateeRoleCodeNum === undefined ||
				updateeRoleCodeNum === newRoleCodeNum ||
				callerRoleCodeNum! < updateeRoleCodeNum,
		);
		let ok = false;

		if (updatingSelf) {
			if (callerIsMod && toMember) ok = true;
			if (callerIsAdmin && toMod) {
				let another_i_accountMs_roleCode_mbRow =
					await getAnotherAdminRow4i_accountMs_roleCode_mbRow(spaceMs, callerMs);
				ok = !!another_i_accountMs_roleCode_mbRow;
			}
		} else if (callerIsAdmin) {
			if (updateeIsMod && (toMember || toAdmin)) ok = true;
			if (updateeIsMember && toMod) ok = true;
		}
		throwIf(!ok);
	}

	let now = Date.now();
	await tdb
		.update(pTable)
		.set({
			p3: newRoleCodeNum,
			p4: now,
			p5: callerMs,
		})
		.where(i_accountMs_roleCode_mbFilter);

	let reactAndPostSetBySystem: undefined | true;
	if (toAdmin) {
		let i_accountMs_permCode_mbFilter = and(
			pf.code.eq(pc.i_accountMs_permCode_mb),
			pf.p1.eq(spaceMs),
			pf.p2.eq(accountMs),
		);
		let i_accountMs_permCode_mbFilterUpdateeRow = assert1Row(
			await tdb //
				.select()
				.from(pTable)
				.where(i_accountMs_permCode_mbFilter),
		);
		if (i_accountMs_permCode_mbFilterUpdateeRow.p3 !== permissionCodes.reactAndPost) {
			reactAndPostSetBySystem = true;
			await tdb
				.update(pTable)
				.set({
					p3: permissionCodes.reactAndPost,
					p4: now,
					p5: 0,
				})
				.where(i_accountMs_permCode_mbFilter);
		}
	}
	return { ms: now, reactAndPostSetBySystem };
};
