import type { RequestEvent } from '@sveltejs/kit';
import { z } from 'zod';

export let SessionSchema = z
	.object({
		ms: z.number(),
		// key: z.string(),
		// accountMss: z.array(z.number()),
	})
	.strict();

export type Session = z.infer<typeof SessionSchema>;

export let setSessionKeyCookie = (event: RequestEvent, sessionId: string) => {
	event.cookies.set('sessionId', sessionId, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});
};
