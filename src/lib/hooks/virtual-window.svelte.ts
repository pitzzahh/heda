import {
	Virtualizer,
	elementScroll,
	measureElement as defaultMeasureElement,
	observeElementOffset,
	observeElementRect,
	type VirtualItem
} from '@tanstack/virtual-core';

export type VirtualWindowOptions = {
	/** Estimated size of one item before it is measured. */
	estimate_size: number;
	/** Extra items rendered above and below the viewport. */
	overscan?: number;
	/** Items rendered before the viewport has been measured. */
	initial_render_count?: number;
	/** Attribute holding the item index on measured elements. */
	index_attribute?: string;
	/** Stable key per item index. Defaults to the index itself. */
	get_item_key?: (index: number) => string | number;
	/** Keep the last rendered window while the viewport is hidden (0 height). */
	retain_last_window_when_hidden?: boolean;
};

/**
 * Headless virtual window shared by tables and trees.
 *
 * Wraps `@tanstack/virtual-core` so components only own markup: attach the
 * scroll element, measure rendered items, and read `visible_items`/`content_size`.
 * The class keeps the imperative virtualizer lifecycle out of components.
 */
export class VirtualWindow {
	estimate_size = 0;
	initial_render_count = 20;
	count = $state(0);
	items = $state<VirtualItem[]>([]);
	total_size = $state(0);
	scroll_element = $state<Element | null>(null);

	#virtualizer: Virtualizer<Element, Element>;
	#get_item_key: (index: number) => string | number;
	#retain_last_window_when_hidden: boolean;
	#has_measured_viewport = $state(false);

	constructor(options: VirtualWindowOptions) {
		this.estimate_size = options.estimate_size;
		this.initial_render_count = options.initial_render_count ?? 20;
		this.#get_item_key = options.get_item_key ?? ((index) => index);
		this.#retain_last_window_when_hidden = options.retain_last_window_when_hidden ?? true;

		this.#virtualizer = new Virtualizer<Element, Element>({
			count: 0,
			getScrollElement: () => this.scroll_element,
			estimateSize: () => options.estimate_size,
			overscan: options.overscan ?? 10,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			indexAttribute: options.index_attribute ?? 'data-index',
			getItemKey: (index) => this.#get_item_key(index),
			// Hidden elements report 0 and would poison the size cache,
			// cascading the window; unmeasured items keep the estimate.
			measureElement: (node, entry, instance) => {
				const size = defaultMeasureElement(node, entry, instance);
				if (size === 0) return instance.options.estimateSize(instance.indexFromElement(node));
				return size;
			},
			onChange: (instance) => this.#handleChange(instance)
		});
	}

	/** Mounts observers and returns their cleanup for a component `$effect`. */
	mount() {
		return this.#virtualizer._didMount();
	}

	/** Points the window at a scroll container. Safe to call with null until it mounts. */
	use_scroll_element(element: Element | null) {
		this.scroll_element = element;
	}

	/** Attach helper for `{@attach}` on a scroll container. */
	attach_scroll_element = (node: Element) => {
		this.use_scroll_element(node);
		return () => {
			if (this.scroll_element === node) this.use_scroll_element(null);
		};
	};

	/** Syncs item count/keys and the scroll element, then recomputes the window. */
	sync(count: number) {
		this.count = count;

		// Read the scroll element so effects re-run when it attaches/detaches.
		void this.scroll_element;

		// `setOptions` replaces the full option set, so preserve observers/onChange.
		this.#virtualizer.setOptions({
			...this.#virtualizer.options,
			count,
			getScrollElement: () => this.scroll_element,
			getItemKey: (index) => this.#get_item_key(index),
			onChange: (instance) => this.#handleChange(instance)
		});
		this.#virtualizer._willUpdate();
		this.#handleChange(this.#virtualizer);
	}

	/** Measures a rendered element; it must carry the configured index attribute. */
	measure = (node: Element) => {
		this.#virtualizer.measureElement(node);
	};

	/** Items to render, or a small head slice before the viewport is measured. */
	visible_items = $derived.by<VirtualItem[]>(() => {
		if (this.items.length > 0) return this.items;

		const head = Math.min(this.count, this.initial_render_count);
		return Array.from({ length: head }, (_, index) => {
			const size = this.estimate_size;
			return {
				index,
				key: this.#get_item_key(index),
				start: index * size,
				end: (index + 1) * size,
				size,
				lane: 0
			};
		});
	});

	/** Height the item container needs so the scrollbar stays accurate. */
	content_size = $derived(
		this.items.length > 0 ? this.total_size : this.count * this.estimate_size
	);

	padding_start = $derived(this.items.length > 0 ? Math.max(0, this.items[0]?.start ?? 0) : 0);
	padding_end = $derived(
		this.items.length > 0
			? Math.max(0, this.total_size - (this.items[this.items.length - 1]?.end ?? 0))
			: 0
	);

	#handleChange(instance: Virtualizer<Element, Element>) {
		const viewport_height = instance.scrollRect?.height ?? 0;
		if (viewport_height > 0) this.#has_measured_viewport = true;

		// A hidden panel reports a zero-height viewport. Keep the last rendered
		// window so revealing it again does not rebuild every row.
		if (
			viewport_height === 0 &&
			this.#has_measured_viewport &&
			this.#retain_last_window_when_hidden
		) {
			return;
		}

		this.items = instance.getVirtualItems();
		this.total_size = instance.getTotalSize();
	}
}
