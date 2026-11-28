-- Grants from before v0.3.1 lack `write:repo_hook` and `workflow`. Everyone signs in again, which stores a new grant with them.
DELETE FROM `session`;--> statement-breakpoint
UPDATE `account` SET `accessToken` = NULL, `scope` = NULL WHERE `providerId` = 'github';
