import type { Context } from '$lib/trpc/context';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { minute, second } from '../time';

export const t = initTRPC.context<Context>().create();

let makeLimiter = (pings: number, minutes: number) => {
	const limiter = new RateLimiterMemory({
		points: pings,
		duration: (minutes * minute) / second,
	});
	return {
		ping: async (e: RequestEvent) => {
			try {
				await limiter.consume(e.getClientAddress());
				return { err: null };
			} catch (e) {
				return { err: 'tooManyRequests' };
			}
		},
	};
};

const logLimiter = makeLimiter(100, 1);

export const router = t.router({});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);

export type Router = typeof router;
