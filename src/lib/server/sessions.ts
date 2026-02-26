import { week } from '$lib/time';
import type { Context } from '$lib/trpc/context';

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
