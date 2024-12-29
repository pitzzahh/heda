<script module lang="ts">
	interface Props {
		title?: string;
		description?: string;
		onConfirm: () => void;
		trigger_variant?: ButtonVariant;
		trigger_text?: string;
		trigger_icon?: Snippet;
		button_state?: 'stale' | 'processing';
		open_dialog_state?: boolean;
		some_open_state?: boolean;
		show_trigger?: boolean;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { cn } from '@/utils';
	import { Loader } from '@/assets/icons';
	import * as AlertDialog from '@/components/ui/alert-dialog/index.js';
	import { buttonVariants, type ButtonVariant } from '@/components/ui/button/index.js';

	let {
		title = 'Are you absolutely sure?',
		description = 'This action cannot be undone. This will permanently remove whatever you are trying to delete.',
		onConfirm,
		trigger_variant = 'outline',
		trigger_text,
		trigger_icon,
		button_state = $bindable('stale'),
		show_trigger = $bindable(false),
		open_dialog_state = $bindable(false),
		some_open_state = $bindable(),
		...rest
	}: Props = $props();
</script>

<AlertDialog.Root
	{...rest}
	bind:open={open_dialog_state}
	onOpenChange={(o) => (some_open_state = o === true)}
>
	{#if show_trigger}
		<AlertDialog.Trigger
			class={buttonVariants({ variant: trigger_variant, className: 'w-full', size: 'sm' })}
		>
			{#if trigger_icon}
				{@render trigger_icon?.()}
			{/if}
			{#if trigger_text}
				{trigger_text}
			{/if}
		</AlertDialog.Trigger>
	{/if}
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>
				{description}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action
				onclick={onConfirm}
				class={cn(buttonVariants({ variant: trigger_variant }), {
					'disabled opacity-50 hover:cursor-not-allowed': button_state === 'processing'
				})}
			>
				<Loader
					class={cn('mr-1 hidden h-4 w-4 animate-spin', {
						block: button_state === 'processing'
					})}
				/>
				<span> {trigger_text ?? 'Continue'}</span>
			</AlertDialog.Action>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
