import { engine } from './api.js';
import type { Catalog } from '#lib/types/catalog.js';

let loaded: Catalog | undefined;
let loading: Promise<void> | undefined;

/** Reads the engine's PEC 2017 choices once; the root layout awaits it before any page. */
export function loadCatalog(): Promise<void> {
	loading ??= engine<Catalog>('catalog').then((catalog) => {
		loaded = catalog;
	});
	return loading;
}

/** The engine's PEC 2017 choices (`catalog` in `crates/heda-core`), read synchronously. */
export function getCatalog(): Catalog {
	if (!loaded) throw new Error('The PEC catalog is read at startup; await loadCatalog() first.');
	return loaded;
}
