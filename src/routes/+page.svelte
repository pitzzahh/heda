<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { NewFileForm } from '@routes/(components)';

	const { data } = $props();
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="flex flex-col gap-4">
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ size: '2xl' })}>New File</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>New file options</Dialog.Title>
					<Dialog.Description>
						Choose the file name and other options for the new file.
					</Dialog.Description>
				</Dialog.Header>
				<NewFileForm
					new_file_form={data.new_file_form}
					recent_files={['peter-file', 'alessandro-file', 'misha-file', 'jason-file']}
				/>
			</Dialog.Content>
		</Dialog.Root>
		<Button variant="ghost" size="xl" class="w-full">Load File</Button>
	</div>
</div>
