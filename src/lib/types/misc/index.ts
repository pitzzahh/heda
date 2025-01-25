import type { default_terminal_temperatures } from "@/constants";

export type Temperature = (typeof default_terminal_temperatures)[keyof typeof default_terminal_temperatures];

export type UpdateState = 'stale' | 'available' | 'no_updates' | 'processing';

export type ButtonState = 'idle' | 'loading';

export type ExcelExportType = "LOAD_SCHEDULE" | "VOLTAGE_DROP"