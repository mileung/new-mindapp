import { isStrInt } from '$lib/js';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { tdb } from './db';

export let getCookie = (ctx: Context, name: string) => ctx.event.cookies.get(name);

export let setCookie = (ctx: Context, name: string, val: string) =>
	ctx.event.cookies.set(name, val, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});

export let deleteCookie = (ctx: Context, name: string) => {
	ctx.event.cookies.delete(name, { path: '/' });
};

export let deleteSessionCookies = (ctx: Context) => {
	console.log('deleteSessionCookies');
	deleteCookie(ctx, 'sessionMs');
	deleteCookie(ctx, 'sessionKey');
};

let getValidAuthCookies = (ctx: Context, msCookieName: string, keyCookieName: string) => {
	let msStr = getCookie(ctx, msCookieName);
	let ms = msStr && isStrInt(msStr) ? +msStr : undefined;
	let key = getCookie(ctx, keyCookieName);
	let now = Date.now();
	if (key?.length !== 88 || !ms || ms > now || now - ms > week) {
		deleteCookie(ctx, msCookieName);
		deleteCookie(ctx, keyCookieName);
		return { ms: undefined, key: undefined };
	}
	return { ms, key };
};

export let getValidClientCookies = (ctx: Context) => {
	let { ms, key } = getValidAuthCookies(ctx, 'clientMs', 'clientKey');
	return { clientMs: ms, clientKey: key };
};

export let getValidSessionCookies = (ctx: Context) => {
	let { ms, key } = getValidAuthCookies(ctx, 'sessionMs', 'sessionKey');
	return { sessionMs: ms, sessionKey: key };
};

export let deleteExpiredAuthRows = async () => {
	await tdb //
		.delete(pTable)
		.where(
			and(
				pf.at_ms.gt0,
				pf.at_by_ms.eq0,
				pf.at_in_ms.eq0,
				pf.ms.lte(Date.now() - week),
				pf.by_ms.eq0,
				pf.in_ms.eq0,
				or(
					pf.code.eq(pc.clientKeyTxtMsAtAccountId),
					pf.code.eq(pc.sessionKeyTxtMsAtAccountId),
					pf.code.eq(pc.createAccountOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount),
					pf.code.eq(pc.signInOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount),
					pf.code.eq(pc.resetPasswordOtpMsWithTxtAsEmailColonPinAndNumAsStrikeCount),
				),
				pf.txt.isNotNull,
			),
		);
};
