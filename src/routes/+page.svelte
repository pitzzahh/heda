<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button';
	import { open } from '@tauri-apps/plugin-dialog';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { heda_logo_for_dark, heda_logo_for_light } from '@/assets/index';
	import { MonitorCog, CircleAlert, Trash2 } from '@/assets/icons';
	import { toast } from 'svelte-sonner';
	import { keyToString, getEnv, generateKey } from '@/helpers/security';
	import { readEncryptedFile } from '@/helpers/file';
	import type { FileExport } from '@/types/main';
	import { loadCurrentProject } from '@/db/mutations';
	import { goto } from '$app/navigation';
	import { Separator } from '@/components/ui/separator';
	import { validateEnv } from '@/utils/validation';
	import { getProjectState } from '@/hooks/project-state.svelte.js';
	import { open as openFile } from '@tauri-apps/plugin-fs';

	const project_state = getProjectState();

	async function handleLoadFile(path?: string | null) {
		try {
			const app_pass_phrase = await getEnv('APP_PASS_PHRASE');
			const file_encryption_salt = await getEnv('FILE_ENCRYPTION_SALT');

			if (!validateEnv(app_pass_phrase, file_encryption_salt)) return;

			if (!path) {
				path = await open({
					multiple: false,
					directory: false,
					filters: [{ name: 'HEDA Files', extensions: ['heda'] }]
				});

				if (!path) {
					return toast.warning('No file selected', {
						description: 'Cannot proceed, no file is selected.'
					});
				}
			}

			const loaded_data = await readEncryptedFile<FileExport>(
				path,
				keyToString(generateKey(app_pass_phrase!, file_encryption_salt!))
			);


			if (!loaded_data) {
				console.warn(`Failed to load file: ${JSON.stringify(loaded_data)}`);
				return toast.warning('Failed to load file', {
					description: 'An error occurred while loading the file.'
				});
			}
			console.log(`Loaded data: ${JSON.stringify(loaded_data)}`);
			await loadCurrentProject(loaded_data);
			const { id, project_name } = loaded_data.project;
			const projectExists = project_state.recent_projects?.some((p) => p.id === id) ?? false;

			const recent_project_data = {
				id,
				project_name,
				project_path: path,
				exists: true
			};

			await project_state.setCurrentFile(
				await openFile(path, {
					read: true,
					write: true
				})
			);
			goto(`/workspace?is_load_file=true&project_id=${loaded_data.project.id}`)
				.then(() => {
					if (!projectExists) {
						project_state.addRecentProject(recent_project_data);
					}
					project_state.setCurrentProject(recent_project_data);
				})
				.finally(() =>
					toast.success('Project loaded successfully', {
						description: 'The file has been loaded successfully.'
					})
				);
		} catch (err) {
			console.error(`Failed to load file: ${JSON.stringify(err)}`);
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
					<Dialog.Root>
						<Dialog.Trigger
							type="button"
							onclick={() => project_state.validateRecentProjects()}
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
							<Button onclick={() => handleLoadFile()}>
								<MonitorCog />
								Load File
							</Button>
							<Separator class="h-1" />
							<ScrollArea class="flex h-72 w-full flex-col pr-2.5">
								{#if project_state.recent_projects}
									{#each project_state.recent_projects as project (project.id)}
										<div class="mb-2 flex w-full items-center justify-between gap-2 px-2 py-1">
											<Button
												variant={project.exists ? 'outline' : 'warning'}
												class="flex flex-1 items-center justify-start px-1.5 py-3"
												disabled={!project.exists}
												size="xl"
												onclick={() => handleLoadFile(project.project_path)}
											>
												<MonitorCog class="mr-2" />
												<div class="flex flex-col items-start">
													{project?.project_name ?? 'unknown'}
													<span class="truncate text-xs text-muted-foreground"
														>Saved Path: {project.project_path ?? 'unknown path'}</span
													>
												</div>
											</Button>
											<Button
												variant="outline"
												class="hover:bg-destructive"
												size="icon"
												onclick={() => {
													project_state.removeRecentProject(project.id);
													toast.info(`${project.project_name ?? 'Project'} removed successfully`);
												}}
											>
												<Trash2 class="h-2 w-2" />
											</Button>
										</div>
									{/each}
								{:else}
									<Alert.Root variant="default" class="flex w-full items-center">
										<CircleAlert class="transorm size-4 -translate-y-[0.1rem]" />
										<Alert.Description>No recent projects found</Alert.Description>
									</Alert.Root>
								{/if}
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
