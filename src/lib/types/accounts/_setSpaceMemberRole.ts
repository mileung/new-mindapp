import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { assert1Row, type PartSelect, type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { permissionCodes, roleCodes } from '../spaces';
import { getAnotherAdmin_roleCodeNumIdAtAccountIdRow } from '../spaces/db-spaces';

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
	let updateeRoleRowFilter = and(
		pf.atId({ at_ms: accountMs }),
		pf.ms.gt0,
		pf.in_ms.eq(spaceMs),
		pf.code.eq(pc.roleCodeNumIdAtAccountId),
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
							.where(updateeRoleRowFilter)
					)[0] as undefined | PartSelect
				)?.num;

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
				let another_roleCodeNumIdAtAccountIdRow = await getAnotherAdmin_roleCodeNumIdAtAccountIdRow(
					spaceMs,
					callerMs,
				);
				ok = !!another_roleCodeNumIdAtAccountIdRow;
			}
		} else if (callerIsAdmin) {
			if (updateeIsMod && (toMember || toAdmin)) ok = true;
			if (updateeIsMember && toMod) ok = true;
		}
		throwIf(!ok);
	}

	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({
			ms,
			by_ms: callerMs,
			num: newRoleCodeNum,
		})
		.where(updateeRoleRowFilter);

	let reactAndPostSetBySystem: undefined | true;
	if (toAdmin) {
		let updateePermissionRowFilter = and(
			pf.atId({ at_ms: accountMs }),
			pf.ms.gt0,
			pf.in_ms.eq(spaceMs),
			pf.code.eq(pc.permissionCodeNumIdAtAccountId),
		);
		let updateePermissionRow = assert1Row(
			await tdb //
				.select()
				.from(pTable)
				.where(updateePermissionRowFilter),
		);
		if (updateePermissionRow.num !== permissionCodes.reactAndPost) {
			reactAndPostSetBySystem = true;
			await tdb
				.update(pTable)
				.set({
					ms,
					by_ms: 0,
					num: permissionCodes.reactAndPost,
				})
				.where(updateePermissionRowFilter);
		}
	}
	return { ms, reactAndPostSetBySystem };
};
