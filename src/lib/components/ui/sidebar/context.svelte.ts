/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsMobile } from '$lib/hooks/is-mobile.svelte.js';
import { getContext, setContext } from 'svelte';
import {
	SIDEBAR_KEYBOARD_SHORTCUT,
	SIDEBAR_MAX_WIDTH,
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MIN_WIDTH
} from './constants.js';
import { PersistedState } from 'runed';
type Getter<T> = () => T;

export type SidebarStateProps = {
	/**
	 * A getter function that returns the current open state of the sidebar.
	 * We use a getter function here to support `bind:open` on the `Sidebar.Provider`
	 * component.
	 */
	open: Getter<boolean>;

	/**
	 * A function that sets the open state of the sidebar. To support `bind:open`, we need
	 * a source of truth for changing the open state to ensure it will be synced throughout
	 * the sub-components and any `bind:` references.
	 */
	setOpen: (open: boolean) => void;
};

class SidebarState {
	readonly props: SidebarStateProps;
	localStorage: PersistedState<{ sidebar_width: number }>;
	open = $derived.by(() => this.props.open());
	openMobile = $state(false);
	setOpen: SidebarStateProps['setOpen'];
	#isMobile: IsMobile;
	state = $derived.by(() => (this.open ? 'expanded' : 'collapsed'));
	sidebarWidth = $state(0);
	isResizing = $state(false);

	constructor(props: SidebarStateProps) {
		const localStorage = new PersistedState<{ sidebar_width: number }>('sidebar', { sidebar_width: SIDEBAR_DEFAULT_WIDTH });

		this.setOpen = props.setOpen;
		this.#isMobile = new IsMobile();
		this.props = props;
		this.localStorage = localStorage;
		this.sidebarWidth = localStorage?.current?.sidebar_width || SIDEBAR_DEFAULT_WIDTH;
	}

	// Convenience getter for checking if the sidebar is mobile
	// without this, we would need to use `sidebar.isMobile.current` everywhere
	get isMobile() {
		return this.#isMobile.current;
	}

	// Event handler to apply to the `<svelte:window>`
	handleShortcutKeydown = (e: KeyboardEvent) => {
		if (e.key === SIDEBAR_KEYBOARD_SHORTCUT && (e.metaKey || e.ctrlKey)) {
			e.preventDefault();
			this.toggle();
		}
	};

	handleMouseDown(e: any) {
		this.isResizing = true;
		document.body.style.cursor = 'ew-resize';

		const startX = e.clientX;
		const startWidth = this.sidebarWidth;

		const onMouseMove = (e: any) => {
			if (this.isResizing) {
				const newWidth = startWidth + (e.clientX - startX);
				if (newWidth <= SIDEBAR_MIN_WIDTH) {
					this.setOpen(false);
					onMouseUp();
				}

				if (newWidth <= SIDEBAR_MAX_WIDTH) {
					this.sidebarWidth = newWidth;
					this.localStorage.current = { ...this.localStorage.current, sidebar_width: newWidth };
				}
			}
		};

		const onMouseUp = () => {
			this.isResizing = false;

			// Reset the cursor to default after resizing
			document.body.style.cursor = 'default';

			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('mouseup', onMouseUp);
		};

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('mouseup', onMouseUp);
	}

	setOpenMobile = (value: boolean) => {
		this.openMobile = value;
	};

	toggle = () => {
		if (this.#isMobile.current) {
			this.openMobile = !this.openMobile;
		} else {
			this.setOpen(!this.open);
			if (this.sidebarWidth < SIDEBAR_MIN_WIDTH) {
				this.sidebarWidth = SIDEBAR_DEFAULT_WIDTH;
			}
		}
	};
}

const SYMBOL_KEY = 'scn-sidebar';

/**
 * Instantiates a new `SidebarState` instance and sets it in the context.
 *
 * @param props The constructor props for the `SidebarState` class.
 * @returns  The `SidebarState` instance.
 */
export function setSidebar(props: SidebarStateProps): SidebarState {
	return setContext(Symbol.for(SYMBOL_KEY), new SidebarState(props));
}

/**
 * Retrieves the `SidebarState` instance from the context. This is a class instance,
 * so you cannot destructure it.
 * @returns The `SidebarState` instance.
 */
export function useSidebar(): SidebarState {
	return getContext(Symbol.for(SYMBOL_KEY));
}
