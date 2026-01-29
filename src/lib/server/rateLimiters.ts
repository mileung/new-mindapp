import { dev } from '$app/environment';
import { m } from '$lib/paraglide/messages';
import type { Context } from '$lib/trpc/context';
import { TRPCError } from '@trpc/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { minute, second } from '../time';

export let makeLimiter = (pings: number, minutes: number) => {
	let limiter = new RateLimiterMemory({
		points: pings,
		duration: (minutes * minute) / second,
	});
	return {
		ping: async (ctx: Context) => {
			if (dev) return;
			try {
				await limiter.consume(ctx.event.getClientAddress());
			} catch (e) {
				console.log('e:', e);
				throw new TRPCError({
					code: 'TOO_MANY_REQUESTS',
					message: m.tooManyRequests(),
				});
			}
		},
	};
};

let durationInMinutes = dev ? 0 : 8;
export let generalLimiter = makeLimiter(1000, durationInMinutes);
export let signInLimiter = makeLimiter(8, durationInMinutes);
export let emailLimiter = makeLimiter(3, durationInMinutes);
export let feedLimiter = makeLimiter(800, durationInMinutes);
export let postLimiter = makeLimiter(80, durationInMinutes);
export let reactionLimiter = makeLimiter(80, durationInMinutes);
