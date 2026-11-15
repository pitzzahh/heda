import { debug, error, info, trace, warn } from '@tauri-apps/plugin-log';

const LOGGERS = { log: trace, debug, info, warn, error } as const;

/**
 * Mirrors console output into the Tauri log file, keeping every argument in
 * the devtools output. Returns a function that restores the original methods.
 */
export function forwardConsoleToLog(): () => void {
	const restores = (Object.keys(LOGGERS) as (keyof typeof LOGGERS)[]).map((level) => {
		const original = console[level];
		const logger = LOGGERS[level];
		console[level] = (...args: unknown[]) => {
			original(...args);
			// A failed log write must not turn each console call into an unhandled rejection.
			logger(args.map(formatLogArg).join(' ')).catch(() => undefined);
		};
		return () => {
			console[level] = original;
		};
	});
	return () => restores.forEach((restore) => restore());
}

export function formatLogArg(arg: unknown): string {
	if (typeof arg === 'string') return arg;
	if (arg instanceof Error) return arg.stack ?? `${arg.name}: ${arg.message}`;
	try {
		return JSON.stringify(arg) ?? String(arg);
	} catch {
		return String(arg);
	}
}
