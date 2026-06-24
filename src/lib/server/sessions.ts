import { splitUntil } from '$lib/js';
import { minute, week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { and } from 'drizzle-orm';

type CookieName = 'ms_clientKey' | 'ms_sessionKey';
export type CookieObj = { ms: number; txt: string };

export let getCookie = (ctx: Context, name: CookieName) => ctx.event.cookies.get(name);

export let setCookie = (ctx: Context, name: CookieName, co: CookieObj) =>
	ctx.event.cookies.set(name, `${co.ms}_${co.txt}`, {
		httpOnly: true,
		secure: true,
		path: '/',
		maxAge: 60 * 60 * 24 * 7, // 1 week
		sameSite: 'lax',
	});

export let deleteCookie = (ctx: Context, name: CookieName) => {
	ctx.event.cookies.delete(name, { path: '/' });
};

export let getValidAuthCookie = (ctx: Context, cookieName: CookieName) => {
	let cookieStr = getCookie(ctx, cookieName);
	if (cookieStr) {
		try {
			let [msStr, txt] = splitUntil(cookieStr, '_', 1);
			let ms = +msStr;
			let now = Date.now();
			if (Number.isNaN(ms) || txt.length !== 88 || !ms || ms > now || now - ms > week) {
				deleteCookie(ctx, cookieName);
				return undefined;
			}
			return { ms, txt };
		} catch (error) {}
	}
	return undefined;
};

export let getExpiredRowsFilters = (now: number) => [
	and(
		pf.code.eq(pc._email_ms_strikeCount_pin),
		pf.p1.lt(now - 5 * minute), //
	),
	and(
		pf.code.eq(pc._sessionKey_m_accountMs_expiryMs),
		pf.p1.lt(now - week), // not checking expiryMs cuz p3 isn't indexed; no need to
	),
];
