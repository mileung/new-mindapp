import { env } from '$env/dynamic/private';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient({
	...(env.DATABASE_URL && env.DATABASE_AUTH_TOKEN
		? {
				url: env.DATABASE_URL,
				authToken: env.DATABASE_AUTH_TOKEN,
			}
		: {
				url: 'file:global-test.db',
			}),
});

export const tdb = drizzle(client, { schema });
