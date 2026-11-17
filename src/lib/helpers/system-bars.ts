/** Set by `MainActivity.kt` in the Android app; absent everywhere else. */
type SystemBarsBridge = { set(color: string, dark: boolean): void };

/**
 * Tells the Android shell the page background, so the strips behind the status and
 * navigation bars match the in-app theme and their icons stay readable on it.
 */
export function syncSystemBars(dark: boolean): void {
	const bridge = (globalThis as { HedaSystemBars?: SystemBarsBridge }).HedaSystemBars;
	if (!bridge) return;
	const background = getComputedStyle(document.documentElement).getPropertyValue('--background');
	bridge.set(toHex(background.trim()), dark);
}

/** Any CSS colour (oklch included) as `#rrggbb`, which Android can parse. */
function toHex(color: string): string {
	const context = document.createElement('canvas').getContext('2d');
	// No canvas (jsdom): hand the colour on as is; Android ignores what it cannot parse.
	if (!context) return color;
	context.fillStyle = color;
	context.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
	return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}
