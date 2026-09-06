-- Historical fixture copied from a8b4e4dfb3086e081e5cca6c343661aaabc6e24b.
-- Independent of the current ORM schema and migration loader; do not regenerate.
CREATE TABLE metadata (singleton INTEGER PRIMARY KEY CHECK(singleton=1), profile TEXT NOT NULL CHECK(profile IN ('personal','work')), environmentId TEXT NOT NULL) STRICT;
CREATE TABLE works (id TEXT PRIMARY KEY, name TEXT NOT NULL, objective TEXT NOT NULL) STRICT;
CREATE TABLE repositories (id TEXT PRIMARY KEY, commonDir TEXT NOT NULL UNIQUE, commonIdentity TEXT NOT NULL) STRICT;
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY, workId TEXT NOT NULL REFERENCES works(id),
  repositoryId TEXT NOT NULL REFERENCES repositories(id), environmentId TEXT NOT NULL,
  root TEXT NOT NULL UNIQUE, gitDir TEXT NOT NULL UNIQUE, commonDir TEXT NOT NULL,
  commonIdentity TEXT NOT NULL, revision TEXT NOT NULL, branch TEXT
) STRICT;
CREATE TABLE context (singleton INTEGER PRIMARY KEY CHECK(singleton=1), generation INTEGER NOT NULL CHECK(generation>=0), workspaceId TEXT REFERENCES workspaces(id)) STRICT;
INSERT INTO context VALUES (1, 0, NULL);
PRAGMA user_version=1;
