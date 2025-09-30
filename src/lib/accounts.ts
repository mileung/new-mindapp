import { z } from 'zod';
import { gs } from './global-state.svelte';
import { sortUniArr } from './js';
import { updateLocalCache } from './local-cache';

export let currentPersona = () => {
	return gs.accounts[0]!;
};

export let AccountSchema = z
	.object({
		ms: z.literal('').or(z.number()),
		currentSpaceMs: z.literal('').or(z.number()),
		spacesPinnedThrough: z.number(),
		spaceMss: z.array(z.literal('').or(z.number())),
		tags: z.array(z.string()),
	})
	.strict();

export type Account = z.infer<typeof AccountSchema>;

export async function unsaveTagInPersona(tag: string) {
	await updateLocalCache((lc) => {
		lc.accounts[0].tags = sortUniArr([...gs.accounts[0]!.tags].filter((t) => t !== tag));
		return lc;
	});
}
