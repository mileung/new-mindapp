import { dev } from '$app/environment';
import { tdb } from '$lib/server/db';
import type { Context } from '$lib/trpc/context';
import { AccountSchema, type Account } from '$lib/types/accounts';
import { OtpSchema, type Otp } from '$lib/types/otp';
import {
	makeSessionId,
	makeSessionRowFilter,
	makeSessionRowInsert,
	setSessionIdCookie,
} from '$lib/types/sessions';
import { thoughtsTable } from '$lib/types/thoughts-table';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC, type inferRouterInputs } from '@trpc/server';
import { and, desc, eq, isNull, lt, or } from 'drizzle-orm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { z } from 'zod';
import { minute, second, week } from '../time';
import { _loadThoughts } from '$lib/types/thoughts';

export const t = initTRPC.context<Context>().create();

let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
export let isValidEmail = (email: string) => {
	return email.length < 255 && emailRegex.test(email);
};

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
async function sendEmail(config: { from: string; to: string; subject: string; html: string }) {
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
		getAccountStates: t.procedure
			.input(z.object({ accountMss: z.array(z.number()) }))
			.mutation(async ({ input, ctx }) => {
				let { accountMss } = input;
				if (ctx.session) {
					let signedInMsSet = new Set(ctx.session.accountMss);
					return accountMss.filter((ms) => signedInMsSet.has(ms));
				}
				return [];
			}),
		sendOtp: t.procedure
			.input(z.object({ email: z.string() })) //
			.mutation(async ({ input }) => {
				let { email } = input;
				if (!isValidEmail(email)) throw new Error('invalid email');
				let pin = ('' + Math.random()).slice(-8);
				if (dev) {
					pin = '00000000';
					// console.log('pin:', pin);
				} else {
					// await resend.emails.send({
					// 	from: 'noreply@yourdomain.com',
					// 	to: email,
					// 	subject: 'Your Login Code',
					// 	html: `${otp}`,
					// });
				}

				let ms = Date.now();
				await tdb.insert(thoughtsTable).values({
					ms,
					tags: [' otp'],
					body: JSON.stringify({ email, pin, strike: 0 } satisfies Otp),
				});
				return { ms };
			}),
		verifyOtp: t.procedure
			.input(
				z.object({
					ms: z.number(),
					email: z.string().email(),
					pin: z.string().length(8),
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
					let otpRowFilter = and(
						eq(thoughtsTable.ms, input.ms),
						eq(thoughtsTable.tags, [' otp']),
						isNull(thoughtsTable.in_ms),
						isNull(thoughtsTable.by_ms),
					);
					let otpRows = await tdb
						.select()
						.from(thoughtsTable)
						.where(otpRowFilter)
						.orderBy(desc(thoughtsTable.ms));
					let otpRow = otpRows[0];
					if (!otpRow) throw new Error('otpRow dne');
					let otp: Otp = JSON.parse(otpRow.body!);
					if (!OtpSchema.safeParse(otp).success) throw new Error('Invalid OTP');
					// console.log('otp:', otp);
					if (input.email !== otp.email) {
						throw new Error('Invalid email');
					}
					if (input.pin !== otp.pin) {
						otp.strike++;
						if (otp.strike > 2) {
							await tdb
								.delete(thoughtsTable)
								.where(
									or(
										otpRowFilter,
										and(
											lt(thoughtsTable.ms, now - 5 * minute),
											eq(thoughtsTable.tags, [' otp']),
											isNull(thoughtsTable.in_ms),
											isNull(thoughtsTable.by_ms),
										),
									),
								);
						} else {
							await tdb
								.update(thoughtsTable)
								.set({ body: JSON.stringify(otp) })
								.where(otpRowFilter);
						}
						return { strike: otp.strike };
					}

					await tdb.delete(thoughtsTable).where(otpRowFilter);

					let accountTags = [` email:${input.email}`];
					let accountRows = await tdb
						.select()
						.from(thoughtsTable)
						.where(eq(thoughtsTable.tags, accountTags));

					if (accountRows.length > 1) throw new Error('Multiple accounts found');
					let accountRow = accountRows[0];
					if (!accountRow) {
						accountRow = (
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
					// console.log('accountRow:', accountRow);
					let account: Account = {
						ms: accountRow.ms,
						email: accountRow.tags![0].split(' email:')[1],
						...JSON.parse(accountRow.body!),
					};
					if (!AccountSchema.safeParse(account).success) throw new Error('Invalid account');

					// console.log('account:', account);

					if (ctx.session) {
						let sessionId = ctx.event.cookies.get('sessionId');
						let [sMs] = (sessionId || '').split('-');
						let sessionMs = +sMs || 0;
						await tdb
							.delete(thoughtsTable)
							.where(
								or(
									makeSessionRowFilter(sessionMs),
									and(
										isNull(thoughtsTable.by_ms),
										isNull(thoughtsTable.in_ms),
										lt(thoughtsTable.ms, now - week),
										eq(thoughtsTable.tags, [' session']),
									),
								),
							);
					}

					let { sessionMs, sessionCode, sessionId } = makeSessionId();
					setSessionIdCookie(ctx.event, sessionId);

					await tdb.insert(thoughtsTable).values(
						makeSessionRowInsert(
							sessionMs, //
							sessionCode,
							[
								...new Set([
									accountRow.ms!, //
									...(ctx.session?.accountMss || []),
								]),
							],
						),
					);

					return { account };
				},
			),
	}),
	getFeed: t.procedure
		.input(
			z.object({
				rpc: z.boolean().optional(),
				nested: z.boolean().optional(),
				oldestFirst: z.boolean().optional(), // TODO: implementing this will require more data analyzing to ensure the right fromMs is sent. e.g. What to do when appending a new thought to an oldest first feed and the newest thoughts haven't been fetched yet?
				fromMs: z.number(),
				idsInclude: z.array(z.string()).optional(),
				idsExclude: z.array(z.string()).optional(),
				mssInclude: z.array(z.literal('').or(z.number())).optional(),
				mssExclude: z.array(z.literal('').or(z.number())).optional(),
				byMssInclude: z.array(z.literal('').or(z.number())).optional(),
				byMssExclude: z.array(z.literal('').or(z.number())).optional(),
				inMssInclude: z.array(z.literal('').or(z.number())).optional(),
				inMssExclude: z.array(z.literal('').or(z.number())).optional(),
				tagsInclude: z.array(z.string()).optional(),
				tagsExclude: z.array(z.string()).optional(),
				bodyIncludes: z.array(z.string()).optional(),
				bodyExcludes: z.array(z.string()).optional(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			// return _loadThoughts(tdb,input)
		}),
});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);
export type Router = typeof router;

export type GetFeedInput = inferRouterInputs<Router>['getFeed'];
