import type { Handle } from '@sveltejs/kit';
import { paraglideMiddleware } from '$lib/paraglide/server';
import { sequence } from '@sveltejs/kit/hooks';
import { router } from '$lib/trpc/router';
import { createContext } from '$lib/trpc/context';
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
	createTRPCHandle({ router, createContext }),
);
