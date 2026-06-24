import { ownerViewItemsPerLoad } from '$lib/js';
import { tdb } from '$lib/server/db';
import { roleCodes } from '$lib/types/spaces';
import { and, or } from 'drizzle-orm';
import { channelPartsByCode } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _getOwnerViewSpaces = async (input: { msLt?: number }) => {
	let _spaceName_imbRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc._spaceName_imb), //
				pf.p1.lt(input.msLt || Number.MAX_SAFE_INTEGER),
			),
		)
		.orderBy(pf.p1.desc)
		.limit(ownerViewItemsPerLoad);

	let {
		//
		[pc.i_accountMs_roleCode_mb]: i_accountMs_roleCode_mbRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				and(
					pf.code.eq(pc.i_accountMs_roleCode_mb),
					or(
						pf.p1.eq(1), //
						..._spaceName_imbRows.map((r) => pf.p1.eq(r.p1!)),
					),
					pf.p3.eq(roleCodes.admin),
				),
			),
	);

	let _accountName_bmRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc._accountName_bm),
				or(...i_accountMs_roleCode_mbRows.map((r) => pf.p1.eq(r.p2!))),
			),
		);

	let msToSpaceNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < _spaceName_imbRows.length; i++) {
		let { txt, p1 } = _spaceName_imbRows[i];
		msToSpaceNameTxtMap[p1!] = txt!;
	}

	let msToSpaceAdminMssMap: Record<number, number[]> = {};
	for (let i = 0; i < i_accountMs_roleCode_mbRows.length; i++) {
		let { p1, p2 } = i_accountMs_roleCode_mbRows[i];
		msToSpaceAdminMssMap[p1!] ||= [];
		msToSpaceAdminMssMap[p1!].push(p2!);
	}

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < _accountName_bmRows.length; i++) {
		let { txt, p1 } = _accountName_bmRows[i];
		msToAccountNameTxtMap[p1!] = txt!;
	}

	return {
		msToSpaceAdminMssMap,
		msToAccountNameTxtMap,
		spaces: _spaceName_imbRows.map((r) => ({
			ms: r.p1!,
			nameTxt: msToSpaceNameTxtMap[r.p1!],
		})),
	};
};
