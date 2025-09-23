import { z } from 'zod';
import { gs } from './globalState.svelte';
import { sortUniArr } from './js';
import { updateLocalCache } from './localCache';

export let currentPersona = () => {
	return gs.accounts[0]!;
};

export let PersonaSchema = z
	.object({
		id: z.string(),
		currentSpaceId: z.string(),
		spacesPinnedThrough: z.number(),
		spaceIds: z.array(z.string()),
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
