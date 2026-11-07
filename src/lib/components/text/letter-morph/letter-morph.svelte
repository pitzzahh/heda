<script lang="ts">
	import { untrack } from 'svelte';
	import { cn } from '#lib/utils/index.js';
	import { createLetterMorph } from './letters.js';
	import { type LetterMorphSize, type LetterMorphVariant, letterMorph } from './variants.js';

	let {
		text,
		as = 'span',
		variant = 'default',
		size = 'inherit',
		class: classProp,
		id
	}: {
		/** The label; change it to morph. */
		text: string;
		as?: 'span' | 'div' | 'p' | 'strong' | 'h1' | 'h2' | 'h3';
		variant?: LetterMorphVariant;
		size?: LetterMorphSize;
		class?: string;
		id?: string;
	} = $props();

	// Server and first paint only; after that the engine owns the letters.
	const initialText = untrack(() => text);
	const s = $derived(letterMorph({ variant, size }));
	let frame = $state<HTMLElement>();
	let track = $state<HTMLElement>();
	let engine: ReturnType<typeof createLetterMorph> | null = null;

	$effect(() => {
		const f = frame;
		const t = track;
		if (!f || !t) return;
		const created = untrack(() => createLetterMorph(f, t, initialText, { glyph: s.glyph() }));
		engine = created;
		return () => created.destroy();
	});
	$effect(() => {
		engine?.update({ glyph: s.glyph() });
		engine?.set(text);
	});
</script>

<svelte:element this={as} {id} data-slot="letter-morph" class={cn(s.root(), classProp)}>
	<span class="sr-only">{text}</span>
	<span bind:this={frame} aria-hidden="true" class={s.frame()}>
		<span bind:this={track} class={s.track()}>{initialText}</span>
	</span>
</svelte:element>
