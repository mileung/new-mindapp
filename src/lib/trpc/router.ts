import type { Context } from '$lib/trpc/context';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { minute, second } from '../time';
import { z } from 'zod';

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

export const router = t.router({
	auth: t.router({
		sendOtp: t.procedure
			.input(z.object({ email: z.string().email() }))
			.mutation(async ({ input }) => {
				let { email } = input;

				let otp = Math.random().toString(36).slice(-6);
				console.log('otp:', otp);

				// await resend.emails.send({
				// 	from: 'noreply@yourdomain.com',
				// 	to: email,
				// 	subject: 'Your Login Code',
				// 	html: `${otp}`,
				// });

				return { success: true };
			}),
		verifyCode: t.procedure
			.input(
				z.object({
					email: z.string().email(),
					code: z.string().length(6),
				}),
			)
			.mutation(async ({ input }) => {
				const { email, code } = input;

				return {
					success: true,
					// token,
					// user: {
					// 	id: user.id,
					// 	email: user.email,
					// },
				};
			}),
	}),
	getFeed: t.procedure
		.input(
			z.object({
				//
				email: z.string().email(),
			}),
		)
		.mutation(async ({ input }) => {
			return { success: true };
		}),
});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);
export type Router = typeof router;
