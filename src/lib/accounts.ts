import { z } from 'zod';
import { gs } from './globalState.svelte';
import { getLocalCache, updateLocalCache } from './localCache';
import { sortUniArr } from './js';

export let currentPersona = () => {
	return gs.accounts[0]!;
};

export let PersonaSchema = z
	.object({
		id: z.number().optional(),
		spaceIndex: z.number(),
		spacesPinnedThrough: z.number(),
		spaceIds: z.array(z.number().optional()),
		tags: z.array(z.string()),
	})
	.strict();

export type Account = z.infer<typeof PersonaSchema>;

export async function unsaveTagInPersona(tag: string) {
	await updateLocalCache((lc) => {
		lc.accounts[0].tags = sortUniArr([...gs.accounts[0]!.tags].filter((t) => t !== tag));
		return lc;
	});
}
