import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

const client = createClient(
	dev
		? {
				url: 'file:global-test.db',
			}
		: {
				url: env.DATABASE_URL!,
				authToken: env.DATABASE_AUTH_TOKEN!,
			},
);

export const tdb = drizzle(client, { schema });
