<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type { PopoutWindow } from '#lib/helpers/popout.js';

	export interface PopoutControls {
		dock: () => void;
		focus: () => void;
	}

	export interface Props {
		/** Popout window title and its header label. */
		title: string;
		/** Initial popout size in CSS pixels. */
		width?: number;
		height?: number;
		/** Shown in place of the content while it lives in its own window. */
		placeholder?: Snippet<[PopoutControls]>;
		onPoppedChange?: (popped: boolean) => void;
		children: Snippet;
	}

	const DEFAULT_WIDTH = 1100;
	const DEFAULT_HEIGHT = 720;
</script>

<script lang="ts">
	import { getAllContexts, mount, onMount, unmount } from 'svelte';
	import { on } from 'svelte/events';
	import { toast } from 'svelte-sonner';
	import { Button } from '#lib/components/ui/button/index.js';
	import { AppWindowIcon, ArrowSquareInIcon } from '#lib/assets/icons.js';
	import {
		closePopoutWindow,
		focusPopoutWindow,
		mirrorDocumentStyles,
		openPopoutWindow,
		watchWindowClosed
	} from '#lib/helpers/popout.js';
	import PopoutHost from './popout-host.svelte';

	let {
		title,
		width = DEFAULT_WIDTH,
		height = DEFAULT_HEIGHT,
		placeholder,
		onPoppedChange,
		children
	}: Props = $props();

	// Captured at init: the popout mounts outside this tree but must see the same contexts.
	const context = getAllContexts();
	let popped = $state(false);
	let session: { popout: PopoutWindow; close: () => void } | null = null;

	// A popout must never outlive the content it shows: not this component, and not
	// the opener page (a reload or closed tab would leave it rendering dead state).
	onMount(() => {
		const off = on(window, 'pagehide', dock);
		return () => {
			off();
			dock();
		};
	});

	/** Moves the content into its own window, or focuses the one already open. */
	export function popOut() {
		if (session) return focus();
		const popout = openPopoutWindow(title, width, height);
		if (!popout) {
			toast.error('Could not open a new window.', {
				description: 'Allow pop-up windows for this app, then try again.'
			});
			return;
		}
		const { win } = popout;
		const stopMirror = mirrorDocumentStyles(document, win.document);
		const host = mount(PopoutHost, {
			target: win.document.body,
			props: {
				// Getter, so the header follows a renamed or switched node.
				get title() {
					return title;
				},
				portal_target: win.document.body,
				ondock: dock,
				children
			},
			context
		});
		const stopWatch = watchWindowClosed(win, dock);
		session = {
			popout,
			close: () => {
				stopWatch();
				void unmount(host);
				stopMirror();
				if (win.closed) return;
				closePopoutWindow(popout).catch((error) => {
					console.warn('Could not close the popout window', error);
				});
			}
		};
		setPopped(true);
	}

	/** Closes the popout window and shows the content here again. */
	export function dock() {
		if (!session) return;
		const { close } = session;
		session = null;
		close();
		setPopped(false);
	}

	export function focus() {
		if (!session) return;
		focusPopoutWindow(session.popout).catch((error) => {
			console.warn('Could not focus the popout window', error);
		});
	}

	function setPopped(value: boolean) {
		popped = value;
		onPoppedChange?.(value);
	}
</script>

{#if popped}
	{#if placeholder}
		{@render placeholder({ dock, focus })}
	{:else}
		<div
			class="grid min-h-0 flex-1 place-items-center rounded-xl border border-dashed border-border bg-card p-6"
		>
			<div class="grid justify-items-center gap-3 text-center">
				<p class="text-sm text-muted-foreground">{title} is open in a separate window.</p>
				<div class="flex gap-2">
					<Button variant="outline" size="sm" onclick={focus}>
						<AppWindowIcon />
						Show window
					</Button>
					<Button size="sm" onclick={dock}>
						<ArrowSquareInIcon />
						Dock back
					</Button>
				</div>
			</div>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}
