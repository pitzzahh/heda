// eslint-disable-next-line @typescript-eslint/no-explicit-any
const themes: Record<string, any> = {
	autocad: {
		light: {
			background: '0 0% 100%',
			foreground: '0 0% 3.9%',
			card: '0 0% 100%',
			cardForeground: '0 0% 3.9%',
			popover: '0 0% 100%',
			popoverForeground: '0 0% 3.9%',
			primary: '0 72.2% 50.6%',
			primaryForeground: '0 85.7% 97.3%',
			secondary: '0 0% 96.1%',
			secondaryForeground: '0 0% 9%',
			muted: '0 0% 96.1%',
			mutedForeground: '0 0% 45.1%',
			accent: '0 0% 96.1%',
			accentForeground: '0 0% 9%',
			destructive: '0 72.22% 50.59%',
			destructiveForeground: '0 0% 98%',
			border: '0 0% 89.8%',
			input: '0 0% 89.8%',
			ring: '0 72.2% 50.6%',
			radius: '0rem'
		},
		dark: {
			background: '0 0% 3.9%',
			foreground: '0 0% 98%',
			card: '0 0% 3.9%',
			cardForeground: '0 0% 98%',
			popover: '0 0% 3.9%',
			popoverForeground: '0 0% 98%',
			primary: '0 72.2% 50.6%',
			primaryForeground: '0 85.7% 97.3%',
			secondary: '0 0% 14.9%',
			secondaryForeground: '0 0% 98%',
			muted: '0 0% 14.9%',
			mutedForeground: '0 0% 63.9%',
			accent: '0 0% 14.9%',
			accentForeground: '0 0% 98%',
			destructive: '0 62.8% 30.6%',
			destructiveForeground: '0 0% 98%',
			border: '0 0% 14.9%',
			input: '0 0% 14.9%',
			ring: '0 72.2% 50.6%'
		}
	},
	excel: {
		light: {
			background: '0 0% 100%',
			foreground: '240 10% 3.9%',
			card: '0 0% 100%',
			cardForeground: '240 10% 3.9%',
			popover: '0 0% 100%',
			popoverForeground: '240 10% 3.9%',
			primary: '142.1 76.2% 36.3%',
			primaryForeground: '355.7 100% 97.3%',
			secondary: '240 4.8% 95.9%',
			secondaryForeground: '240 5.9% 10%',
			muted: '240 4.8% 95.9%',
			mutedForeground: '240 3.8% 46.1%',
			accent: '240 4.8% 95.9%',
			accentForeground: '240 5.9% 10%',
			destructive: '0 72.22% 50.59%',
			destructiveForeground: '0 0% 98%',
			border: '240 5.9% 90%',
			input: '240 5.9% 90%',
			ring: '142.1 76.2% 36.3%',
			radius: '0rem'
		},
		dark: {
			background: '20 14.3% 4.1%',
			foreground: '0 0% 95%',
			card: '24 9.8% 10%',
			cardForeground: '0 0% 95%',
			popover: '0 0% 9%',
			popoverForeground: '0 0% 95%',
			primary: '142.1 70.6% 45.3%',
			primaryForeground: '144.9 80.4% 10%',
			secondary: '240 3.7% 15.9%',
			secondaryForeground: '0 0% 98%',
			muted: '0 0% 15%',
			mutedForeground: '240 5% 64.9%',
			accent: '12 6.5% 15.1%',
			accentForeground: '0 0% 98%',
			destructive: '0 62.8% 30.6%',
			destructiveForeground: '0 85.7% 97.3%',
			border: '240 3.7% 15.9%',
			input: '240 3.7% 15.9%',
			ring: '142.4 71.8% 29.2%'
		}
	}
};

export default function setGlobalColorTheme(themeMode: 'light' | 'dark', color: string) {
	const theme = themes[color][themeMode] as {
		[key: string]: string;
	};

	for (const key in theme) {
		document.documentElement.style.setProperty(`--${key}`, theme[key]);
	}
}
