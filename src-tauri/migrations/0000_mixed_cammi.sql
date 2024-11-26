CREATE TABLE `load` (
	`age` integer DEFAULT 18,
	`id` integer PRIMARY KEY NOT NULL,
	`name` text,
	`is_panel` integer DEFAULT 0
);
--> statement-breakpoint
CREATE UNIQUE INDEX `load_id_unique` ON `load` (`id`);