import type { default_terminal_temperatures, specials } from "@/constants";

export type Temperature = (typeof default_terminal_temperatures)[keyof typeof default_terminal_temperatures];

export type Special = (typeof specials)[number]['value'];

export type UpdateState = 'stale' | 'available' | 'no_updates' | 'processing';

export type ButtonState = 'idle' | 'loading';