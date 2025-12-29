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
