import { splitUntil } from '$lib/js';
import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';

type CookieName = 'clientKeyObj' | 'sessionKeyObj';
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
