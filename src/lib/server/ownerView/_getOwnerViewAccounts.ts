import { ownerViewItemsPerLoad } from '$lib/js';
import { tdb } from '$lib/server/db';
import { and, desc, or } from 'drizzle-orm';
import { assertLt2Rows, channelPartsByCode } from '../../types/parts';
import { pc } from '../../types/parts/partCodes';
import { pf } from '../../types/parts/partFilters';
import { pTable } from '../../types/parts/partsTable';

export let _getOwnerViewAccounts = async (input: { msBefore?: number }) => {
	let msByMs__accountEmailRows = await tdb
		.select()
		.from(pTable)
		.where(
			and(
				pf.noAtId,
				pf.ms.gt0,
				pf.ms.lt(input.msBefore || Number.MAX_SAFE_INTEGER),
				pf.by_ms.gt0,
				pf.in_ms.eq0,
				pf.code.eq(pc.msByMs__accountEmail),
				pf.num.isNull,
				pf.txt.isNotNull,
			),
		)
		.orderBy(desc(pTable.by_ms))
		.limit(ownerViewItemsPerLoad);

	let {
		[pc.msByMs__accountName]: msByMs__accountNameRows = [],
		[pc.banMsByMs__accountMs]: banMsByMs__accountMsRows = [],
		[pc.id__signedInEmailRules]: id__signedInEmailRulesRows = [],
	} = channelPartsByCode(
		await tdb
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.noAtId,
						pf.ms.gt0,
						or(...msByMs__accountEmailRows.map((r) => pf.by_ms.eq(r.by_ms))),
						pf.in_ms.eq0,
						pf.code.eq(pc.msByMs__accountName),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
					and(
						or(...msByMs__accountEmailRows.map((r) => pf.atId({ at_ms: r.by_ms }))),
						pf.ms.gt0,
						pf.by_ms.gt0,
						pf.in_ms.eq0,
						pf.code.eq(pc.banMsByMs__accountMs),
						pf.num.isNull,
						pf.txt.isNull,
					),
					and(
						pf.noAtId,
						pf.in_ms.eq0,
						pf.code.eq(pc.id__signedInEmailRules),
						pf.num.isNull,
						pf.txt.isNotNull,
					),
				),
			),
	);

	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < msByMs__accountNameRows.length; i++) {
		let { txt, by_ms } = msByMs__accountNameRows[i];
		msToAccountNameTxtMap[by_ms] = txt!;
	}

	let accountMsToBannedMap: Record<number, undefined | { ms: number }> = {};
	for (let i = 0; i < banMsByMs__accountMsRows.length; i++) {
		let { ms, at_ms } = banMsByMs__accountMsRows[i];
		accountMsToBannedMap[at_ms] = { ms };
	}

	return {
		signedInEmailRulesTxt: assertLt2Rows(id__signedInEmailRulesRows)?.txt || '',
		accounts: msByMs__accountEmailRows.map((r) => ({
			emailTxt: r.txt!,
			nameTxt: msToAccountNameTxtMap[r.by_ms],
			ms: r.by_ms,
			banned: accountMsToBannedMap[r.by_ms],
		})),
	};
};
