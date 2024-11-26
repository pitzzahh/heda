CREATE TABLE `highest_unit` (
	`id` integer PRIMARY KEY NOT NULL,
	`distribution_unit` text DEFAULT 'NULL',
	`wire_length` integer,
	`ambient_temp` integer DEFAULT 0 NOT NULL,
	`phase` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `highest_unit_id_unique` ON `highest_unit` (`id`);--> statement-breakpoint
CREATE TABLE `panel` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `panel_id_unique` ON `panel` (`id`);--> statement-breakpoint
ALTER TABLE `load` ADD `load_description` text DEFAULT 'NULL';--> statement-breakpoint
ALTER TABLE `load` ADD `quantity` integer;--> statement-breakpoint
ALTER TABLE `load` ADD `varies` integer;--> statement-breakpoint
ALTER TABLE `load` ADD `continuous` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `load` ADD `special` text DEFAULT 'NULL';--> statement-breakpoint
ALTER TABLE `load` ADD `panel_id` text;--> statement-breakpoint
ALTER TABLE `load` DROP COLUMN `age`;--> statement-breakpoint
ALTER TABLE `load` DROP COLUMN `name`;