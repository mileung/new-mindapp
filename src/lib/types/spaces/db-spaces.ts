import { tdb } from '$lib/server/db';
import { and, sql } from 'drizzle-orm';
import { roleCodes } from '.';
import type { PartSelect } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';

// Had to separate this from spaces/index.ts cuz importing tdb was causing a circular import

export let moveSpaceMemberCountBy1 = async (spaceMs: number, increment: boolean) =>
	await tdb
		.update(pTable)
		.set({ p4: increment ? sql`${pTable.p4} + 1` : sql`${pTable.p4} - 1` })
		.where(
			and(
				pf.code.eq(pc._spaceDescription_imb_memberCount),
				pf.p1.eq(spaceMs), //
			),
		);

export let getAnotherAdminRow4i_accountMs_roleCode_mbRow = async (
	spaceMs: number,
	callerMs: number,
): Promise<undefined | PartSelect> =>
	(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc.i_accountMs_roleCode_mb),
					pf.p1.eq(spaceMs),
					pf.p2.notEq(callerMs),
					pf.p3.eq(roleCodes.admin),
				),
			)
			.limit(1)
	)[0];

export let getRow4i_accountMs_roleCode_mb = async (
	spaceMs: number,
	accountMs: number,
): Promise<undefined | PartSelect> =>
	(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc.i_accountMs_roleCode_mb),
					pf.p1.eq(spaceMs), //
					pf.p2.eq(accountMs),
				),
			)
			.limit(1)
	)[0];
