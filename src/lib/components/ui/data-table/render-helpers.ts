import type { Component, ComponentProps, Snippet } from 'svelte';

/** Adapter-internal marker for Svelte components in `columnDef.cell`/`header`. */
export class RenderComponentConfig<TComponent extends Component> {
	component: TComponent;
	props: ComponentProps<TComponent> | Record<string, never>;
	constructor(
		component: TComponent,
		props: ComponentProps<TComponent> | Record<string, never> = {}
	) {
		this.component = component;
		this.props = props;
	}
}

/** Adapter-internal marker for Svelte snippets in `columnDef.cell`/`header`. */
export class RenderSnippetConfig<TProps> {
	snippet: Snippet<[TProps]>;
	params: TProps;
	constructor(snippet: Snippet<[TProps]>, params: TProps) {
		this.snippet = snippet;
		this.params = params;
	}
}

/** Wraps a Svelte component for `columnDef.cell`/`header` (snippets use `renderSnippet`). */
export function renderComponent<
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	T extends Component<any>,
	Props extends ComponentProps<T>
>(component: T, props: Props) {
	return new RenderComponentConfig(component, props);
}

/** Wraps a single-parameter snippet for `columnDef.cell`/`header`. */
export function renderSnippet<TProps>(snippet: Snippet<[TProps]>, params: TProps) {
	return new RenderSnippetConfig(snippet, params);
}
