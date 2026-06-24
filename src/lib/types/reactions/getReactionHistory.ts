import { getWhoWhereObj, gsdb } from '$lib/global-state.svelte';
import type { Database } from '$lib/local-db';
import { trpc } from '$lib/trpc/client';
import { and, asc, desc, not } from 'drizzle-orm';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';

export let reactionsPerLoad = 88;

export let getReactionHistory = async ({
	postIdObj,
	msLte,
	rxnMsByMssExclude,
}: {
	postIdObj: IdObj;
	msLte: number;
	rxnMsByMssExclude: { ms: number; by_ms: number }[];
}) => {
	let baseInput = await getWhoWhereObj();
	return baseInput.spaceMs
		? trpc().getReactionHistory.query({
				...baseInput,
				postIdObj,
				msLte,
				rxnMsByMssExclude,
			})
		: _getReactionHistory(await gsdb(), {
				...baseInput,
				postIdObj,
				msLte,
				rxnMsByMssExclude,
			});
};

export let _getReactionHistory = async (
	db: Database,
	input: {
		postIdObj: IdObj;
		msLte: number;
		rxnMsByMssExclude: { ms: number; by_ms: number }[];
	},
) => {
	// console.table(await db.select().from(pTable));
	// console.log(await db.select().from(pTable));
	// console.log('input:', input);

	let _emoji_postImb_reactionBmRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc._emoji_postImb_reactionBm),
				pf.p1.eq(input.postIdObj.in_ms),
				pf.p2.eq(input.postIdObj.ms),
				pf.p3.eq(input.postIdObj.by_ms),
				and(
					...input.rxnMsByMssExclude.map((t) =>
						not(
							and(
								pf.p4.eq(t.by_ms),
								pf.p5.eq(t.ms), //
							)!,
						),
					),
				),
				pf.p4.lte(input.msLte),
			),
		)
		.orderBy(desc(pTable.p4), asc(pTable.txt))
		.limit(reactionsPerLoad);

	let _accountName_bmRows = await db
		.select()
		.from(pTable)
		.where(
			and(
				pf.code.eq(pc._accountName_bm),
				and(
					..._emoji_postImb_reactionBmRows.map(
						(r) => pf.p1.eq(r.p4!), //
					),
				),
			),
		);
	let msToAccountNameTxtMap: Record<number, string> = {};
	for (let i = 0; i < _accountName_bmRows.length; i++) {
		let { txt, p1 } = _accountName_bmRows[i];
		msToAccountNameTxtMap[p1!] = txt!;
	}
	return {
		msToAccountNameTxtMap,
		reactions: _emoji_postImb_reactionBmRows.map((r) => ({
			ms: r.p5!,
			by_ms: r.p4!,
			emoji: r.txt!,
		})),
	};
};
