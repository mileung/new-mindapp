import { dev } from '$app/environment';
import { getTextDirection } from '$lib/paraglide/runtime';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { createContext } from '$lib/trpc/context';
import { router } from '$lib/trpc/router';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';
import { createTRPCHandle } from 'trpc-sveltekit';

let paraglideHandle: Handle = ({ event, resolve }) =>
	paraglideMiddleware(event.request, ({ request: localizedRequest, locale }) => {
		event.request = localizedRequest;
		return resolve(event, {
			transformPageChunk: ({ html }) => {
				return html.replace('%lang%', locale).replace('%dir%', getTextDirection(locale));
			},
		});
	});

export let handle: Handle = sequence(
	async ({ event, resolve }) => {
		// console.log('event:', !!event);
		let response = await resolve(event);
		// if (!event.url.pathname.startsWith('/embed')) {
		// 	response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		// 	response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		// }
		response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
		response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
		// if (event.url.pathname.startsWith('/embed')) {
		// 	response.headers.delete('Cross-Origin-Embedder-Policy');
		// 	response.headers.delete('Cross-Origin-Opener-Policy');
		// }
		return response;
	},
	paraglideHandle,
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
