import { dev } from '$app/environment';
import { tdb } from '$lib/server/db';
import { filterThought, type ThoughtInsert } from '$lib/thoughts';
import { thoughtsTable } from '$lib/thoughts-table';
import type { Context } from '$lib/trpc/context';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { minute, second } from '../time';
import { isValidEmail } from '$lib/server/security';

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

const emailLimiter = makeLimiter(3, 5);
async function email(config: { from: string; to: string; subject: string; html: string }) {
	// const { err } = await emailLimiter.ping();
	// if (err) throw new Error(err);
	// const resend = new Resend(env.RESEND_API_KEY);
	// const result = await resend.emails.send(config);
	// return result;
}

export const router = t.router({
	auth: t.router({
		signOut: t.procedure.input(z.object({})).mutation(async () => {
			//
		}),
		sendOtp: t.procedure
			.input(z.object({ email: z.string().email() }))
			.mutation(async ({ input }) => {
				let { email } = input;
				if (!isValidEmail(email)) throw new Error('invalid email');
				let otp = ('' + Math.random()).slice(-6);
				if (dev) {
					console.log('otp:', otp);
				} else {
					// await resend.emails.send({
					// 	from: 'noreply@yourdomain.com',
					// 	to: email,
					// 	subject: 'Your Login Code',
					// 	html: `${otp}`,
					// });
				}

				let now = Date.now();
				let t: ThoughtInsert = {
					ms: now,
					tags: [` otp:${email}`],
					body: JSON.stringify({ otp }),
				};
				await tdb.insert(thoughtsTable).values(t);
				return { success: true };
			}),
		verifyOtp: t.procedure
			.input(
				z.object({
					email: z.string().email(),
					otp: z.string().length(6),
				}),
			)
			.mutation(
				async ({
					input,
					ctx,
				}): Promise<{
					strike?: number;
					// account?: Account;
					success?: any;
				}> => {
					let t = (
						await tdb
							.select()
							.from(thoughtsTable)
							.where(eq(thoughtsTable.tags, [` otp:${input.email}`]))
							.orderBy(desc(thoughtsTable.ms))
					)[0];

					console.log('t:', t);
					let { otp, strike = 0 } = JSON.parse(t.body!);
					if (input.otp === otp) {
						// await (tdb).delete(thoughtsTable).where(filterThought(t));
						let sessionId = uuidv4();
						ctx.event.cookies.set('sessionId', sessionId, {
							httpOnly: true,
							secure: true,
							path: '/',
							maxAge: 60 * 60 * 24 * 7, // 1 week
							sameSite: 'lax',
						});
						return {
							// account: {
							success: {
								// id: '',
								// id: user.id,
								// email: user.email,
							},
						};
					}
					strike++;
					if (strike > 2) {
						tdb.delete(thoughtsTable).where(filterThought(t));
					} else {
						tdb
							.update(thoughtsTable)
							.set({
								body: JSON.stringify({ otp, strike }),
							})
							.where(filterThought(t));
					}
					return { strike };
				},
			),
	}),
	getFeed: t.procedure
		.input(
			z.object({
				//
			}),
		)
		.mutation(async ({ input, ctx }) => {
			let sessionId = ctx.event.cookies.get('sessionId');
			console.log('sessionId:', sessionId);
			console.log(ctx.event.cookies.getAll());

			return { success: true };
		}),
});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);
export type Router = typeof router;
