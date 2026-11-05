<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from 'bits-ui';
	import { cn } from '#lib/utils';

	let { class: classProp, ...rest }: AlertDialogPrimitive.TitleProps = $props();
</script>

<AlertDialogPrimitive.Title
	{...rest}
	data-slot="alert-dialog-title"
	class={cn('text-foreground text-base font-medium', classProp)}
/>
