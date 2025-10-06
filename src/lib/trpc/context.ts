import { tdb } from '$lib/server/db';
import { day, week } from '$lib/time';
import {
	makeSessionId,
	makeSessionRowFilter,
	makeSessionRowInsert,
	SessionSchema,
	setSessionIdCookie,
	type Session,
} from '$lib/types/sessions';
import { thoughtsTable } from '$lib/types/thoughts-table';
import type { RequestEvent } from '@sveltejs/kit';

export async function createContext(event: RequestEvent) {
	let sessionId = event.cookies.get('sessionId');
	let [sMs, sessionCode] = (sessionId || '').split('-');
	let sessionMs = +sMs || 0;

	let sessionRowFilter = makeSessionRowFilter(sessionMs);
	let sessionRows = await tdb.select().from(thoughtsTable).where(sessionRowFilter);

	let session: undefined | Session;
	if (!sessionCode || !sessionRows.length) {
		event.cookies.delete('sessionId', { path: '/' });
	} else {
		if (sessionRows.length > 1) throw new Error('Multiple sessions found');
		let sessionRow = sessionRows[0];
		let now = Date.now();
		session = JSON.parse(sessionRow.body!);
		if (
			now - sessionMs > week || //
			session!.sessionCode !== sessionCode ||
			!SessionSchema.safeParse(session).success ||
			!(
				sessionRow.tags?.length === 1 && //
				sessionRow.tags[0] === ' session'
			)
		) {
			session = undefined;
			event.cookies.delete('sessionId', { path: '/' });
			await tdb.delete(thoughtsTable).where(sessionRowFilter);
		} else if (now - sessionMs > day) {
			let {
				sessionMs: newSessionMs,
				sessionCode: newSessionCode,
				sessionId: newSessionId,
			} = makeSessionId();
			setSessionIdCookie(event, newSessionId);

			await tdb
				.update(thoughtsTable)
				.set(
					makeSessionRowInsert(
						newSessionMs, //
						newSessionCode,
						session!.accountMss,
					),
				)
				.where(sessionRowFilter);
		}
	}

	return { event, session };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
