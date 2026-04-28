/**
 * Whitelist of teammates allowed to sign in. The login flow looks up by
 * username (case-insensitive) and then verifies the shared team password.
 *
 * Edit this file and re-run `npm run db:seed` to add or remove people.
 * Removing a person here does NOT delete their data — set role: 'user' or
 * remove via the admin UI when that ships.
 */
export type SeedUser = {
  username: string;
  displayName: string;
  role: "user" | "admin";
};

export const USERS: SeedUser[] = [
  // The first admin. Replace with your team list.
  { username: "jason", displayName: "Jason", role: "admin" },

  // TODO(setup): replace these placeholders with your 10 non-tech teammates.
  // { username: "alex",   displayName: "Alex Doe",   role: "user" },
  // { username: "sam",    displayName: "Sam Lee",    role: "user" },
  // ...
];
