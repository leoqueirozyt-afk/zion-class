CREATE TABLE `attendances` (
	`id` text PRIMARY KEY NOT NULL,
	`lesson_id` text NOT NULL,
	`student_id` text NOT NULL,
	`status` text NOT NULL,
	`confirmed_at` integer,
	FOREIGN KEY (`lesson_id`) REFERENCES `lessons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`student_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attendances_lesson_student_uq` ON `attendances` (`lesson_id`,`student_id`);--> statement-breakpoint
ALTER TABLE `lessons` ADD `attendance_keyword` text;--> statement-breakpoint
ALTER TABLE `lessons` ADD `is_attendance_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lessons` ADD `attendance_expires_at` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `suspension_reason` text;