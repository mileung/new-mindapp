import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { pTable } from '$lib/types/parts/partsTable';
import { and, or } from 'drizzle-orm';
import { tdb } from './db';

type CookieName = 'clientKey' | 'sessionKey';

export let getCookie = (ctx: Context, name: CookieName) => ctx.event.cookies.get(name);

export let setCookie = (ctx: Context, name: CookieName, val: string) =>
	ctx.event.cookies.set(name, val, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});

export let deleteCookie = (ctx: Context, name: CookieName) => {
	ctx.event.cookies.delete(name, { path: '/' });
};

export let deleteSessionKeyCookie = (ctx: Context) => {
	console.log('deleteSessionCookies');
	deleteCookie(ctx, 'sessionKey');
};

export let getValidAuthCookie = (ctx: Context, cookieName: CookieName) => {
	let cookieStr = getCookie(ctx, cookieName);
	if (cookieStr) {
		try {
			let cookieObj = JSON.parse(cookieStr) as { ms: number; txt: string };
			let { ms, txt } = cookieObj;
			let now = Date.now();
			if (txt.length !== 88 || !ms || ms > now || now - ms > week) {
				deleteCookie(ctx, cookieName);
				return undefined;
			}
			return { ms, txt };
		} catch (error) {}
	}
	return undefined;
};

// export let getValidClientKeyCookie = (ctx: Context) => {
// 	let { ms, txt } = getValidAuthCookies(ctx, 'clientKey');
// 	return { clientMs: ms, clientKey: txt };
// };

// export let getValidSessionKeyCookie = (ctx: Context) => {
// 	let { ms, txt } = getValidAuthCookies(ctx, 'sessionKey');
// 	return { sessionMs: ms, sessionKey: txt };
// };

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
