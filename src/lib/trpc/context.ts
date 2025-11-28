import { makeRandomStr } from '$lib/js';
import type { RequestEvent } from '@sveltejs/kit';

export async function createContext(event: RequestEvent) {
	let clientId = event.cookies.get('clientId');
	if (!clientId) {
		clientId = clientId || makeRandomStr();
		let cookieParams = {
			httpOnly: true,
			secure: true,
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			sameSite: 'lax',
		} as const;
		event.cookies.set('clientId', clientId, cookieParams);
	}
	return {
		event,
		clientId,
		sessionId: event.cookies.get('sessionId'),
	};
}

export type Context = Awaited<ReturnType<typeof createContext>>;
