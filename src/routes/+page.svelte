<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button';
	import { open } from '@tauri-apps/plugin-dialog';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import { Skeleton } from '@/components/ui/skeleton/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { heda_logo_for_dark, heda_logo_for_light } from '@/assets/index';
	import { MonitorCog } from '@/assets/icons';
	import { getAllProjects } from '@/db/queries';
	import { toast } from 'svelte-sonner';
	import { readEncryptedFile, getEnv, keyToString, generateKey } from '@/helpers/security';
	import type { FileExport } from '@/types/main';
	import { getFileName } from '@/helpers/file';
	import { loadCurrentProject } from '@/db/mutations';
	import { goto } from '$app/navigation';
	import { Separator } from '@/components/ui/separator';

	async function handleLoadFile() {
		try {
			const file = await open({
				multiple: false,
				directory: false,
				filters: [{ name: 'HEDA Files', extensions: ['heda'] }]
			});

			if (!file) {
				return toast.warning('No file selected', {
					description: 'Cannot proceed, no file is selected.'
				});
			}
			const app_pass_phrase = await getEnv('APP_PASS_PHRASE');
			const file_name = await getFileName(file);

			if (!app_pass_phrase) {
				return toast.warning('Failed to get the APP_PASS_PHRASE', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			if (!file_name) {
				return toast.warning('Failed to get the loaded file name', {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			}

			const sk = keyToString(generateKey(app_pass_phrase, file_name));
			const loaded_data = await readEncryptedFile<FileExport>(file, sk);

			console.log(loaded_data);
			if (!loaded_data) {
				return toast.error('Failed to load file', {
					description: 'An error occurred while loading the file.'
				});
			}
			await loadCurrentProject(loaded_data);
			toast.success('Project loaded successfully', {
				description: 'The file has been loaded successfully.'
			});
			goto(`/workspace?is_load_file=true&project_id=${loaded_data.project.id}`);
		} catch (err) {
			console.error(err);
			toast.error(`Failed to load file: ${(err as any)?.message ?? 'something went wrong'}`, {
				description: 'An error occurred while loading the file.'
			});
		}
	}
</script>

<div class="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
	<div class="flex min-h-screen w-[90%] flex-col justify-between">
		<div
			class="h-[140px] w-full border-b-4 border-l-4 border-r-4 border-black bg-primary dark:border-white"
		></div>

		<div class="flex items-center justify-center gap-8">
			<img
				src={heda_logo_for_dark}
				alt="Heda Logo"
				class="hidden w-[280px] dark:block lg:w-[350px] xl:w-[450px]"
			/>
			<img
				src={heda_logo_for_light}
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
									Choose from the list of recent projects to load or load a file from your computer.
								</Dialog.Description>
							</Dialog.Header>
							<Button onclick={handleLoadFile}>
								<MonitorCog />
								Load File
							</Button>
							<Separator class="h-1" />
							<ScrollArea class="flex h-72 w-full flex-col gap-1">
								{#await getAllProjects(['id', 'project_name'])}
									{#each { length: 5 }}
										<Skeleton class={buttonVariants({ variant: 'ghost', className: 'w-full' })} />
									{/each}
								{:then _projects}
									{#if _projects}
										{#each _projects as project (project.id)}
											<Button variant="outline" class="w-full">
												<MonitorCog />
												{project?.project_name ?? 'unknown'}
											</Button>
										{/each}
									{/if}
								{:catch err}
									Something went wrong: {err}
								{/await}
							</ScrollArea>
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
