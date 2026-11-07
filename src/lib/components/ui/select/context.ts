import { createContext } from 'svelte';
import type { SelectTriggerSize } from './variants.js';

export const [getSelectSize, setSelectSize] = createContext<() => SelectTriggerSize>();
