CREATE INDEX `workspaces_work_id_idx` ON `workspaces` (`workId`);--> statement-breakpoint
CREATE INDEX `workspaces_repository_id_idx` ON `workspaces` (`repositoryId`);
--> statement-breakpoint
-- Named counterparts tracked by Drizzle Kit; retain legacy inline uniqueness too.
CREATE UNIQUE INDEX `repositories_commonDir_unique` ON `repositories` (`commonDir`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_root_unique` ON `workspaces` (`root`);
--> statement-breakpoint
CREATE UNIQUE INDEX `workspaces_gitDir_unique` ON `workspaces` (`gitDir`);
--> statement-breakpoint
PRAGMA user_version=2;
