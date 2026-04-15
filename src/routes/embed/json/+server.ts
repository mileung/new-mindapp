import type { RequestHandler } from './$types';

let corsHeaders = {
	'Access-Control-Allow-Origin': '*',
};

export let GET: RequestHandler = (event) => {
	// console.log('event:', event);

	let body = { test: 'hi' };

	return new Response(JSON.stringify(body), {
		status: 200,
		headers: {
			'Content-Type': 'application/json',
			...corsHeaders,
		},
	});
};

// await fetch('https://swapi.dev/api/people/1')
// await fetch('http://localhost:8888/embed')
// curl -I http://localhost:8888/embed/json
