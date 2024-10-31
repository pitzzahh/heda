<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
</script>

<div class="flex min-h-screen items-center justify-center bg-background">
	<div class="flex flex-col gap-4">
		<Dialog.Root>
			<Dialog.Trigger class={buttonVariants({ size: '2xl' })}>New File</Dialog.Trigger>
			<Dialog.Content>
				<Dialog.Header>
					<Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
					<Dialog.Description>
						This action cannot be undone. This will permanently delete your account and remove your
						data from our servers.
					</Dialog.Description>
				</Dialog.Header>
				<Button href="/home" class="w-full">Save</Button>
			</Dialog.Content>
		</Dialog.Root>
		<Button variant="ghost" size="xl" class="w-full">Load File</Button>
	</div>
</div>
