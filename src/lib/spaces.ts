import { z } from 'zod';
import { gs } from './globalState.svelte';

export let SpaceSchema = z
	.object({
		id: z.number(),
	})
	.strict();

export type Space = z.infer<typeof SpaceSchema>;

export let getCurrentSpaceId = () => gs.accounts[0]?.currentSpaceId || '';
