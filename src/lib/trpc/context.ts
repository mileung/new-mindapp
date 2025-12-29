import type { RequestEvent } from '@sveltejs/kit';

export let createContext = async (event: RequestEvent) => {
	return { event };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
