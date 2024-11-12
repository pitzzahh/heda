<script lang="ts">
	import { FileQuestionIcon } from '@/assets/icons/lucide';
	import { Button, buttonVariants } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { OnePhaseMainLoadForm } from '@/components/custom/load';

	let { data } = $props();
</script>

<div class="grid size-full place-content-center place-items-center gap-2">
	<FileQuestionIcon class="size-24 text-muted-foreground" />
	<h2 class="text-xl font-semibold text-muted-foreground">No File Selected</h2>
</div>

<Dialog.Root>
	<Dialog.Trigger class={buttonVariants({ variant: 'outline' })}>Test Main Load Form</Dialog.Trigger
	>
	<Dialog.Content class="w-2/4">
		<Dialog.Header>
			<Dialog.Title>Test Main Load Form</Dialog.Title>
			<Dialog.Description>Enter the load details.</Dialog.Description>
		</Dialog.Header>
		<OnePhaseMainLoadForm one_phase_main_load_form={data.one_phase_main_load_form} />
	</Dialog.Content>
</Dialog.Root>
