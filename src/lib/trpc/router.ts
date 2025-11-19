import { dev } from '$app/environment';

import { m } from '$lib/paraglide/messages';
import { tdb, tdbDeletePartsWhere, tdbPartsWhere, tdbUpdateParts } from '$lib/server/db';
import type { Context } from '$lib/trpc/context';
import { AccountSchema, type Account } from '$lib/types/accounts';
import {
	assert1Row,
	assertLt2Rows,
	SplitIdSchema,
	SplitIdToSplitIdSchema,
	partCodes,
	PartInsertSchema,
	PartSelectSchema,
	getSplitId,
} from '$lib/types/parts';
import { partsTable } from '$lib/types/parts-table';
import { OtpSchema, type Otp } from '$lib/types/otp';
import { normalizeTags, PostSchema } from '$lib/types/posts';
import { makeSessionRowFilter, makeSessionRowInsert } from '$lib/types/sessions';
import type { RequestEvent } from '@sveltejs/kit';
import { initTRPC } from '@trpc/server';
import * as argon2 from 'argon2';
import { and, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { z } from 'zod';
import { minute, second } from '../time';
import { _getPostFeed, GetPostFeedSchema } from '$lib/types/posts/getPostFeed';
import { _deletePost } from '$lib/types/posts/deletePost';
import { _editPost } from '$lib/types/posts/editPost';
import { _addPost } from '$lib/types/posts/addPost';
import { _getPostHistory } from '$lib/types/posts/getPostHistory';

export const t = initTRPC.context<Context>().create();

let emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
let isValidEmail = (email: string) => {
	return email.length < 255 && emailRegex.test(email);
};
let assertEmail = (e: string) => {
	if (!isValidEmail(e)) throw new Error('invalid email');
};

let getEmailRow = async (email: string) => {
	let emailRowsFilter = and(
		isNotNull(partsTable.to_ms),
		isNull(partsTable.to_by_ms),
		isNull(partsTable.to_in_ms),
		isNull(partsTable.ms),
		isNull(partsTable.by_ms),
		isNull(partsTable.in_ms),
		eq(partsTable.code, partCodes.txtAsAccountEmailToAccountId),
		eq(partsTable.txt, email),
		isNull(partsTable.num),
	);
	let emailRows = await tdbPartsWhere(emailRowsFilter);
	return assertLt2Rows(emailRows);
};

// let reduceRowsForAccount = (rows: PartSelect[]) =>
// 	rows.reduce((a, r) => {
// 		let prop = r.tag?.slice(1);
// 		if (prop === 'account') a.ms = r.ms!;
// 		else {
// 			if (prop === 'name' || prop === 'email') {
// 				a[prop] = r.txt!;
// 				a[`${prop}Ms`] = r.ms!;
// 			}
// 			if (prop === 'spaceMss' || prop === 'savedTags') {
// 				a[`${prop}Ms`] = r.ms!;
// 				a[prop] = JSON.parse(r.txt!);
// 			}
// 		}
// 		return a;
// 	}, {} as Account);

let getAccountByMs = async (ms: number, email?: string) => {
	// let rowsForAccount = await tdbPartsWhere(
	// 	or(
	// 		and(
	// 			isNull(partsTable.to_ms),
	// 			isNull(partsTable.to_by_ms),
	// 			isNull(partsTable.to_in_ms),
	// 			eq(partsTable.ms, ms),
	// 			isNull(partsTable.by_ms),
	// 			isNull(partsTable.in_ms),
	// 			eq(partsTable.code, partCodes.account),
	// 			isNull(partsTable.txt),
	// 		),
	// 		and(
	// 			isNull(partsTable.to_ms),
	// 			isNull(partsTable.to_by_ms),
	// 			isNull(partsTable.to_in_ms),
	// 			isNotNull(partsTable.ms),
	// 			isNull(partsTable.by_ms),
	// 			eq(partsTable.in_ms, ms),
	// 			// or(
	// 			// 	eq(partsTable.code, ' spaceMss'),
	// 			// 	eq(partsTable.code, ' savedTags'),
	// 			// 	...(email ? [] : [eq(partsTable.code, ' email')]),
	// 			// 	eq(partsTable.code, ' name'),
	// 			// ),
	// 			isNotNull(partsTable.txt),
	// 		),
	// 	),
	// );
	// @ts-ignore
	let account: Account = {
		email, // ...reduceRowsForAccount(rowsForAccount)
	};
	if (!AccountSchema.safeParse(account)) throw new Error(`Invalid account`);
	return { account };
};

let sendOtp = async (email: string, partCode: number) => {
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
	// await tdbInsertParts({
	// 	ms,
	// 	partCode,
	// 	txt: email+':'+pin,
	// 	num: 0
	// });
	return { otpMs: ms };
};

let checkOtp = async (
	now: number,
	deleteIfCorrect: boolean,
	input: {
		otpMs: number;
		email: string;
		pin: string;
		partCode: number;
	},
): Promise<{ strike?: number }> => {
	let otpRowsFilter = and(
		isNull(partsTable.to_ms),
		isNull(partsTable.to_by_ms),
		isNull(partsTable.to_in_ms),
		eq(partsTable.ms, input.otpMs),
		isNull(partsTable.by_ms),
		isNull(partsTable.in_ms),
		eq(partsTable.code, input.partCode),
		isNotNull(partsTable.txt),
		// isNotNull(partsTable.num),
	);
	let otpRows = await tdbPartsWhere(otpRowsFilter);
	// let otpRow = assert1Row(otpRows);
	// let otp: Otp = JSON.parse(otpRow.txt!);
	// if (!OtpSchema.safeParse(otp).success) throw new Error('Invalid OTP');
	// // console.log('otp:', otp);
	// if (input.email !== otp.email) throw new Error('Invalid email');
	// if (input.partCode && input.partCode !== otp.partCode) throw new Error('Invalid purpose');
	// if (input.pin !== otp.pin) {
	// 	otp.strike++;
	// 	if (otp.strike > 2) {
	// 		await tdbDeletePartsWhere(
	// 			or(
	// 				otpRowsFilter,
	// 				and(
	// 					isNull(partsTable.to_ms),
	// 					isNull(partsTable.to_by_ms),
	// 					isNull(partsTable.to_in_ms),
	// 					lt(partsTable.ms, now - 5 * minute), //
	// 					isNull(partsTable.by_ms),
	// 					isNull(partsTable.in_ms),
	// 					eq(partsTable.code, input.partCode),
	// 					isNotNull(partsTable.txt),
	// 				),
	// 			),
	// 		);
	// 	} else {
	// 		await tdbUpdateParts({ txt: JSON.stringify(otp) }).where(otpRowsFilter);
	// 	}
	// 	return { strike: otp.strike };
	// }
	// deleteIfCorrect && (await tdbDeletePartsWhere(otpRowsFilter));
	return {};
};

let assertSessionIsAuthorized = (ctx: Context, byMs?: null | number, inMs?: null | number) => {
	if (typeof byMs !== 'number' || byMs < 0) throw new Error('Invalid byMs');
	if (typeof inMs !== 'number' || inMs < 0) throw new Error('Invalid inMs');
	if (!ctx.session?.accountMss.includes(byMs)) throw new Error('Unauthorized by_ms');
	// TODO: Verify user by_ms has access to space in_ms
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
		signOut: t.procedure.input(z.number()).mutation(async ({ input, ctx }) => {
			if (!ctx.session) throw new Error('Missing session');
			let sessionRowFilter = makeSessionRowFilter(ctx.session.id);
			await tdbUpdateParts(
				makeSessionRowInsert(
					ctx.session.id,
					ctx.session.accountMss.filter((ms) => ms !== input),
				),
			).where(sessionRowFilter);
		}),
		getSignedInMss: t.procedure
			.input(z.object({ accountMss: z.array(z.number()) }))
			.mutation(async ({ input, ctx }) => {
				let signedInMsSet = new Set(ctx.session?.accountMss);
				return input.accountMss.filter((ms) => signedInMsSet.has(ms));
			}),
		sendOtp: t.procedure
			.input(
				z.object({
					email: z.string(),
					partCode: z
						.literal(partCodes.createAccountOtpWithPinColorEmailAndStrikeCount)
						.or(z.literal(partCodes.resetPasswordOtpWithPinColorEmailAndStrikeCount)),
				}),
			)
			.mutation(async ({ input }) => {
				input.partCode;
				let email = input.email.trim().toLowerCase();
				assertEmail(email);
				let accountRow = await getEmailRow(email);
				if (
					input.partCode === partCodes.createAccountOtpWithPinColorEmailAndStrikeCount &&
					accountRow
				)
					throw new Error(m.anAccountWithThatEmailAlreadyExists());
				// if (
				// 	input.partCode === partCodes.resetPasswordOtpWithPinColorEmailAndStrikeCount &&
				// 	!accountRow
				// )
				// 	throw new Error(m.accountDoesNotExist());
				// return await sendOtp(email, input.partCode);
			}),
		checkOtp: t.procedure
			.input(
				z.object({
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
				}),
			)
			.mutation(async ({ input }) => {
				assertEmail(input.email);
				// return await checkOtp(Date.now(), false, input);
			}),
		createAccount: t.procedure
			.input(
				z.object({
					name: z.string().min(0).max(88),
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
					password: z.string(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				assertEmail(input.email);
				let ms = Date.now();
				// let res = await checkOtp(ms, true, { ...input, purpose: 'create-account' });
				// if (res.strike) throw new Error(`Otp check failed`);
				// let emailRow = await getEmailRow(input.email);
				// if (emailRow) throw new Error(m.anAccountWithThatEmailAlreadyExists());
				// let rowsForAccount = await tdbInsertParts([
				// 	{
				// 		ms,
				// 		tag: ' account',
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		tag: ' pwHash',
				// 		txt: await argon2.hash(input.password),
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		txt: ctx.clientId,
				// 		tag: ' clientId',
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		tag: ' name',
				// 		txt: input.name.trim(),
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		tag: ' email',
				// 		txt: input.email,
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		tag: ' spaceMss',
				// 		txt: JSON.stringify(['', 0, 1]),
				// 	},
				// 	{
				// 		ms,
				// 		to_ms: ms,
				// 		tag: ' savedTags',
				// 		txt: JSON.stringify([]),
				// 	},
				// ]).returning();
				// console.log('rowsForAccount:', rowsForAccount);
				// let account = reduceRowsForAccount(rowsForAccount);
				// if (!AccountSchema.safeParse(account).success) throw new Error('Invalid account');
				// console.log('account:', account);
				// if (ctx.session) {
				// 	await tdbDeletePartsWhere(makeSessionRowFilter(ctx.session.id));
				// }
				// await createSession(
				// 	ctx,
				// 	[
				// 		...new Set([
				// 			account.ms as number, //
				// 			...(ctx.session?.accountMss || []),
				// 		]),
				// 	].sort(),
				// );
				// return { account };
				return { account: {} };
			}),
		signIn: t.procedure
			.input(
				z.object({
					otpMs: z.number().optional(),
					pin: z.string().length(8).optional(),
					email: z.string(),
					password: z.string(),
				}),
			)
			.mutation(async ({ input, ctx }) => {
				// : Promise<{
				// 	otpMs?: number;
				// 	strike?: number;
				// 	account?: any;
				// }>
				// let email = input.email.trim().toLowerCase();
				// assertEmail(email);
				// let emailRow = await getEmailRow(email);
				// if (!emailRow) throw new Error(m.accountDoesNotExist());
				// let accountMs = emailRow.in_ms!;
				// let pwHashRows = await tdbPartsWhere(
				// 	and(
				// 		isNull(partsTable.to_ms),
				// 		isNull(partsTable.to_by_ms),
				// 		isNull(partsTable.to_in_ms),
				// 		isNull(partsTable.ms),
				// 		isNull(partsTable.by_ms),
				// 		eq(partsTable.in_ms, accountMs),
				// 		eq(partsTable.code, partCodes.accountPwHashToAccountId),
				// 		isNotNull(partsTable.txt),
				// 	),
				// );
				// let pwHashRow = assert1Row(pwHashRows);
				// if (!(await argon2.verify(pwHashRow.txt!, input.password))) {
				// 	throw new Error(m.invalidPassword());
				// }
				// let clientIdRows = await tdbPartsWhere(
				// 	and(
				// 		isNull(partsTable.to_ms),
				// 		isNull(partsTable.to_by_ms),
				// 		isNull(partsTable.to_in_ms),
				// 		isNull(partsTable.ms),
				// 		isNull(partsTable.by_ms),
				// 		eq(partsTable.in_ms, accountMs),
				// 		eq(partsTable.code, partCodes.txtAsClientIdToAccountId),
				// 		eq(partsTable.txt, ctx.clientId),
				// 	),
				// );
				// let clientIdRow = assertLt2Rows(clientIdRows);
				// if (!clientIdRow) {
				// 	if (input.otpMs && input.pin) {
				// 		let res = await checkOtp(Date.now(), true, {
				// 			...input,
				// 			// TODO: Remove the next 2 lines without ts complaining
				// 			otpMs: input.otpMs,
				// 			pin: input.pin,
				// 			partCode: partCodes.signInOtpWithPinColorEmailAndStrikeCount,
				// 		});
				// 		return res.strike ? res : await getAccountByMs(accountMs, email);
				// 	} else return await sendOtp(email, partCodes.signInOtpWithPinColorEmailAndStrikeCount);
				// }
				// return await getAccountByMs(accountMs, email);
			}),
		resetPassword: t.procedure
			.input(
				z.object({
					otpMs: z.number(),
					pin: z.string().length(8),
					email: z.string(),
					password: z.string(),
				}),
			) //
			.mutation(async ({ input }) => {
				let email = input.email.trim().toLowerCase();
				assertEmail(email);
				let now = Date.now();
				let res = await checkOtp(now, true, {
					...input,
					partCode: partCodes.resetPasswordOtpWithPinColorEmailAndStrikeCount,
				});
				if (res.strike) return res;
				let accountRow = await getEmailRow(email);
				// if (!accountRow) throw new Error(`accountRow dne`);

				// await tdbUpdateParts({
				// 	tag: ' pwHash',
				// 	txt: await argon2.hash(input.password),
				// }).where(
				// 	and(
				// 		isNull(partsTable.to_ms),
				// 		isNull(partsTable.to_by_ms),
				// 		isNull(partsTable.to_in_ms),
				// 		eq(partsTable.ms, accountRow.ms!),
				// 		isNull(partsTable.by_ms),
				// 		isNull(partsTable.in_ms),
				// 		eq(partsTable.code, partCodes.account),
				// 		isNull(partsTable.txt),
				// 	),
				// );
			}),
	}),
	getAccountByMs: t.procedure
		.input(
			z.object({
				callerMs: z.number(),
				spaceMssMs: z.number().optional(),
				savedTagsMs: z.number().optional(),
				emailMs: z.number().optional(),
				nameMs: z.number().optional(),
			}),
		)
		.query(async ({ input, ctx }) => {
			assertSessionIsAuthorized(ctx, input.callerMs, 0);
			let { account } = await getAccountByMs(input.callerMs);
			if (!account.savedTagsMs || account.savedTagsMs === input.savedTagsMs) return;
			let savedTagsRows = await tdb
				.select()
				.from(partsTable)
				.where(
					and(
						isNull(partsTable.to_ms),
						isNull(partsTable.to_by_ms),
						isNull(partsTable.to_in_ms),
						isNull(partsTable.ms),
						eq(partsTable.by_ms, input.callerMs),
						isNull(partsTable.in_ms),
						// eq(partsTable.code, ' savedTags'),
						isNotNull(partsTable.txt),
					),
				);
			if (savedTagsRows.length > 1) throw new Error('Multiple savedTagsRows found');
			let savedTagsRow = savedTagsRows[0];
			let savedTags: string[] = savedTagsRow ? JSON.parse(savedTagsRow.txt!) : [];
			return { savedTags, savedTagsMs: savedTagsRow.ms! };
		}),
	updateSavedTags: t.procedure
		.input(
			z.object({
				callerMs: z.number(),
				adding: z.array(z.string()),
				removing: z.array(z.string()),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			assertSessionIsAuthorized(ctx, input.callerMs, 0);
			let now = Date.now();
			let savedTagsRowFilter = and(
				isNull(partsTable.to_ms),
				isNull(partsTable.to_by_ms),
				isNull(partsTable.to_in_ms),
				isNull(partsTable.ms),
				isNull(partsTable.by_ms),
				eq(partsTable.in_ms, input.callerMs),
				// eq(partsTable.code, ' savedTags'),
				isNotNull(partsTable.txt),
			);
			let savedTagsRows = await tdbPartsWhere(savedTagsRowFilter);
			if (savedTagsRows.length > 1) throw new Error('Multiple savedTagsRows found');
			let savedTagsRow = savedTagsRows[0];
			if (!savedTagsRow) throw new Error('savedTagsRow dne');
			let savedTags: string[] = JSON.parse(savedTagsRow.txt!);
			let removingSet = new Set(input.removing);
			let newSavedTags: string[] = normalizeTags([...savedTags, ...input.adding]).filter(
				(t) => !removingSet.has(t),
			);
			await tdbUpdateParts({
				ms: now,
				txt: JSON.stringify(newSavedTags),
			}).where(savedTagsRowFilter);
			return { savedTagsMs: now };
		}),
	addPost: t.procedure.input(PostSchema).mutation(
		async ({
			input: p,
			ctx, //
		}) => {
			assertSessionIsAuthorized(ctx, p.by_ms, p.in_ms);
			return _addPost(tdb, p);
		},
	),
	editPost: t.procedure.input(PostSchema).mutation(
		async ({
			input: t,
			ctx, //
		}) => {
			assertSessionIsAuthorized(ctx, t.by_ms, t.in_ms);
			return _editPost(tdb, t);
		},
	),
	deletePost: t.procedure
		.input(
			z.object({
				postSplitIdToSplitId: SplitIdToSplitIdSchema,
				version: z.number(),
			}),
		)
		.mutation(
			async ({
				input,
				ctx, //
			}) => {
				assertSessionIsAuthorized(
					ctx,
					input.postSplitIdToSplitId.by_ms,
					input.postSplitIdToSplitId.in_ms,
				);
				return _deletePost(tdb, input.postSplitIdToSplitId, input.version);
			},
		),
	getPostFeed: t.procedure.input(GetPostFeedSchema).mutation(async ({ input: q, ctx }) => {
		if (q.callerMs && !ctx.session?.accountMss.includes(q.callerMs))
			throw new Error('Unauthorized callerMs');

		return _getPostFeed(tdb, q);
	}),
	getPostHistory: t.procedure
		.input(
			z.object({
				postSplitIdToSplitId: SplitIdToSplitIdSchema,
				version: z.number(),
			}),
		)
		.mutation(async ({ input, ctx }) => {
			assertSessionIsAuthorized(
				ctx,
				input.postSplitIdToSplitId.by_ms,
				input.postSplitIdToSplitId.in_ms,
			);
			return _getPostHistory(tdb, input.postSplitIdToSplitId, input.version);
		}),
});

// https://trpc.io/docs/server/server-side-calls
export const createCaller = t.createCallerFactory(router);
export type Router = typeof router;
