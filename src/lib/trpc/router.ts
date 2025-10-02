import { dev } from '$app/environment';
import { AccountSchema, type Account } from '$lib/accounts';
import { tdb } from '$lib/server/db';
import { isValidEmail } from '$lib/server/security';
import { type ThoughtInsert } from '$lib/thoughts';
import { thoughtsTable } from '$lib/thoughts-table';
import type { Context } from '$lib/trpc/context';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { z } from 'zod';
import { minute, second } from '../time';
import { randomBytes } from 'crypto';

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
				let otp = ('' + Math.random()).slice(-8);
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
					otp: z.string().length(8),
				}),
			)
			.mutation(
				async ({
					input,
					ctx,
				}): Promise<{
					strike?: number;
					account?: Account;
				}> => {
					let now = Date.now();
					let otpFilter = and(
						eq(thoughtsTable.tags, [` otp:${input.email}`]),
						isNull(thoughtsTable.in_ms),
						isNull(thoughtsTable.by_ms),
					);
					let otpThoughts = await tdb
						.select()
						.from(thoughtsTable)
						.where(otpFilter)
						.orderBy(desc(thoughtsTable.ms));
					let otpThought = otpThoughts[0];
					// console.log('otpThought:', otpThought);
					if (!otpThought) throw new Error('otpThought dne');
					let { otp, strike = 0 } = JSON.parse(otpThought.body!);
					console.log('otp:', otp);
					console.log('strike:', strike);
					if (input.otp !== otp) {
						strike++;
						if (strike > 2) {
							await tdb.delete(thoughtsTable).where(otpFilter);
						} else {
							await tdb
								.update(thoughtsTable)
								.set({
									body: JSON.stringify({ otp, strike }),
								})
								.where(otpFilter);
						}
						return { strike };
					}

					await tdb.delete(thoughtsTable).where(otpFilter);

					let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
					let sessionId = [...Array(64)]
						.map((_) => chars[Math.round(Math.random() * chars.length)])
						.join('');

					ctx.event.cookies.set('sessionId', sessionId, {
						httpOnly: true,
						secure: true,
						path: '/',
						maxAge: 60 * 60 * 24 * 7, // 1 week
						sameSite: 'lax',
					});
					let accountTags = [` email:${input.email}`];
					let accountThoughts = await tdb
						.select()
						.from(thoughtsTable)
						.where(eq(thoughtsTable.tags, accountTags));
					if (accountThoughts.length > 1) throw new Error('Multiple accounts found');
					let accountThought = accountThoughts[0];
					if (!accountThought) {
						accountThought = (
							await tdb
								.insert(thoughtsTable)
								.values({
									ms: now,
									tags: accountTags,
									body: JSON.stringify({
										currentSpaceMs: 0,
										spacesPinnedThrough: 0,
										spaceMss: ['', 0, 1],
										allTags: [],
									} satisfies Omit<Account, 'ms'>),
								})
								.returning()
						)[0];
					}
					// console.log('accountThought:', accountThought);
					let account: Account = {
						ms: accountThought.ms,
						email: accountThought.tags![0].split(' email:')[1],
						...JSON.parse(accountThought.body!),
					};
					if (!AccountSchema.safeParse(account).success) throw new Error('Invalid account');

					// console.log('account:', account);
					await tdb.insert(thoughtsTable).values({
						ms: now,
						tags: [` session:${sessionId}`],
					});

					return { account };
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
