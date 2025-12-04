import { trpc } from '$lib/trpc/client';
import { and, or, SQL } from 'drizzle-orm';
import { ReactionSchema, type Reaction } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, channelPartsByCode } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let removeReaction = async (rxn: Reaction, useRpc: boolean) => {
	if (!ReactionSchema.safeParse(rxn).success) throw new Error(`Invalid post`);
	return useRpc
		? trpc().removeReaction.mutate(rxn) //
		: _removeReaction(await gsdb(), rxn);
};

export let _removeReaction = async (db: Database, rxn: Reaction) => {
	let {
		[pc.postIdWithNumAsLastVersionAtParentPostId]: parentPostIdWNumAsLastVersionAtPPostIdObj = [],
		[pc.reactionIdWithEmojiTxtAtPostId]: reactionIdWithEmojiTxtAtPostIdObjs = [],
		[pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId]: rEmTxtWUnqMsAndNumAsCtAtPostIdObjs = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pt.atIdAsId(rxn),
						pt.code.eq(pc.postIdWithNumAsLastVersionAtParentPostId),
						pt.txt.isNull,
						pt.num.isNotNull,
					),
					and(
						pt.atId(rxn),
						pt.by_ms.eq(rxn.by_ms),
						pt.in_ms.eq(rxn.in_ms),
						pt.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pt.txt.eq(rxn.emoji),
						pt.num.isNull,
					),
					and(
						pt.atId(rxn),
						pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
						pt.txt.eq(rxn.emoji),
						pt.num.isNotNull,
					),
				),
			),
	);
	if (!reactionIdWithEmojiTxtAtPostIdObjs.length) throw new Error(`Reaction dne`);
	assert1Row(parentPostIdWNumAsLastVersionAtPPostIdObj);
	let deleteFilters: (undefined | SQL)[] = [
		and(
			pt.atId(rxn),
			pt.by_ms.eq(rxn.by_ms),
			pt.in_ms.eq(rxn.in_ms),
			pt.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
			pt.txt.eq(rxn.emoji),
			pt.num.isNull,
		),
	];
	let rEmTxtWUnqMsAndNumAsCtAtPostIdObj = assert1Row(rEmTxtWUnqMsAndNumAsCtAtPostIdObjs);
	if (rEmTxtWUnqMsAndNumAsCtAtPostIdObj.num! > 1) {
		await moveTagCoreOrRxnCountsBy1(db, [], [], [rEmTxtWUnqMsAndNumAsCtAtPostIdObj], false);
	} else {
		deleteFilters.push(
			and(
				pt.atId(rEmTxtWUnqMsAndNumAsCtAtPostIdObj),
				pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
				pt.txt.eq(rxn.emoji),
				pt.num.eq(1),
			),
		);
	}
	await db.delete(pTable).where(or(...deleteFilters));
	return {};
};
