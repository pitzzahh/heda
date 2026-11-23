import type * as v from 'valibot';
import type { TITLE_BLOCK_SCHEMA } from '#lib/validators/title-block.js';

export type TitleBlock = v.InferOutput<typeof TITLE_BLOCK_SCHEMA>;
