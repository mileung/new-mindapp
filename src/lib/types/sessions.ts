import { day } from '$lib/time';
import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';
import type { ThoughtInsert } from './thoughts';
import { and, eq, isNull } from 'drizzle-orm';
import { thoughtsTable } from './thoughts-table';

export let SessionSchema = z
	.object({
		sessionCode: z.string(),
		accountMss: z.array(z.number()),
		// TODO: Security based on IP address? IPs can be easily spoofed so idk if it's worth implementing.
	})
	.strict();

export type Session = z.infer<typeof SessionSchema>;

let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
export let makeSessionId = () => {
	let sessionMs = Date.now() - Math.round(Math.random() * day);
	let sessionCode = [...Array(64)]
		.map((_) => chars[Math.round(Math.random() * chars.length)])
		.join('');
	return {
		sessionMs,
		sessionCode,
		sessionId: `${sessionMs}-${sessionCode}`,
	};
};

export let makeSessionRowInsert = (
	sessionMs: number, //
	sessionCode: string,
	accountMss: number[],
) =>
	({
		ms: sessionMs,
		tags: [' session'],
		body: JSON.stringify({ sessionCode, accountMss } satisfies Session),
	}) satisfies ThoughtInsert;

export let setSessionIdCookie = (event: RequestEvent, sessionId: string) => {
	event.cookies.set('sessionId', sessionId, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});
};

export let makeSessionRowFilter = (sessionMs: number) =>
	and(
		isNull(thoughtsTable.by_ms),
		isNull(thoughtsTable.in_ms),
		eq(thoughtsTable.ms, sessionMs), //
		eq(thoughtsTable.tags, [' session']),
	);
