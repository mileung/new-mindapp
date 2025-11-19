import { day } from '$lib/time';
import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import type { PartInsert } from './parts';
import { and, eq, isNotNull, isNull } from 'drizzle-orm';
import { partsTable } from './parts-table';
import { makeRandomStr } from '$lib/js';
import { tdb, tdbInsertParts } from '$lib/server/db';
import type { Context } from '$lib/trpc/context';
import type { Account } from './accounts';

export let SessionSchema = z
	.object({
		ms: z.number(),
		id: z.string(),
		accountMss: z.array(z.number()),
	})
	.strict();

export type Session = z.infer<typeof SessionSchema>;

export let makeSessionRowInsert = (sessionId: string, accountMss: number[]) =>
	({
		ms: Date.now() - Math.round(Math.random() * day),
		tags: [` session:${sessionId}`],
		body: JSON.stringify(accountMss),
	}) satisfies PartInsert;

export let setSessionIdCookie = (event: RequestEvent, sessionId: string) => {
	event.cookies.set('sessionId', sessionId, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});
};

export let makeSessionRowFilter = (sessionId: string) =>
	and(
		isNull(partsTable.to_ms),
		isNull(partsTable.to_by_ms),
		isNull(partsTable.to_in_ms),
		isNotNull(partsTable.ms),
		isNull(partsTable.by_ms),
		isNull(partsTable.in_ms),
		eq(partsTable.tag, [` session:${sessionId}`]),
		isNotNull(partsTable.txt),
	);

export let createSession = async (ctx: Context, accountMss: number[]) => {
	let sessionId = makeRandomStr();
	setSessionIdCookie(ctx.event, sessionId);
	await tdbInsertParts(makeSessionRowInsert(sessionId, accountMss));
};
