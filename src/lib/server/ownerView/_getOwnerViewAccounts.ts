import { ownerViewItemsPerLoad } from '$lib/js';
import { tdb } from '$lib/server/db';
import { and, desc, or } from 'drizzle-orm';
import { assertLt2Rows, channelPartsByCode } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _getOwnerViewAccounts = async (input: { msBefore?: number }) => {
	let accountEmailTxtMsByMsRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.noAtId,
				pf.ms.gt0,
				pf.ms.lt(input.msBefore || Number.MAX_SAFE_INTEGER),
				pf.by_ms.gt0,
				pf.in_ms.eq0,
				pf.code.eq(pc.accountEmailTxtMsByMs),
				pf.num.eq0,
				pf.txt.isNotNull,
			),
		)
		.orderBy(desc(pTable.by_ms))
		.limit(ownerViewItemsPerLoad);

	let {
		[pc.accountNameTxtMsByMs]: accountNameTxtMsByMsRows = [],
		[pc.banMsByMsAtAccountId]: banMsByMsAtAccountIdRows = [],
		[pc.signedInEmailRulesTxtId]: signedInEmailRulesTxtIdRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.noAtId,
						pf.ms.gt0,
						or(...accountEmailTxtMsByMsRows.map((r) => pf.by_ms.eq(r.by_ms))),
						pf.in_ms.eq0,
						pf.code.eq(pc.accountNameTxtMsByMs),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
					and(
						or(...accountEmailTxtMsByMsRows.map((r) => pf.atId({ at_ms: r.by_ms }))),
						pf.ms.gt0,
						pf.by_ms.gt0,
						pf.in_ms.eq0,
						pf.code.eq(pc.banMsByMsAtAccountId),
						pf.num.eq0,
						pf.txt.isNull,
					),
					and(
						pf.noAtId,
						pf.in_ms.eq0,
						pf.code.eq(pc.signedInEmailRulesTxtId),
						pf.num.eq0,
						pf.txt.isNotNull,
					),
				),
			),
	);

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < accountNameTxtMsByMsRows.length; i++) {
		let { txt, by_ms } = accountNameTxtMsByMsRows[i];
		msToAccountNameTxtMap[by_ms] = txt!;
	}

	let accountMsToBannedMap: Record<number, undefined | { ms: number }> = {};
	for (let i = 0; i < banMsByMsAtAccountIdRows.length; i++) {
		let { ms, at_ms } = banMsByMsAtAccountIdRows[i];
		accountMsToBannedMap[at_ms] = { ms };
	}

	return {
		signedInEmailRulesTxt: assertLt2Rows(signedInEmailRulesTxtIdRows)?.txt || '',
		accounts: accountEmailTxtMsByMsRows.map((r) => ({
			emailTxt: r.txt!,
			nameTxt: msToAccountNameTxtMap[r.by_ms],
			ms: r.by_ms,
			banned: accountMsToBannedMap[r.by_ms],
		})),
	};
};
