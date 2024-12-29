<script>
	import { Button } from '@/components/ui/button';
	import HedaLogoForDark from '$lib/assets/heda_logo_for_dark.png';
	import HedaLogoForWhite from '$lib/assets/heda_logo_for_light.png';
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
	<div class="flex min-h-screen w-[80%] flex-col justify-between">
		<div
			class="h-[150px] w-full border-b-4 border-l-4 border-r-4 bg-primary dark:border-white"
		></div>

		<div class="flex items-center justify-center gap-8">
			<img src={HedaLogoForDark} alt="Heda Logo" class="hidden dark:block" />
			<img src={HedaLogoForWhite} alt="Heda Logo" class="block dark:hidden" />

			<div class="grid gap-4">
				<div class="w-auto text-center">
					<h1
						class="app-name scroll-m-20 stroke-primary text-[200px] font-extrabold uppercase tracking-widest"
					>
						HEDA
					</h1>
					<p class="mb-2 text-2xl uppercase leading-7">
						<!-- DESIGN ANALYSIS SOFTWARE IN COMPLIANCE WITH THE PHILIPPINE ELECTRICAL CODE 2017 EDITION -->
						HIERARCHICAL ELECTRICAL DESIGN ANALYZER
					</p>
				</div>

				<div class="flex items-center justify-center gap-8">
					<Button
						size="2xl"
						class="border border-black dark:border-white/90"
						href="/workspace?new_file=true">New File</Button
					>
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
					<Button size="2xl" class="border border-black dark:border-white/90">Load File</Button>
				</div>
			</div>
		</div>

		<div
			class="h-[150px] w-full border-l-4 border-r-4 border-t-4 border-black bg-primary dark:border-white"
		></div>
	</div>
</div>
