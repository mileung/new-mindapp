import { getWhoObj, gs } from '$lib/global-state.svelte';
import { getIdStr, getUrlInMs, type IdObj } from '../parts/partIds';
import { addReaction } from './addReaction';
import { removeReaction } from './removeReaction';

export let toggleReaction = async (input: { postIdObj: IdObj; emoji: string }) => {
	let postIdStr = getIdStr(input.postIdObj);
	let myRxnEmojis = gs.idToPostMap[postIdStr]?.myRxnEmojis || [];
	let rxnEmojiCount = gs.idToPostMap[postIdStr]?.rxnEmojiCount || {};
	rxnEmojiCount[input.emoji] ||= 0;
	let adding = !myRxnEmojis.includes(input.emoji);
	if (adding) {
		myRxnEmojis = [...new Set([input.emoji, ...myRxnEmojis])];
		rxnEmojiCount[input.emoji]++;
	} else {
		myRxnEmojis = myRxnEmojis.filter((e) => e !== input.emoji);
		rxnEmojiCount[input.emoji]--;
		if (!rxnEmojiCount[input.emoji]) delete rxnEmojiCount[input.emoji];
	}
	gs.idToPostMap[postIdStr]!.myRxnEmojis = myRxnEmojis;
	gs.idToPostMap[postIdStr]!.rxnEmojiCount = rxnEmojiCount;
	await (adding ? addReaction : removeReaction)(
		{ ...(await getWhoObj()), ...input },
		!getUrlInMs(),
	);
};
