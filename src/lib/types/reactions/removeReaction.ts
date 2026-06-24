import { gsdb } from '$lib/global-state.svelte';
import { is1Emoji } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or, SQL } from 'drizzle-orm';
import { type Database } from '../../local-db';
import { assert1Row, channelPartsByCode, type WhoObj } from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagOrRxnCountsBy1 } from '../posts';

export let removeReaction = async (
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	if (!is1Emoji(input.emoji)) throw new Error(`Failed is1Emoji`);
	return useLocalDb
		? _removeReaction(await gsdb(), input, true)
		: trpc().removeReaction.mutate(input);
};

export let _removeReaction = async (
	db: Database,
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	dbIsLocal: boolean,
) => {
	let _emoji_postImb_reactionBmCallerFilter = and(
		pf.code.eq(pc._emoji_postImb_reactionBm),
		pf.txt.eq(input.emoji),
		pf.p1.eq(input.postIdObj.in_ms),
		pf.p2.eq(input.postIdObj.ms),
		pf.p3.eq(input.postIdObj.by_ms),
		pf.p4.eq(input.callerMs),
	);
	let {
		[pc._emoji_postImb_reactionBm]: _emoji_postImb_reactionBmRows = [],
		[pc._emoji_postImb_count]: _emoji_postImb_countRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					_emoji_postImb_reactionBmCallerFilter,
					and(
						pf.code.eq(pc._emoji_postImb_count),
						pf.txt.eq(input.emoji),
						pf.p1.eq(input.postIdObj.in_ms),
						pf.p2.eq(input.postIdObj.ms),
						pf.p3.eq(input.postIdObj.by_ms),
					),
				),
			),
	);
	if (!_emoji_postImb_reactionBmRows.length) return {};
	let deleteFilters: (undefined | SQL)[] = [_emoji_postImb_reactionBmCallerFilter];
	let _emoji_postImb_countRow = assert1Row(_emoji_postImb_countRows);
	_emoji_postImb_countRow.p4! > 1
		? await moveTagOrRxnCountsBy1(db, [], [{ ...input.postIdObj, emoji: input.emoji }], false)
		: deleteFilters.push(
				and(
					pf.code.eq(pc._emoji_postImb_count),
					pf.txt.eq(input.emoji),
					pf.p1.eq(input.postIdObj.in_ms),
					pf.p2.eq(input.postIdObj.ms),
					pf.p3.eq(input.postIdObj.by_ms),
					pf.p4.lt(2),
				),
			);
	await db.delete(pTable).where(or(...deleteFilters));
	return {};
};
