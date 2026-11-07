/* eslint-disable @typescript-eslint/no-explicit-any */
import { IsMobile } from '#lib/hooks/is-mobile.svelte.js';
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
	/** Getter/setter pair (not plain fields) so `bind:open` stays synced. */
	open: Getter<boolean>;
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
		const localStorage = new PersistedState<{ sidebar_width: number }>('sidebar', {
			sidebar_width: SIDEBAR_DEFAULT_WIDTH
		});

		this.setOpen = props.setOpen;
		this.#isMobile = new IsMobile();
		this.props = props;
		this.localStorage = localStorage;
		this.sidebarWidth = localStorage?.current?.sidebar_width || SIDEBAR_DEFAULT_WIDTH;
	}

	get isMobile() {
		return this.#isMobile.current;
	}

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

export function setSidebar(props: SidebarStateProps): SidebarState {
	return setContext(Symbol.for(SYMBOL_KEY), new SidebarState(props));
}

/** Class instance: do not destructure. */
export function useSidebar(): SidebarState {
	return getContext(Symbol.for(SYMBOL_KEY));
}
