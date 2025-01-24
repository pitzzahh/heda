<script lang="ts">
	import { Button, buttonVariants } from '@/components/ui/button';
	import { ScrollArea } from '@/components/ui/scroll-area/index.js';
	import * as Alert from '@/components/ui/alert/index.js';
	import * as Dialog from '@/components/ui/dialog/index.js';
	import { heda_logo_for_dark, heda_logo_for_light } from '@/assets/index';
	import { MonitorCog, CircleAlert, Loader, Trash2 } from '@/assets/icons';
	import { toast } from 'svelte-sonner';
	import { handleLoadFile } from '@/helpers/file';
	import type { RecentProject } from '@/types/main';
	import { goto } from '$app/navigation';
	import { Separator } from '@/components/ui/separator';
	import { getProjectState } from '@/hooks/project-state.svelte.js';
	import { cn } from '@/utils';

	const project_state = getProjectState();

	let component_state = $state({
		status: 'idle' as 'idle' | 'processing'
	});

	function handleLoadFileSuccess(recent_project_data: RecentProject) {
		if (!project_state.recent_projects?.some((p) => p.id === recent_project_data.id)) {
			project_state.addRecentProject(recent_project_data, true);
		}
		project_state.setCurrentProject(recent_project_data);

		project_state.setProjectLoaded(true);
		goto(`/workspace?load_file=true?instance_name=${recent_project_data.project_name}`)
			.then(() =>
				toast.success('Project loaded successfully', {
					description: 'The file has been loaded successfully.'
				})
			)
			.catch((err) => {
				console.error(`Failed to load file: ${(err as any)?.message ?? 'something went wrong'}`);
				toast.error(`Failed to load file: ${(err as any)?.message ?? 'something went wrong'}`, {
					description: 'This is a system error and should not be here, the error has been logged.'
				});
			})
			.finally(() => (component_state.status = 'idle'));
	}
	function isRecentProject(obj: any): obj is RecentProject {
		return obj && typeof obj === 'object' && 'id' in obj && 'project_name' in obj;
	}

	$effect(() => {
		project_state.setProjectLoaded(false);
		project_state.removeCurrentProject();
	});
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
					<Dialog.Root
						onOpenChange={(o) => {
							if (!o) component_state.status = 'idle';
						}}
					>
						<Dialog.Trigger
							type="button"
							onclick={() => project_state.validateRecentProjects()}
							disabled={component_state.status === 'processing'}
							class={buttonVariants({
								size: '2xl',
								className:
									'w-[150px] border border-black dark:border-white/90 lg:w-[200px] xl:w-[250px]'
							})}
						>
							<Loader
								class={cn('mr-1 hidden h-4 w-4 animate-spin', {
									block: component_state.status === 'processing'
								})}
							/>
							Load File</Dialog.Trigger
						>
						<Dialog.Content>
							<Dialog.Header>
								<Dialog.Title>Load recent projects</Dialog.Title>
								<Dialog.Description>
									Choose from the list of recent projects to load or load a file from your computer.
								</Dialog.Description>
							</Dialog.Header>
							<Button
								disabled={component_state.status === 'processing'}
								onclick={async () => {
									const handle_file_result = await handleLoadFile(
										undefined,
										() => (component_state.status = 'processing'),
										() => (component_state.status = 'idle')
									);
									if (isRecentProject(handle_file_result)) {
										handleLoadFileSuccess(handle_file_result);
									}
								}}
							>
								<Loader
									class={cn('mr-1 hidden h-4 w-4 animate-spin', {
										block: component_state.status === 'processing'
									})}
								/>
								<MonitorCog
									class={cn('mr-1 block', {
										hidden: component_state.status === 'processing'
									})}
								/>Load File
							</Button>
							<Separator class="h-1" />
							<ScrollArea class="flex h-72 w-full flex-col pr-2.5">
								{#if project_state.recent_projects}
									{#each project_state.recent_projects as project (project.id)}
										<div class="mb-2 flex w-full items-center justify-between gap-2 px-2 py-1">
											<Button
												variant={project.exists ? 'outline' : 'warning'}
												class={cn('flex flex-1 items-center justify-start px-1.5 py-4', {
													'opacity-50': component_state.status === 'processing'
												})}
												disabled={!project.exists || component_state.status === 'processing'}
												onclick={async () => {
													const handle_file_result = await handleLoadFile(
														project.project_path,
														() => (component_state.status = 'processing'),
														() => (component_state.status = 'idle')
													);
													if (isRecentProject(handle_file_result)) {
														handleLoadFileSuccess(handle_file_result);
													}
												}}
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
												disabled={component_state.status === 'processing'}
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
