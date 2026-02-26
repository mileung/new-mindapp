import { page } from '$app/state';
import type { Router } from '$lib/trpc/router';
import { createTRPCClient } from 'trpc-sveltekit';

let browserClient: ReturnType<typeof createTRPCClient<Router>>;

export let trpc = () => {
	const isBrowser = typeof window !== 'undefined';
	if (isBrowser && browserClient) return browserClient;
	const client = createTRPCClient<Router>({ init: page });
	if (isBrowser) browserClient = client;
	return client;
};

export let parseMindappHref = (href: string) => {
	let urlObj = new URL(href, page.url.origin);
	let ms: undefined | number;
	let by_ms: undefined | number;
	let in_ms: undefined | number;
	if (/^\/\d*_\d*_\d*$/.test(urlObj.pathname)) {
		let s = urlObj.pathname.slice(1).split('_', 3);
		if (s[0]) ms = +s[0];
		if (s[1]) by_ms = +s[1];
		if (s[2]) in_ms = +s[2];
	}
	return {
		ms,
		by_ms,
		in_ms,
		q: urlObj.searchParams.get('q'),
		flat: urlObj.searchParams.get('flat'),
		old: urlObj.searchParams.get('old'),
		new: urlObj.searchParams.get('new'),
	};
};
