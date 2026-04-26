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
		.set({ num: increment ? sql`${pTable.num} + 1` : sql`${pTable.num} - 1` })
		.where(
			and(
				pf.noAtId, //
				pf.in_ms.eq(spaceMs),
				pf.code.eq(pc.spaceDescriptionTxtIdAndMemberCountNum),
			),
		);

export let getAnother_roleCodeNumIdAtAccountIdRow = async (
	spaceMs: number,
	callerMs: number,
): Promise<undefined | PartSelect> =>
	(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.notAtId({ at_ms: callerMs }),
					pf.in_ms.eq(spaceMs),
					pf.code.eq(pc.roleCodeNumIdAtAccountId),
					pf.num.eq(roleCodes.owner),
				),
			)
			.limit(1)
	)[0];

export let get_roleCodeNumIdAtAccountId = async (
	spaceMs: number,
	accountMs: number,
): Promise<undefined | PartSelect> =>
	(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.atId({ at_ms: accountMs }),
					pf.in_ms.eq(spaceMs),
					pf.code.eq(pc.roleCodeNumIdAtAccountId),
				),
			)
			.limit(1)
	)[0];
