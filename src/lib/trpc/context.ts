import { makeRandomStr } from '$lib/js';
import { tdbNodesWhere } from '$lib/server/db';
import { month } from '$lib/time';
import { makeSessionRowFilter, type Session } from '$lib/types/sessions';
import type { RequestEvent } from '@sveltejs/kit';

export async function createContext(event: RequestEvent) {
	let now = Date.now();
	let clientId = event.cookies.get('clientId');
	let clientIdMs = event.cookies.get('clientIdMS');
	if (!clientId || !clientIdMs || now - +clientIdMs > month) {
		clientId = clientId || makeRandomStr();
		clientIdMs = `` + now;
		let cookieParams = {
			httpOnly: true,
			secure: true,
			path: '/',
			maxAge: 60 * 60 * 24 * 365, // 1 year
			sameSite: 'lax',
		} as const;
		event.cookies.set('clientId', clientId, cookieParams);
		event.cookies.set('clientIdMs', clientIdMs, cookieParams);
	}

	let sessionId = event.cookies.get('sessionId');
	let session: undefined | Session;
	if (sessionId) {
		let sessionRowFilter = makeSessionRowFilter(sessionId);
		let sessionRows = await tdbNodesWhere(sessionRowFilter);
		// let sessionRow = assertLt2Rows(sessionRows);
		// if (sessionRow) {
		// 	session = {
		// 		ms: sessionRow.ms!,
		// 		id: sessionRow.tags![0].split(':')[1],
		// 		accountMss: JSON.parse(sessionRow.txt!),
		// 	};
		// 	if (!SessionSchema.safeParse(session).success) throw new Error(`Invalid session`);
		// 	if (now - session.ms > week) {
		// 		session = undefined;
		// 		event.cookies.delete('sessionId', { path: '/' });
		// 		await tdbDeleteNodesWhere(sessionRowFilter);
		// 	} else if (now - session.ms > day) {
		// 		let newSessionId = makeRandomStr();
		// 		setSessionIdCookie(event, newSessionId);
		// 		await tdbUpdateNodes(makeSessionRowInsert(newSessionId, session!.accountMss)).where(
		// 			sessionRowFilter,
		// 		);
		// 	}
		// } else {
		// 	event.cookies.delete('sessionId', { path: '/' });
		// }
	}

	return { event, clientId, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
