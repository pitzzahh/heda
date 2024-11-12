import type { ambient_temperatures, specials } from "@/constants";

export type Temperature = (typeof ambient_temperatures)[number]['value'];

export type Special = (typeof specials)[number]['value'];