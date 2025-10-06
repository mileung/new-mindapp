import { z } from 'zod';
import { gs } from '../global-state.svelte';
import { sortUniArr } from '../js';
import { updateLocalCache } from './local-cache';

export let AccountSchema = z
	.object({
		ms: z.literal('').or(z.number()),
		currentSpaceMs: z.literal('').or(z.number()),
		spacesPinnedThrough: z.number(),
		spaceMss: z.array(z.literal('').or(z.number())),
		allTags: z.array(z.string()),
		email: z.string().optional(),
	})
	.strict();

export type Account = z.infer<typeof AccountSchema>;

export async function unsaveTagInPersona(tag: string) {
	await updateLocalCache((lc) => {
		if (gs.accounts) {
			lc.accounts[0].allTags = sortUniArr([...gs.accounts[0]!.allTags].filter((t) => t !== tag));
		}
		return lc;
	});
}
