import { gs } from '$lib/global-state.svelte';
import type { Reaction } from '.';
import { getAtIdStr } from '../parts/partIds';
import { addReaction } from './addReaction';
import { removeReaction } from './removeReaction';

export let toggleReaction = async (rxn: Reaction) => {
	let postIdStr = getAtIdStr(rxn);
	let myRxns = gs.idToPostMap[postIdStr]?.myRxns || [];
	let rxnCount = gs.idToPostMap[postIdStr]?.rxnCount || {};
	rxnCount[rxn.emoji] = rxnCount[rxn.emoji] || 0;
	let adding = !myRxns.includes(rxn.emoji);
	if (adding) {
		myRxns = [...new Set([rxn.emoji, ...myRxns])];
		rxnCount[rxn.emoji]++;
	} else {
		myRxns = myRxns.filter((e) => e !== rxn.emoji);
		rxnCount[rxn.emoji]--;
		if (!rxnCount[rxn.emoji]) delete rxnCount[rxn.emoji];
	}
	gs.idToPostMap[postIdStr]!.myRxns = myRxns;
	gs.idToPostMap[postIdStr]!.rxnCount = rxnCount;
	let useRpc = gs.urlInMs! > 0;
	await (adding ? addReaction : removeReaction)(rxn, useRpc);
};
