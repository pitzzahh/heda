import { untrack } from 'svelte';

// lg: phones and tablets get the slide-over sidebar, matching the drawer modals.
const MOBILE_BREAKPOINT = 1024;

export class IsMobile {
	#current = $state<boolean>(false);

	constructor() {
		// Subscribes to viewport changes; effect owns the media-query listener.
		$effect(() => {
			return untrack(() => {
				const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
				const onChange = () => {
					this.#current = window.innerWidth < MOBILE_BREAKPOINT;
				};
				mql.addEventListener('change', onChange);
				onChange();
				return () => {
					mql.removeEventListener('change', onChange);
				};
			});
		});
	}

	get current() {
		return this.#current;
	}
}
