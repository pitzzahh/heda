// eslint-disable-next-line @typescript-eslint/no-explicit-any
const themes: Record<string, any> = {
	// Excel is the default theme — these values mirror :root / .dark in app.css.
	excel: {
		light: {
			background: 'oklch(97.8% 0.0035 87.4)',
			foreground: 'oklch(23.5% 0.0120 178.3)',
			card: 'oklch(100% 0 0)',
			cardForeground: 'oklch(23.5% 0.0120 178.3)',
			popover: 'oklch(100% 0 0)',
			popoverForeground: 'oklch(23.5% 0.0120 178.3)',
			primary: 'oklch(51.9% 0.1174 157.2)',
			primaryForeground: 'oklch(98.1% 0.0086 164.9)',
			secondary: 'oklch(95.4% 0.0059 87.5)',
			secondaryForeground: 'oklch(27.1% 0.0167 178)',
			muted: 'oklch(94.6% 0.0057 87.5)',
			mutedForeground: 'oklch(50.5% 0.0208 171.3)',
			accent: 'oklch(95% 0.015 166.5)',
			accentForeground: 'oklch(30.1% 0.0414 165.7)',
			destructive: 'oklch(55% 0.1985 28.1)',
			destructiveForeground: 'oklch(98.5% 0 0)',
			border: 'oklch(91.7% 0.0082 87.5)',
			input: 'oklch(91.7% 0.0082 87.5)',
			ring: 'oklch(54.6% 0.1238 157.1)',
			radius: '0.75rem',
			sidebar: 'oklch(96.5% 0.005 87.4)',
			sidebarForeground: 'oklch(37.5% 0.0199 178.3)',
			sidebarPrimary: 'oklch(51.9% 0.1174 157.2)',
			sidebarPrimaryForeground: 'oklch(98.1% 0.0086 164.9)',
			sidebarAccent: 'oklch(94% 0.0074 88.8)',
			sidebarAccentForeground: 'oklch(30.1% 0.0414 165.7)',
			sidebarBorder: 'oklch(90.6% 0.0086 87.5)',
			sidebarRing: 'oklch(54.6% 0.1238 157.1)'
		},
		dark: {
			background: 'oklch(19.3% 0.0079 182)',
			foreground: 'oklch(94.2% 0.0072 164.9)',
			card: 'oklch(22.7% 0.0091 179.8)',
			cardForeground: 'oklch(94.2% 0.0072 164.9)',
			popover: 'oklch(23.9% 0.0107 179.6)',
			popoverForeground: 'oklch(94.2% 0.0072 164.9)',
			primary: 'oklch(70% 0.1483 157.9)',
			primaryForeground: 'oklch(21.5% 0.028 167.8)',
			secondary: 'oklch(27.7% 0.0112 179.8)',
			secondaryForeground: 'oklch(91.2% 0.0093 164.9)',
			muted: 'oklch(28.2% 0.0104 179.9)',
			mutedForeground: 'oklch(70.9% 0.0178 166.2)',
			accent: 'oklch(31.4% 0.0279 167.8)',
			accentForeground: 'oklch(90.2% 0.0336 164.1)',
			destructive: 'oklch(61% 0.1939 26.7)',
			destructiveForeground: 'oklch(97.1% 0.0127 17.4)',
			border: 'oklch(30.2% 0.0103 180)',
			input: 'oklch(30.2% 0.0103 180)',
			ring: 'oklch(70% 0.1483 157.9)',
			radius: '0.75rem',
			sidebar: 'oklch(21% 0.0086 182)',
			sidebarForeground: 'oklch(85.2% 0.0131 164.7)',
			sidebarPrimary: 'oklch(70% 0.1483 157.9)',
			sidebarPrimaryForeground: 'oklch(21.5% 0.028 167.8)',
			sidebarAccent: 'oklch(28.2% 0.0104 179.9)',
			sidebarAccentForeground: 'oklch(90.2% 0.0336 164.1)',
			sidebarBorder: 'oklch(28.7% 0.0107 179.9)',
			sidebarRing: 'oklch(70% 0.1483 157.9)'
		}
	},
	// Autocad — same neutrals, safety-red primary.
	autocad: {
		light: {
			background: 'oklch(97.8% 0.0035 87.4)',
			foreground: 'oklch(23.5% 0.0120 178.3)',
			card: 'oklch(100% 0 0)',
			cardForeground: 'oklch(23.5% 0.0120 178.3)',
			popover: 'oklch(100% 0 0)',
			popoverForeground: 'oklch(23.5% 0.0120 178.3)',
			primary: 'oklch(52.4% 0.1884 28)',
			primaryForeground: 'oklch(97.2% 0.0074 17.3)',
			secondary: 'oklch(95.4% 0.0059 87.5)',
			secondaryForeground: 'oklch(27.1% 0.0167 178)',
			muted: 'oklch(94.6% 0.0057 87.5)',
			mutedForeground: 'oklch(50.5% 0.0208 171.3)',
			accent: 'oklch(93.8% 0.0146 22.4)',
			accentForeground: 'oklch(27.8% 0.0574 21.5)',
			destructive: 'oklch(55% 0.1985 28.1)',
			destructiveForeground: 'oklch(98.5% 0 0)',
			border: 'oklch(91.7% 0.0082 87.5)',
			input: 'oklch(91.7% 0.0082 87.5)',
			ring: 'oklch(52.4% 0.1884 28)',
			radius: '0.75rem',
			sidebar: 'oklch(96.5% 0.005 87.4)',
			sidebarForeground: 'oklch(37.5% 0.0199 178.3)',
			sidebarPrimary: 'oklch(52.4% 0.1884 28)',
			sidebarPrimaryForeground: 'oklch(97.2% 0.0074 17.3)',
			sidebarAccent: 'oklch(94% 0.0074 88.8)',
			sidebarAccentForeground: 'oklch(27.8% 0.0574 21.5)',
			sidebarBorder: 'oklch(90.6% 0.0086 87.5)',
			sidebarRing: 'oklch(52.4% 0.1884 28)'
		},
		dark: {
			background: 'oklch(19.3% 0.0079 182)',
			foreground: 'oklch(94.2% 0.0072 164.9)',
			card: 'oklch(22.7% 0.0091 179.8)',
			cardForeground: 'oklch(94.2% 0.0072 164.9)',
			popover: 'oklch(23.9% 0.0107 179.6)',
			popoverForeground: 'oklch(94.2% 0.0072 164.9)',
			primary: 'oklch(62.2% 0.1862 26.1)',
			primaryForeground: 'oklch(17.9% 0.032 20.7)',
			secondary: 'oklch(27.7% 0.0112 179.8)',
			secondaryForeground: 'oklch(91.2% 0.0093 164.9)',
			muted: 'oklch(28.2% 0.0104 179.9)',
			mutedForeground: 'oklch(70.9% 0.0178 166.2)',
			accent: 'oklch(27.6% 0.0286 21.3)',
			accentForeground: 'oklch(85.6% 0.0392 22.8)',
			destructive: 'oklch(61% 0.1939 26.7)',
			destructiveForeground: 'oklch(97.1% 0.0127 17.4)',
			border: 'oklch(30.2% 0.0103 180)',
			input: 'oklch(30.2% 0.0103 180)',
			ring: 'oklch(62.2% 0.1862 26.1)',
			radius: '0.75rem',
			sidebar: 'oklch(21% 0.0086 182)',
			sidebarForeground: 'oklch(85.2% 0.0131 164.7)',
			sidebarPrimary: 'oklch(62.2% 0.1862 26.1)',
			sidebarPrimaryForeground: 'oklch(17.9% 0.032 20.7)',
			sidebarAccent: 'oklch(28.2% 0.0104 179.9)',
			sidebarAccentForeground: 'oklch(85.6% 0.0392 22.8)',
			sidebarBorder: 'oklch(28.7% 0.0107 179.9)',
			sidebarRing: 'oklch(62.2% 0.1862 26.1)'
		}
	}
};

const toKebab = (key: string) => key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

export default function setGlobalColorTheme(themeMode: 'light' | 'dark' | 'system', color: string) {
	if (themeMode === 'system') {
		themeMode = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
	}
	const theme = themes[color][themeMode] as {
		[key: string]: string;
	};
	const vars: Record<string, string> = {};
	for (const key in theme) {
		// Tailwind reads kebab-case vars (--card-foreground); the table keys are camelCase.
		const name = `--${toKebab(key)}`;
		document.documentElement.style.setProperty(name, theme[key]);
		vars[name] = theme[key];
	}
	try {
		// Pre-paint cache for the blocking theme script in app.html (no flash on boot).
		localStorage.setItem('heda-theme-v2', JSON.stringify({ dark: themeMode === 'dark', vars }));
	} catch {
		// Private mode: skip the cache, theming still applies above.
	}
}
