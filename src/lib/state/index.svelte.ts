import { setContext, getContext } from 'svelte';
import type { State } from '#lib/state/types.js';

export function setState<T extends State>(initialData: T, context: string) {
	const state = $state<T>(initialData);
	setContext(context, state);
	return state;
}

export function getState<T extends State>(context: string): T {
	return getContext<T>(context);
}
