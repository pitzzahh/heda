import { setContext, getContext } from 'svelte';
import type { State } from '@/state/types';

/**
 * setState function creates a state rune store with initial data and sets it in the specified context.
 *
 * @param initialData - The initial state data for the context. It can be of type `EntityState`, or `CountState`.
 * @param context - The context key to set the state in.
 * @returns A state rune store that holds the state data.
 *
 * Usage:
 * ```
 * const state = setState<EntityState>({ user: null }, ENTITY_STATE_CTX);
 * ```
 */
export function setState<T extends State>(initialData: T, context: string) {
	const state = $state<T>(initialData);
	setContext(context, state);
	return state;
}

/**
 * getState function retrieves the state rune store from the specified context.
 *
 * @param context - The context key to get the state from.
 * @returns A state rune store that holds the state data.
 *
 * Usage:
 * ```
 * const state = getState<EntityState>(ENTITY_STATE_CTX);
 * ```
 */
export function getState<T extends State>(context: string): T {
	return getContext<T>(context);
}