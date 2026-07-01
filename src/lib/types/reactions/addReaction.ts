import { gsdb } from '$lib/global-state.svelte';
import { is1Emoji, throwIf } from '$lib/js';
import { trpc } from '$lib/trpc/client';
import { and, or } from 'drizzle-orm';
import { type Database } from '../../local-db';
import {
	assert1Row,
	assertLt2Rows,
	channelPartsByCode,
	type PartInsert,
	type WhoObj,
} from '../parts';
import { pc } from '../parts/partCodes';
import { pf } from '../parts/partFilters';
import { type IdObj } from '../parts/partIds';
import { pTable } from '../parts/partsTable';
import { moveTagOrRxnCountsBy1 } from '../posts';

export let addReaction = async (
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	useLocalDb: boolean,
) => {
	if (!is1Emoji(input.emoji)) throw new Error(`Failed is1Emoji`);
	return useLocalDb //
		? _addReaction(await gsdb(), input, true)
		: trpc().addReaction.mutate(input);
};

export let _addReaction = async (
	db: Database,
	input: WhoObj & {
		postIdObj: IdObj;
		emoji: string;
	},
	dbIsLocal: boolean,
) => {
	let now = Date.now();
	let _emoji_reactionImb_postMbRow: PartInsert = {
		code: pc._emoji_reactionImb_postMb,
		txt: input.emoji,
		p1: input.postIdObj.in_ms,
		p2: now,
		p3: input.callerMs,
		p4: input.postIdObj.ms,
		p5: input.postIdObj.by_ms,
	};
	let partsToInsert: PartInsert[] = [
		_emoji_reactionImb_postMbRow,
		// for testing
		// ...[...Array(88)].map((_, i) => ({
		// 	..._emoji_reactionImb_postMbRow,
		// 	p2: _emoji_reactionImb_postMbRow.p2! + (i + 1) * 88888888,
		// })),
	];
	let {
		[pc._core_postImb_lastVersion_m]: _core_postImb_lastVersion_mRows = [],
		[pc._emoji_reactionImb_postMb]: _emoji_reactionImb_postMbRows = [],
		[pc._emoji_postImb_count]: _emoji_postImb_countRows = [],
	} = channelPartsByCode(
		await db
			.select()
			.from(pTable)
			.where(
				or(
					and(
						pf.code.eq(pc._core_postImb_lastVersion_m),
						pf.p1.eq(input.postIdObj.in_ms),
						pf.p2.eq(input.postIdObj.ms),
						pf.p3.eq(input.postIdObj.by_ms),
					),
					and(
						pf.code.eq(pc._emoji_reactionImb_postMb),
						pf.txt.eq(input.emoji),
						pf.p1.eq(input.postIdObj.in_ms),
						pf.p3.eq(input.callerMs),
						pf.p4.eq(input.postIdObj.ms),
						pf.p5.eq(input.postIdObj.by_ms),
					),
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
	throwIf(_emoji_reactionImb_postMbRows.length);
	assert1Row(_core_postImb_lastVersion_mRows);
	assertLt2Rows(_emoji_postImb_countRows)
		? await moveTagOrRxnCountsBy1(db, [], [{ ...input.postIdObj, emoji: input.emoji }], true)
		: partsToInsert.push({
				code: pc._emoji_postImb_count,
				txt: input.emoji,
				p1: input.postIdObj.in_ms,
				p2: input.postIdObj.ms,
				p3: input.postIdObj.by_ms,
				p4: 1,
			});
	// console.log('partsToInsert', JSON.stringify(partsToInsert, null, 2));
	await db.insert(pTable).values(partsToInsert);
	return { ms: now };
};
