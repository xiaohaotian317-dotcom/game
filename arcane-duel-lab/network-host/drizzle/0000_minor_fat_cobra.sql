CREATE TABLE `duel_relay` (
	`code` text PRIMARY KEY NOT NULL,
	`snapshot` text,
	`input` text,
	`offer` text,
	`answer` text,
	`host_seq` integer DEFAULT 0 NOT NULL,
	`guest_seq` integer DEFAULT 0 NOT NULL,
	`host_seen` integer DEFAULT 0 NOT NULL,
	`guest_seen` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`code`) REFERENCES `duel_rooms`(`code`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `duel_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`data` text NOT NULL,
	`expires_at` integer NOT NULL,
	`host_token` text NOT NULL,
	`guest_token` text
);
