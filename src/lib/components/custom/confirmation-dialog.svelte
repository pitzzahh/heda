<script lang="ts">
	import * as AlertDialog from '@/components/ui/alert-dialog/index.js';
	import { buttonVariants, type ButtonVariant } from '@/components/ui/button/index.js';

	interface Props {
		title?: string;
		description?: string;
		onConfirm: () => void;
		trigger_variant?: ButtonVariant;
		trigger_text: string;

	}

	let {
		title = 'Are you absolutely sure?',
		description = 'This action cannot be undone. This will permanently remove whatever you are trying to delete.',
		onConfirm,
		trigger_variant = 'outline',
		trigger_text,
		...rest
	}: Props = $props();
</script>

<AlertDialog.Root {...rest}>
	<AlertDialog.Trigger class={buttonVariants({ variant: trigger_variant, className: 'w-full', size:"sm" })}>
		{trigger_text}
	</AlertDialog.Trigger>
	<AlertDialog.Content>
		<AlertDialog.Header>
			<AlertDialog.Title>{title}</AlertDialog.Title>
			<AlertDialog.Description>
				{description}
			</AlertDialog.Description>
		</AlertDialog.Header>
		<AlertDialog.Footer>
			<AlertDialog.Cancel>Cancel</AlertDialog.Cancel>
			<AlertDialog.Action onclick={onConfirm} class={buttonVariants({ variant: trigger_variant })}
				>Continue</AlertDialog.Action
			>
		</AlertDialog.Footer>
	</AlertDialog.Content>
</AlertDialog.Root>
