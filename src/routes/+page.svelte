<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import HedaLogoForDark from '@/assets/heda_logo_for_dark.png';
	import HedaLogoForWhite from '@/assets/heda_logo_for_light.png';
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
	<div class="flex min-h-screen w-[90%] flex-col justify-between">
		<div
			class="h-[140px] w-full border-b-4 border-l-4 border-r-4 bg-primary dark:border-white"
		></div>

		<div class="flex items-center justify-center gap-8">
			<img
				src={HedaLogoForDark}
				alt="Heda Logo"
				class="hidden w-[280px] dark:block lg:w-[350px] xl:w-[450px]"
			/>
			<img
				src={HedaLogoForWhite}
				alt="Heda Logo"
				class="block w-[280px] dark:hidden lg:w-[350px] xl:w-[450px]"
			/>

			<div class="grid gap-4">
				<div class="w-auto text-center">
					<h1
						class="app-name lg:text:-[170px] scroll-m-20 stroke-primary text-[120px] font-extrabold uppercase tracking-widest xl:text-[200px]"
					>
						HEDA
					</h1>
					<p class="mb-2 text-lg uppercase leading-7 lg:text-xl xl:text-2xl">
						<!-- DESIGN ANALYSIS SOFTWARE IN COMPLIANCE WITH THE PHILIPPINE ELECTRICAL CODE 2017 EDITION -->
						HIERARCHICAL ELECTRICAL DESIGN ANALYZER
					</p>
				</div>

				<div class="flex items-center justify-center gap-8">
					<Button
						size="2xl"
						class="w-[150px] border border-black dark:border-white/90 lg:w-[200px] xl:w-[250px]"
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
					<Dialog.Root>
						<Dialog.Trigger
							type="button"
							class={buttonVariants({
								size: '2xl',
								className:
									'w-[150px] border border-black dark:border-white/90 lg:w-[200px] xl:w-[250px]'
							})}>Load File</Dialog.Trigger
						>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Load recent projects</Dialog.Title>
								<Dialog.Description>
									Choose from the list of recent projects to load.
								</Dialog.Description>
							</Dialog.Header>
						</Dialog.Content>
					</Dialog.Root>
				</div>
			</div>
		</div>

		<div
			class="h-[140px] w-full border-l-4 border-r-4 border-t-4 border-black bg-primary dark:border-white lg:h-[140px]"
		></div>
	</div>
</div>
