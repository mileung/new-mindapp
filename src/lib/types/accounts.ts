import { and, eq, isNull, like } from 'drizzle-orm';
import { z } from 'zod';
import { thoughtsTable } from './thoughts-table';

export let AccountSchema = z
	.object({
		ms: z.literal('').or(z.number()),
		spaceMss: z.array(z.literal('').or(z.number())).max(50),
		allTagsMs: z.number().optional(),
		allTags: z.array(z.string()),
		email: z.string().optional(),
		name: z.string().optional(),
	})
	.strict();

export type Account = z.infer<typeof AccountSchema>;

export let filterAccountByMs = (ms: number) => {
	return and(
		eq(thoughtsTable.ms, ms),
		isNull(thoughtsTable.by_ms),
		isNull(thoughtsTable.in_ms),
		like(thoughtsTable.tags, '[" email:%'),
	);
};
