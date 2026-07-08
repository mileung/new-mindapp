import { assertCallerIsOwnerOrInGlobal, getWhoObj, gs } from '$lib/global-state.svelte';
import { alertError } from '$lib/js';
import { getIdStr, type IdObj } from '../parts/partIds';
import { addReaction } from './addReaction';
import { removeReaction } from './removeReaction';

export let toggleReaction = async (input: { postIdObj: IdObj; emoji: string }) => {
	try {
		let postIdStr = getIdStr(input.postIdObj);
		let myRxnEmojis = gs.idToPostMap[postIdStr]?.myRxnEmojis || [];
		let rxnEmojiCount = gs.idToPostMap[postIdStr]?.rxnEmojiCount || {};
		rxnEmojiCount[input.emoji] ||= 0;
		let adding = !myRxnEmojis.includes(input.emoji);
		if (adding) {
			input.postIdObj.in_ms && assertCallerIsOwnerOrInGlobal();
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
			!input.postIdObj.in_ms,
		);
		// TODO: throws error if post isn't saved locally
		// if (input.postIdObj.in_ms && !getUrlInMs()) {
		// 	await (adding ? addReaction : removeReaction)(
		// 		{ ...(await getWhoObj()), ...input },
		// 		true, //
		// 	);
		// }
	} catch (error) {
		alertError(error);
	}
};
