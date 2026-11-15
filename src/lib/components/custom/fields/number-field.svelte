<script lang="ts" module>
	import type { FormStore } from '@formisch/svelte';

	interface Props {
		form: FormStore;
		path: ['circuit_number'] | ['quantity'] | ['length'];
		label: string;
		hint?: string;
		placeholder: string;
		invalid?: boolean;
		wrapper_class?: string;
	}
</script>

<script lang="ts">
	import { Field } from '@formisch/svelte';
	import { Input } from '#lib/components/ui/input/index.js';
	import { Label } from '#lib/components/ui/label/index.js';
	import FieldErrors from '#lib/components/custom/field-errors.svelte';
	import { cn } from '#lib/utils/index.js';

	let { form, path, label, hint, placeholder, invalid, wrapper_class }: Props = $props();
</script>

<Field of={form} {path}>
	{#snippet children(field)}
		<div class={wrapper_class ?? 'flex min-w-0 flex-col gap-2'}>
			<Label class={cn({ 'text-destructive': invalid || field.errors })}>{label}</Label>
			<Input
				{...field.props}
				type="number"
				inputmode="numeric"
				min={1}
				class={cn({ 'border-destructive': invalid })}
				value={(field.input ?? '') as string | number}
				oninput={(e) => field.onInput(e.currentTarget.valueAsNumber)}
				{placeholder}
			/>
			{#if hint}
				<p class="text-[0.8rem] text-muted-foreground">{hint}</p>
			{/if}
			<FieldErrors errors={field.errors} />
		</div>
	{/snippet}
</Field>
