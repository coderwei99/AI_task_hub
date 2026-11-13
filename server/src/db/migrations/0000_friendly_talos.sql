CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`todoId` text NOT NULL,
	`type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `activities_todo_created_idx` ON `activities` (`todoId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`todoId` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer NOT NULL,
	FOREIGN KEY (`todoId`) REFERENCES `todos`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `messages_todo_created_idx` ON `messages` (`todoId`,`createdAt`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT '📁' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`techStack` text DEFAULT '' NOT NULL,
	`constraints` text DEFAULT '' NOT NULL,
	`todoSeq` integer DEFAULT 0 NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`projectId` text NOT NULL,
	`number` integer NOT NULL,
	`title` text NOT NULL,
	`originalDescription` text NOT NULL,
	`requirementDoc` text DEFAULT '' NOT NULL,
	`requirementStatus` text DEFAULT 'pending' NOT NULL,
	`executionStatus` text DEFAULT 'todo' NOT NULL,
	`priority` text DEFAULT 'medium' NOT NULL,
	`confirmedAt` integer,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `todos_project_number_unique` ON `todos` (`projectId`,`number`);--> statement-breakpoint
CREATE INDEX `todos_project_idx` ON `todos` (`projectId`);