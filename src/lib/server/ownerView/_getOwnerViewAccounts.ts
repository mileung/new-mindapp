import { ownerViewItemsPerLoad } from '$lib/js';
import { tdb } from '$lib/server/db';
import { and, or } from 'drizzle-orm';
import { assertLt2Rows, channelPartsByCode } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _getOwnerViewAccounts = async (input: { msLt?: number }) => {
	let _accountEmail_bmRows = await tdb
		.select()
		.from(pTable)
		.where(and(pf.code.eq(pc._accountEmail_bm), pf.p2.lt(input.msLt || Number.MAX_SAFE_INTEGER)))
		.orderBy(pf.p2.desc)
		.limit(ownerViewItemsPerLoad);

	let {
		[pc._signedInEmailRules_mb]: _signedInEmailRules_mbRows = [],
		[pc._accountName_bm]: _accountName_bmRows = [],
		[pc.accountMs_banMb]: accountMs_banMbRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					pf.code.eq(pc._signedInEmailRules_mb),
					and(
						pf.code.eq(pc._accountName_bm),
						or(..._accountEmail_bmRows.map((r) => pf.p1.eq(r.p1!))),
					),
					and(
						pf.code.eq(pc.accountMs_banMb),
						or(..._accountEmail_bmRows.map((r) => pf.p1.eq(r.p1!))),
					),
				),
			),
	);

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < _accountName_bmRows.length; i++) {
		let { txt, p1 } = _accountName_bmRows[i];
		msToAccountNameTxtMap[p1!] = txt!;
	}

	let accountMsToBanMsMap: Record<number, undefined | number> = {};
	for (let i = 0; i < accountMs_banMbRows.length; i++) {
		let { p1, p2 } = accountMs_banMbRows[i];
		accountMsToBanMsMap[p1!] = p2!;
	}

	return {
		signedInEmailRulesTxt: assertLt2Rows(_signedInEmailRules_mbRows)?.txt ?? '',
		accounts: _accountEmail_bmRows.map((r) => ({
			emailTxt: r.txt!,
			nameTxt: msToAccountNameTxtMap[r.p1!],
			ms: r.p2!,
			banMs: accountMsToBanMsMap[r.p2!],
		})),
	};
};
