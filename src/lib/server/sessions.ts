import { splitUntil } from '$lib/js';
import { minute, week } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import { pc } from '$lib/types/parts/partCodes';
import { pf } from '$lib/types/parts/partFilters';
import { and, or } from 'drizzle-orm';

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

export let getExpiredRowsFilters = (ms = Date.now()) => [
	and(
		pf.noAtId,
		pf.ms.lt(ms - 5 * minute),
		pf.code.eq(pc.otpMs_Pin_StrikeCountIdAndEmailTxt),
		pf.num.eq0,
	),
	and(
		pf.at_ms.gt0,
		pf.at_by_ms.eq0,
		pf.at_in_ms.eq0,
		pf.ms.gt0,
		or(
			pf.ms.lt(ms - week),
			and(
				pf.by_ms.gt0, //
				pf.by_ms.lt(ms),
			),
		),
		pf.in_ms.eq0,
		pf.code.eq(pc.sessionKeyTxtMs_ExpiryMs_AtAccountId),
		pf.num.eq0,
		pf.txt.isNotNull,
	),
];
