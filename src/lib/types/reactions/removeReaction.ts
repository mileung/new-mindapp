import { trpc } from '$lib/trpc/client';
import { and, or, SQL } from 'drizzle-orm';
import { ReactionSchema, type Reaction } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, getWhoWhereObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let removeReaction = async (rxn: Reaction, useRpc: boolean) => {
	if (!ReactionSchema.safeParse(rxn).success) throw new Error(`Invalid post`);
	return useRpc
		? trpc().removeReaction.mutate({ ...(await getWhoWhereObj()), rxn }) //
		: _removeReaction(await gsdb(), rxn);
};

export let _removeReaction = async (db: Database, rxn: Reaction) => {
	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: parentPostIdWNumAsLastVersionAtPPostIdRows = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdRows = [],
		[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmTxtWUnqMsAndNumAsCtAtPostIdRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.atIdAsId(rxn),
						pf.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pf.num.gte0,
						pf.txt.isNull,
					),
					and(
						pf.atId(rxn),
						pf.by_ms.eq(rxn.by_ms),
						pf.in_ms.eq(rxn.in_ms),
						pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pf.num.eq0,
						pf.txt.eq(rxn.emoji),
					),
					and(
						pf.atId(rxn),
						pf.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
						pf.num.gte0,
						pf.txt.eq(rxn.emoji),
					),
				),
			),
	);
	if (!reactionIdWithEmojiTxtAtPostIdRows.length) throw new Error(`Reaction dne`);
	assert1Row(parentPostIdWNumAsLastVersionAtPPostIdRows);
	let deleteFilters: (undefined | SQL)[] = [
		and(
			pf.atId(rxn),
			pf.by_ms.eq(rxn.by_ms),
			pf.in_ms.eq(rxn.in_ms),
			pf.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
			pf.num.eq0,
			pf.txt.eq(rxn.emoji),
		),
	];
	let rEmTxtWUnqMsAndNumAsCtAtPostIdRow = assert1Row(rEmTxtWUnqMsAndNumAsCtAtPostIdRows);
	if (rEmTxtWUnqMsAndNumAsCtAtPostIdRow.num! > 1) {
		await moveTagCoreOrRxnCountsBy1(db, [], [], [rxn], false);
	} else {
		deleteFilters.push(
			and(
				pf.atId(rEmTxtWUnqMsAndNumAsCtAtPostIdRow),
				pf.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
				pf.num.eq(1),
				pf.txt.eq(rxn.emoji),
			),
		);
	}
	await db.delete(pTable).where(or(...deleteFilters));
	return {};
};
