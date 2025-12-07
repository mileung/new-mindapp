import { trpc } from '$lib/trpc/client';
import { and, or, SQL } from 'drizzle-orm';
import { ReactionSchema, type Reaction } from '.';
import { gsdb, type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, getBaseInput } from '../parts';
import { pc } from '../parts/partCodes';
import { pt } from '../parts/partFilters';
import { pTable } from '../parts/partsTable';
import { moveTagCoreOrRxnCountsBy1 } from '../posts';

export let removeReaction = async (rxn: Reaction) => {
	if (!ReactionSchema.safeParse(rxn).success) throw new Error(`Invalid post`);
	let baseInput = await getBaseInput();
	return baseInput.spaceMs
		? trpc().removeReaction.mutate({ ...baseInput, rxn }) //
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
						pt.num.gte0,
						pt.txt.isNull,
					),
					and(
						pt.atId(rxn),
						pt.by_ms.eq(rxn.by_ms),
						pt.in_ms.eq(rxn.in_ms),
						pt.code.eq(pc.reactionIdWithEmojiTxtAtPostId),
						pt.num.eq0,
						pt.txt.eq(rxn.emoji),
					),
					and(
						pt.atId(rxn),
						pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
						pt.num.gte0,
						pt.txt.eq(rxn.emoji),
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
			pt.num.eq0,
			pt.txt.eq(rxn.emoji),
		),
	];
	let rEmTxtWUnqMsAndNumAsCtAtPostIdObj = assert1Row(rEmTxtWUnqMsAndNumAsCtAtPostIdObjs);
	if (rEmTxtWUnqMsAndNumAsCtAtPostIdObj.num! > 1) {
		await moveTagCoreOrRxnCountsBy1(db, [], [], [rxn], false);
	} else {
		deleteFilters.push(
			and(
				pt.atId(rEmTxtWUnqMsAndNumAsCtAtPostIdObj),
				pt.code.eq(pc.reactionEmojiTxtWithUniqueMsAndNumAsCountAtPostId),
				pt.num.eq(1),
				pt.txt.eq(rxn.emoji),
			),
		);
	}
	await db.delete(pTable).where(or(...deleteFilters));
	return {};
};
