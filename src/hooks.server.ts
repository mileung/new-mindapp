import { dev } from '$app/environment';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createTRPCHandle } from 'trpc-sveltekit';

const handleParaglide: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request, locale }) => {
		event.request = request;
		return resolve(event, {
			transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', locale),
		});
	});

export const handle: Handle = sequence(
	async ({ event, resolve }) => {
		const response = await resolve(event);
		response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		return response;
	},
	handleParaglide,
	createTRPCHandle({
		router,
		createContext,
		onError: (e) => {
			if (dev) {
				let { error, type, path, input, ctx, req } = e;
				// console.error('tRPC error', {
				// 	type,
				// 	path,
				// 	input,
				// 	msg: error.message,
				// 	code: error.code,
				// 	stack: error.stack,
				// });
				// TODO: y dis print the wrong line number?
				console.log('tRPC error.stack:', error.stack);
			}
		},
	}),
);
