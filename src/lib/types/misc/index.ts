import type { ambient_temperatures } from "@/constants";

export type Temperature = (typeof ambient_temperatures)[number]['value'];