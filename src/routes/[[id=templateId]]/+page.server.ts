import { error, redirect } from '@sveltejs/kit';

export const load = async ({ url, params }) => {
	// url.pathname
	const isValid = false;
	// if (!isValid) throw error(404, 'Not found');

	return {};
};
