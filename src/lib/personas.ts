import { z } from 'zod';
import { gs } from './globalState.svelte';
import { getLocalCache, updateLocalCache } from './localCache';
import { sortUniArr } from './js';

export let currentPersona = () => {
	return gs.personas[0]!;
};

export let PersonaSchema = z
	.object({
		id: z.number().optional(),
		spaceIds: z.array(z.number().optional()),
		tags: z.array(z.string()),
	})
	.strict();

export type Persona = z.infer<typeof PersonaSchema>;

export async function unsaveTagInPersona(tag: string) {
	let localCache = await getLocalCache();
	localCache.personas[0].tags = sortUniArr([...gs.personas[0]!.tags].filter((t) => t !== tag));
	await updateLocalCache(localCache);
	gs.personas = localCache.personas;
}
