import { tdb } from '$lib/server/db';
import { throwIf } from '$lib/server/errors';
import { type PartSelect, type WhoWhereObj } from '$lib/types/parts';
import { pTable } from '$lib/types/parts/partsTable';
import { and } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { roleCodes } from '../spaces';
import { getAnother_roleCodeNumIdAtAccountIdRow } from '../spaces/db-spaces';

export let _setSpaceMemberRole = async ({
	spaceMs,
	callerMs,
	callerRoleCodeNum,
	accountMs,
	newRoleCodeNum,
}: WhoWhereObj & {
	callerRoleCodeNum: number;
	accountMs: number;
	newRoleCodeNum: number;
}) => {
	let updateeRoleRowFilter = and(
		pf.atId({ at_ms: accountMs }),
		pf.in_ms.eq(spaceMs),
		pf.code.eq(pc.roleCodeNumIdAtAccountId),
	);
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
	let callerIsOwner = callerRoleCodeNum === roleCodes.owner;

	let updateeIsMod = updateeRoleCodeNum === roleCodes.mod;
	let updateeIsMember = updateeRoleCodeNum === roleCodes.member;

	let toMember = newRoleCodeNum === roleCodes.member;
	let toMod = newRoleCodeNum === roleCodes.mod;
	let toOwner = newRoleCodeNum === roleCodes.owner;

	throwIf(
		updateeRoleCodeNum === undefined ||
			updateeRoleCodeNum === newRoleCodeNum ||
			callerRoleCodeNum < updateeRoleCodeNum,
	);
	let ok = false;

	if (updatingSelf) {
		if (callerIsMod && toMember) ok = true;
		if (callerIsOwner && toMod) {
			let another_roleCodeNumIdAtAccountIdRow = await getAnother_roleCodeNumIdAtAccountIdRow(
				spaceMs,
				callerMs,
			);
			ok = !!another_roleCodeNumIdAtAccountIdRow;
		}
	} else {
		if (callerIsOwner) {
			if (updateeIsMod && (toMember || toOwner)) ok = true;
			if (updateeIsMember && toMod) ok = true;
		}
	}

	throwIf(!ok);
	let ms = Date.now();
	await tdb
		.update(pTable)
		.set({
			ms,
			by_ms: callerMs,
			num: newRoleCodeNum,
		})
		.where(updateeRoleRowFilter);
	return { ms };
};
