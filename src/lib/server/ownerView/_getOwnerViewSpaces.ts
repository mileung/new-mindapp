import { ownerViewItemsPerLoad } from '$lib/js';
import { tdb } from '$lib/server/db';
import { roleCodes } from '$lib/types/spaces';
import { and, desc, or } from 'drizzle-orm';
import { channelPartsByCode } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _getOwnerViewSpaces = async (input: { msBefore?: number }) => {
	let spaceNameTxtIdRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.noAtId,
				pf.in_ms.lt(input.msBefore || Number.MAX_SAFE_INTEGER),
				pf.code.eq(pc.spaceNameTxtId),
				pf.num.eq0,
				pf.txt.isNotNull,
			),
		)
		.orderBy(desc(pTable.in_ms))
		.limit(ownerViewItemsPerLoad);

	let {
		[pc.roleCodeNumIdAtAccountId]: roleCodeNumIdAtAccountIdRows = [],
		// [pc.banIdAtSpaceId]: banIdAtSpaceIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.at_ms.gt0,
						pf.at_by_ms.eq0,
						pf.at_in_ms.eq0,
						or(
							pf.in_ms.eq(1), //
							...spaceNameTxtIdRows.map((r) => pf.in_ms.eq(r.in_ms)),
						),
						pf.code.eq(pc.roleCodeNumIdAtAccountId),
						pf.num.eq(roleCodes.admin),
						pf.txt.isNull,
					),
					// and(
					// 	or(...spaceNameTxtIdRows.map((r) => pf.atId({ at_ms: r.in_ms }))),
					// 	pf.ms.gt0,
					// 	pf.by_ms.gt0,
					// 	pf.in_ms.eq0,
					// 	pf.code.eq(pc.banIdAtSpaceId),
					// 	pf.num.eq0,
					// 	pf.txt.isNull,
					// ),
				),
			),
	);

	let accountNameTxtMsByMsRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.noAtId,
				pf.ms.gt0,
				or(...roleCodeNumIdAtAccountIdRows.map((r) => pf.by_ms.eq(r.at_ms))),
				pf.in_ms.eq0,
				pf.code.eq(pc.accountNameTxtMsByMs),
				pf.num.eq0,
				pf.txt.isNotNull,
			),
		);

	let msToSpaceNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < spaceNameTxtIdRows.length; i++) {
		let { txt, in_ms } = spaceNameTxtIdRows[i];
		msToSpaceNameTxtMap[in_ms] = txt!;
	}

	let msToSpaceAdminMssMap: Record<number, number[]> = {};
	for (let i = 0; i < roleCodeNumIdAtAccountIdRows.length; i++) {
		let { in_ms, at_ms } = roleCodeNumIdAtAccountIdRows[i];
		msToSpaceAdminMssMap[in_ms] ||= [];
		msToSpaceAdminMssMap[in_ms].push(at_ms);
	}

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < accountNameTxtMsByMsRows.length; i++) {
		let { txt, by_ms } = accountNameTxtMsByMsRows[i];
		msToAccountNameTxtMap[by_ms] = txt!;
	}

	// let spaceMsToBannedIdMap: Record<number, undefined | Pick<IdObj, 'ms' | 'by_ms'>> = {};
	// for (let i = 0; i < banIdAtSpaceIdRows.length; i++) {
	// 	let { ms, by_ms, at_ms } = banIdAtSpaceIdRows[i];
	// 	spaceMsToBannedIdMap[at_ms] = { ms, by_ms };
	// }

	return {
		msToSpaceAdminMssMap,
		msToAccountNameTxtMap,
		spaces: spaceNameTxtIdRows.map((r) => ({
			ms: r.in_ms,
			nameTxt: msToSpaceNameTxtMap[r.in_ms],
			// banned: spaceMsToBannedIdMap[r.in_ms],
		})),
	};
};
