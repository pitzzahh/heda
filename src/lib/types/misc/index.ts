import type { default_ambient_temperatures, specials } from "@/constants";

export type Temperature = (typeof default_ambient_temperatures)[keyof typeof default_ambient_temperatures];

export type Special = (typeof specials)[number]['value'];