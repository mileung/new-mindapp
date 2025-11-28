import { makeRandomStr } from '$lib/js';
import { m } from '$lib/paraglide/messages';
import { tdb } from '$lib/server/db';
import { day } from '$lib/time';
import type { Context } from '$lib/trpc/context';
import {
	_getEmailRow,
	_getMyAccount,
	AccountSchema,
	assertValidEmail,
	filterAccountPwHashRow,
	reduceAccountRows,
	sanitizeAccountForUser,
	type Account,
} from '$lib/types/accounts';
import { _checkOtp, _sendOtp } from '$lib/types/otp';
import {
	assert1Row,
	assertLt2Rows,
	getBaseInput,
	type BaseInput,
	type PartSelect,
} from '$lib/types/parts';
import { pc } from '$lib/types/parts/partCodes';
import { pt } from '$lib/types/parts/partFilters';
import { FullIdObjSchema, zeros } from '$lib/types/parts/partIds';
import { pTable } from '$lib/types/parts/partsTable';
import { normalizeTags, PostSchema } from '$lib/types/posts';
import { _addPost } from '$lib/types/posts/addPost';
import { _deletePost } from '$lib/types/posts/deletePost';
import { _editPost } from '$lib/types/posts/editPost';
import { _getPostFeed, GetPostFeedSchema } from '$lib/types/posts/getPostFeed';
import { _getPostHistory } from '$lib/types/posts/getPostHistory';
import { SessionSchema, setSessionKeyCookie, type Session } from '$lib/types/sessions';
import { _getSpaceTags } from '$lib/types/spaces/getSpaceTags';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import * as argon2 from 'argon2';
import { and, eq, isNotNull } from 'drizzle-orm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { z } from 'zod';
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

const emailLimiter = makeLimiter(3, 5);
async function sendEmail(config: { from: string; to: string; subject: string; html: string }) {
	// const { err } = await emailLimiter.ping();
	// if (err) throw new Error(err);
	// const resend = new Resend(env.RESEND_API_KEY);
	// const result = await resend.emails.send(config);
	// return result;
}

export const baseProcedure = t.procedure.input(getBaseInput);

let assertValidSession = async (ctx: Context, input: BaseInput) => {
	let now = Date.now();
	let session: undefined | Session;
	if (ctx.sessionId && input.by_ms !== null) {
		let sessionRowFilter = and(
			pt.at_ms.eq(input.by_ms),
			pt.at_by_ms.eq0,
			pt.at_in_ms.eq0,
			pt.ms.gt0,
			pt.by_ms.eq0,
			pt.in_ms.eq0,
			pt.code.eq(pc.msAndTxtAsSessionIdAtAccountId),
			pt.txt.eq(ctx.sessionId),
			pt.num.isNull,
		);
		let sessionRows = await tdb
			.select()
			.from(pTable)
			.where(sessionRowFilter)
			.orderBy(pt.ms.desc)
			.limit(1);
		let sessionRow = assertLt2Rows(sessionRows);
		if (sessionRow) {
			session = { ms: sessionRow.ms! };
			if (!SessionSchema.safeParse(session).success) throw new Error(`Invalid session`);
			if (now - session.ms > 8 * day) {
				session = undefined;
			} else if (now - session.ms > 88 * minute) {
				let newSessionKey = makeRandomStr();
				setSessionKeyCookie(ctx.event, newSessionKey);
				await tdb
					.update(pTable)
					.set({
						ms: Date.now(),
						txt: newSessionKey,
					})
					.where(
						and(
							pt.at_ms.gt0,
							pt.at_by_ms.eq0,
							pt.at_in_ms.eq0,
							pt.ms.eq(session.ms),
							pt.by_ms.eq0,
							pt.in_ms.eq0,
							pt.code.eq(pc.msAndTxtAsSessionIdAtAccountId),
							pt.txt.eq(ctx.sessionId),
							pt.num.isNull,
						),
					);
			}
		}
		!session && ctx.event.cookies.delete('sessionId', { path: '/' });
	}
	return { session };
};

let assertSessionIsAuthorized = (ctx: Context, byMs?: null | number, inMs?: null | number) => {
	// if (byMs === null && inMs < 0) throw new Error('Invalid byMs');
	// if (inMs === null && inMs < 0) throw new Error('Invalid inMs');
	// if (!ctx.session?.accountMss.includes(byMs)) throw new Error('Unauthorized by_ms');
	// TODO: Verify user by_ms has access to space in_ms
};

export const router = t.router({
	auth: t.router({
		signOut: baseProcedure.mutation(async ({ ctx, input }) => {
			assertValidSession(ctx, input);
			// if (!ctx.session) throw new Error('Missing session');
			// let sessionRowFilter = filterSessionRows(ctx.session.id);
			// await tdb
			// 	.update(partsTable)
			// 	.set(
			// 		makeSessionRowInsert(
			// 			ctx.session.id,
			// 			ctx.session.accountMss.filter((ms) => ms !== input),
			// 		),
			// 	)
			// 	.where(sessionRowFilter);
		}),
		verifySignedInMss: baseProcedure
			.input(z.object({ accountMss: z.array(z.number()) }))
			.mutation(async ({ ctx, input }) => {
				// let signedInMsSet = new Set(ctx.session?.accountMss);
				// return input.accountMss.filter((ms) => signedInMsSet.has(ms));
			}),
		sendOtp: baseProcedure
			.input(
				z.object({
					email: z.string(),
					partCode: z
						.literal(pc.createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount)
						.or(z.literal(pc.resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount)),
				}),
			)
			.mutation(async ({ input }) => {
				let email = input.email.trim().toLowerCase();
				assertValidEmail(email);
				let accountRow = await _getEmailRow(tdb, email);
				if (
					input.partCode === pc.createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount &&
					accountRow
				)
					throw new Error(m.anAccountWithThatEmailAlreadyExists());
				if (
					input.partCode === pc.resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount &&
					!accountRow
				)
					throw new Error(m.accountDoesNotExist());
				return _sendOtp(tdb, email, input.partCode);
			}),
		checkOtp: baseProcedure
			.input(
				z.object({
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
					partCode: z
						.literal(pc.createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount)
						.or(z.literal(pc.signInOtpWithTxtAsEmailColonPinAndNumAsStrikeCount))
						.or(z.literal(pc.resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount)),
				}),
			)
			.mutation(async ({ input }) => {
				assertValidEmail(input.email);
				return await _checkOtp(tdb, input);
			}),
		attemptCreateAccount: baseProcedure
			.input(
				z.object({
					name: z.string().min(0).max(88),
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
					password: z.string(),
				}),
			)
			.mutation(async ({ ctx, input }): Promise<{ strike?: number; account?: Account }> => {
				let session = await assertValidSession(ctx, input);
				assertValidEmail(input.email);
				// let ms = Date.now();
				let ms = 100;
				let res = await _checkOtp(tdb, {
					...input,
					partCode: pc.createAccountOtpWithTxtAsEmailColonPinAndNumAsStrikeCount,
				});
				if (res.strike) return res;
				let emailRow = await _getEmailRow(tdb, input.email);
				if (emailRow) throw new Error(m.anAccountWithThatEmailAlreadyExists());
				let rowsForAccount = await tdb
					.insert(pTable)
					.values([
						{
							...zeros,
							ms,
							code: pc.accountId,
						},
						{
							...zeros,
							at_ms: ms,
							ms,
							code: pc.txtAsAccountPwHashAtAccountId,
							txt: await argon2.hash(input.password),
						},
						{
							...zeros,
							at_ms: ms,
							ms,
							code: pc.msAndTxtAsClientIdAtAccountId,
							txt: ctx.clientId,
						},
						{
							...zeros,
							at_ms: ms,
							ms,
							code: pc.msAndTxtAsNameAtAccountId,
							txt: input.name.trim(),
						},
						{
							...zeros,
							at_ms: ms,
							ms,
							code: pc.txtAsAccountEmailAtAccountId,
							txt: input.email,
						},
					])
					.returning();
				let account = sanitizeAccountForUser(reduceAccountRows(rowsForAccount));
				if (!AccountSchema.safeParse(account).success) throw new Error('Invalid account');
				if (session) {
					// await tdb.delete(partsTable).where(filterSessionRows(ctx.session.id));
				} else {
					let sessionId = makeRandomStr();
					setSessionKeyCookie(ctx.event, sessionId);
					await tdb.insert(pTable).values({
						...zeros,
						at_ms: ms,
						ms,
						code: pc.msAndTxtAsSessionIdAtAccountId,
						txt: sessionId,
					});
				}
				return { account };
			}),
		attemptSignIn: baseProcedure
			.input(
				z.object({
					otpMs: z.number().optional(),
					pin: z.string().length(8).optional(),
					email: z.string(),
					password: z.string(),
				}),
			)
			.mutation(
				async ({
					input,
					ctx,
				}): Promise<{
					strike?: number;
					account?: Account;
					otpMs?: number;
				}> => {
					let email = input.email.trim().toLowerCase();
					assertValidEmail(email);
					let { otpMs, pin } = input;
					let otpVerified = false;
					if (otpMs && pin) {
						let res = await _checkOtp(tdb, {
							email,
							otpMs,
							pin,
							partCode: pc.signInOtpWithTxtAsEmailColonPinAndNumAsStrikeCount,
						});
						if (res.strike) return res;
						else otpVerified = true;
					}
					let emailRow = await _getEmailRow(tdb, email);
					if (!emailRow) throw new Error(m.accountDoesNotExist());
					let accountMs = emailRow.at_ms!;
					let pwHashRow = assert1Row(
						await tdb.select().from(pTable).where(filterAccountPwHashRow(accountMs)),
					);
					if (!(await argon2.verify(pwHashRow.txt!, input.password))) {
						throw new Error(m.invalidPassword());
					}
					let clientIdRow: undefined | PartSelect;
					if (otpVerified) {
						clientIdRow = (
							await tdb
								.insert(pTable)
								.values({
									...zeros,
									ms: Date.now(),
									code: pc.msAndTxtAsClientIdAtAccountId,
									txt: ctx.clientId,
								})
								.returning()
						)[0];
					} else {
						let clientIdRows = await tdb
							.select()
							.from(pTable)
							.where(
								and(
									pt.at_ms.eq0,
									pt.at_by_ms.eq0,
									pt.at_in_ms.eq0,
									pt.ms.eq0,
									pt.by_ms.eq0,
									pt.in_ms.eq(accountMs),
									pt.code.eq(pc.msAndTxtAsClientIdAtAccountId),
									pt.txt.eq(ctx.clientId),
								),
							);
						clientIdRow = assertLt2Rows(clientIdRows);
					}
					return clientIdRow
						? await _getMyAccount(tdb, accountMs, email)
						: await _sendOtp(tdb, email, pc.signInOtpWithTxtAsEmailColonPinAndNumAsStrikeCount);
				},
			),
		resetPassword: baseProcedure
			.input(
				z.object({
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
					password: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				let email = input.email.trim().toLowerCase();
				assertValidEmail(email);
				let ms = Date.now();
				let res = await _checkOtp(tdb, {
					...input,
					partCode: pc.resetPasswordOtpWithTxtAsEmailColonPinAndNumAsStrikeCount,
				});
				if (res.strike) return res;
				let accountRow = await _getEmailRow(tdb, email);
				if (!accountRow) throw new Error(`accountRow dne`);
				await tdb
					.update(pTable)
					.set({
						ms,
						txt: await argon2.hash(input.password),
					})
					.where(filterAccountPwHashRow(accountRow.ms!));
			}),
	}),
	getAccountByMs: baseProcedure
		.input(
			z.object({
				spaceMssMs: z.number().optional(),
				savedTagsMs: z.number().optional(),
				email: z.string(),
				nameMs: z.number().optional(),
			}),
		)
		.query(async ({ ctx, input }) => {
			assertValidSession(ctx, input);
			if (!input.by_ms) throw new Error(m.anErrorOccurred());
			let { account } = await _getMyAccount(tdb, input.by_ms, input.email);
			if (!account.savedTagsMs || account.savedTagsMs === input.savedTagsMs) return;
			let savedTagsRows = await tdb
				.select()
				.from(pTable)
				.where(
					and(
						pt.at_ms.eq0,
						pt.at_by_ms.eq0,
						pt.at_in_ms.eq0,
						pt.ms.eq0,
						eq(pTable.by_ms, input.by_ms),
						pt.in_ms.eq0,
						// pf.code.eq(' savedTags'),
						isNotNull(pTable.txt),
					),
				);
			if (savedTagsRows.length > 1) throw new Error('Multiple savedTagsRows found');
			let savedTagsRow = savedTagsRows[0];
			let savedTags: string[] = savedTagsRow ? JSON.parse(savedTagsRow.txt!) : [];
			return { savedTags, savedTagsMs: savedTagsRow.ms! };
		}),
	updateSavedTags: baseProcedure
		.input(
			z.object({
				adding: z.array(z.string()),
				removing: z.array(z.string()),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			if (!input.by_ms) throw new Error(m.anErrorOccurred());
			assertValidSession(ctx, input);
			let now = Date.now();
			let savedTagsRowFilter = and(
				pt.at_ms.eq0,
				pt.at_by_ms.eq0,
				pt.at_in_ms.eq0,
				pt.ms.eq0,
				pt.by_ms.eq0,
				pt.in_ms.eq(input.by_ms),
				// pf.code.eq(' savedTags'),
				isNotNull(pTable.txt),
			);
			let savedTagsRows = await tdb.select().from(pTable).where(savedTagsRowFilter);
			if (savedTagsRows.length > 1) throw new Error('Multiple savedTagsRows found');
			let savedTagsRow = savedTagsRows[0];
			if (!savedTagsRow) throw new Error('savedTagsRow dne');
			let savedTags: string[] = JSON.parse(savedTagsRow.txt!);
			let removingSet = new Set(input.removing);
			let newSavedTags: string[] = normalizeTags([...savedTags, ...input.adding]).filter(
				(t) => !removingSet.has(t),
			);
			await tdb
				.update(pTable)
				.set({
					ms: now,
					txt: JSON.stringify(newSavedTags),
				})
				.where(savedTagsRowFilter);
			return { savedTagsMs: now };
		}),
	addPost: baseProcedure
		.input(PostSchema) //
		.mutation(async ({ input: post, ctx }) => {
			assertValidSession(ctx, post);
			if (post.ms) throw new Error('post ms must be 0');
			if (!post.in_ms) throw new Error('Invalid in_ms');
			if (!post.by_ms) throw new Error('Invalid by_ms');
			if (!post.history || Object.keys(post.history).length !== 1 || !post.history['0'])
				throw new Error('History must have only version 0');
			if (post.history['0'].ms) throw new Error('history ms must be 0');
			return _addPost(tdb, post);
		}),
	editPost: baseProcedure
		.input(PostSchema) //
		.mutation(async ({ input, ctx }) => {
			assertValidSession(ctx, input);
			return _editPost(tdb, input);
		}),
	deletePost: baseProcedure
		.input(
			z.object({
				fullPostId: FullIdObjSchema,
				version: z.number().nullable(),
			}),
		)
		.mutation(
			async ({
				input,
				ctx, //
			}) => {
				assertValidSession(ctx, input);
				return _deletePost(tdb, input.fullPostId, input.version);
			},
		),
	getPostFeed: baseProcedure.input(GetPostFeedSchema).mutation(async ({ input, ctx }) => {
		if (!input.inMssInclude.length) throw new Error('Must include at least one inMs');
		// if (input.byMssInclude?.length !== 1) throw new Error(`byMssInclude must be 1`);

		// TODO do most of if not all the security checks here

		assertValidSession(ctx, input);
		return _getPostFeed(tdb, input);
	}),
	getPostHistory: baseProcedure
		.input(
			z.object({
				fullPostId: FullIdObjSchema,
				version: z.number(),
			}),
		)
		.mutation(async ({ ctx, input }) => {
			assertValidSession(ctx, input);
			return _getPostHistory(tdb, input.fullPostId, input.version);
		}),
	getSpaceTags: baseProcedure.mutation(async ({ input, ctx }) => {
		assertValidSession(ctx, input);
		return _getSpaceTags(tdb, input);
	}),
});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);
export type Router = typeof router;
