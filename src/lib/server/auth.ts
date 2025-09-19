import { Resend } from 'resend';
import env from './env';
import { decrypt, encrypt, randomBase58 } from './security';
import { db } from '~/db';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { minute, second, signInTokenExpiry, year } from './time';
import { SelectUser, tableUsers } from '~/db/schema';
import { getRequestEvent } from 'solid-js/web';
import { RateLimiterMemory } from 'rate-limiter-flexible';

const decryptedSignInTokenSchema = z.object({
	email: z.string(),
	createTs: z.number(),
});
type DecryptedSignInToken = z.infer<typeof decryptedSignInTokenSchema>;

const decryptedAccessTokenSchema = z.object({
	joinTs: z.number(),
	createTs: z.number(),
});
type DecryptedAccessToken = z.infer<typeof decryptedAccessTokenSchema>;

function makeLimiter(pings: number, minutes: number) {
	const limiter = new RateLimiterMemory({
		points: pings,
		duration: (minutes * minute) / second,
	});
	return {
		ping: async () => {
			try {
				await limiter.consume(getRequestEvent()?.clientAddress || '');
				return { err: null };
			} catch (e) {
				return { err: 'tooManyRequests' };
			}
		},
	};
}

const emailLimiter = makeLimiter(3, 5);
async function email(config: { from: string; to: string; subject: string; html: string }) {
	const { err } = await emailLimiter.ping();
	if (err) throw new Error(err);
	const resend = new Resend(env.RESEND_API_KEY);
	const result = await resend.emails.send(config);
	return result;
}

export async function emailOtp(toEmail: string) {
	const otp = String(Math.random()).substring(2, 8);
	if (env.PROD) {
		const result = await email({
			from: 'onboarding@resend.dev',
			to: toEmail,
			subject: `Template OTP: ${otp}`,
			html: `Your one-time password for Template is:\n<p style="font-family: monospace; font-size: 24px; font-weight: bold;">${otp}</p>
		\n\nThis can only be used on the device used to request this email.`,
			// \n\nYou may also click this link to sign in on that device: ${}
		});
		if (result.error) throw new Error('emailFailedToSend');
	} else {
		console.log('otp:', otp);
	}
	const decryptedSignInToken: DecryptedSignInToken = {
		email: toEmail,
		createTs: Date.now(),
	};
	const signInToken = encrypt(decryptedSignInToken, otp + env.ENCRYPTION_KEY);
	return signInToken;
}

const verifyOtpLimiter = makeLimiter(3, 5);
export async function verifyOtp(signInToken: string, otp: string) {
	const { err } = await verifyOtpLimiter.ping();
	if (err) throw new Error(err);

	const now = Date.now();
	const decryptedSignInToken: DecryptedSignInToken = decrypt(signInToken, otp + env.ENCRYPTION_KEY);
	const { error } = decryptedSignInTokenSchema.safeParse(decryptedSignInToken);
	if (error) throw new Error('errorDecryptingSignInToken');
	if (now - decryptedSignInToken.createTs > signInTokenExpiry) throw new Error('expiredLoginLink');

	let user = (
		await db
			.select()
			.from(tableUsers)
			.where(eq(tableUsers.email, decryptedSignInToken.email))
			.limit(1)
	)[0];
	if (!user) {
		user = {
			joinTs: now,
			email: decryptedSignInToken.email,
			username: randomBase58(8),
			name: '',
			subscribed: true,
			lastSignInTs: now,
			lastSignOutTs: 0,
		};
		await db.insert(tableUsers).values(user);
	}
	const decryptedAccessToken: DecryptedAccessToken = {
		joinTs: user.joinTs,
		createTs: now,
	};
	const accessToken = encrypt(decryptedAccessToken, env.ENCRYPTION_KEY);
	return { user, accessToken };
}

export async function getUser(accessToken: string) {
	const decryptedAccessToken: DecryptedAccessToken = decrypt(accessToken, env.ENCRYPTION_KEY);
	const { error } = decryptedAccessTokenSchema.safeParse(decryptedAccessToken);
	if (error) throw new Error('errorDecryptingAccessToken');
	if (Date.now() - decryptedAccessToken.createTs > year) {
		throw new Error('expiredAccessToken');
	}
	let user = (
		await db
			.select()
			.from(tableUsers)
			.where(eq(tableUsers.joinTs, decryptedAccessToken.joinTs))
			.limit(1)
	)[0];
	if (!user) throw new Error('userNotFound');
	if (user.lastSignOutTs > decryptedAccessToken.createTs) {
		throw new Error('expiredAccessToken');
	}
	// console.log('user:', !!user);
	return user;
}

export async function signOut(accessToken: string) {
	const user = await getUser(accessToken);
	db.update(tableUsers)
		.set({ lastSignOutTs: Date.now() })
		.where(eq(tableUsers.joinTs, user.joinTs));
}
