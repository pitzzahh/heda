<script>
	import { Button } from '@/components/ui/button';
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
	<div class="w-auto text-center">
		<h1 class="scroll-m-20 text-4xl font-extrabold uppercase tracking-tight lg:text-5xl">
			HIERARCHICAL ELECTRICAL DESIGN ANALYZER
		</h1>
		<p class="uppercase leading-7 [&:not(:first-child)]:mt-2">
			DESIGN ANALYSIS SOFTWARE IN COMPLIANCE WITH THE PHILIPPINE ELECTRICAL CODE 2017 EDITION
		</p>
	</div>
	<div class="flex flex-col gap-4">
		<Button size="2xl" href="/workspace?new_file=true">New File</Button>
		<!-- What if digdi na lang su Highest Unit Form? -->
		<!-- <Dialog.Root>
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
		</Dialog.Root> -->
		<Button variant="ghost" size="xl" class="w-full">Load File</Button>
	</div>
</div>
