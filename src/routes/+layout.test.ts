import { describe, expect, it } from 'vitest';
import { load } from './+layout.js';
import { getDatabase } from '#lib/db/index.js';
import { getCurrentProject } from '#lib/db/queries/index.js';

describe('root layout load', () => {
	it('initializes the database before first render', async () => {
		expect(() => getDatabase()).toThrow();
		await load();
		expect(() => getDatabase()).not.toThrow();
		expect(getCurrentProject()).toBeUndefined();
	});
});
