/**
 * Optional pre-seed. With the open-signup flow, new teammates create their
 * own account on first login (any name + the team password). This file only
 * exists so admin accounts can be guaranteed to exist before anyone logs in,
 * which is useful for the very first deploy.
 *
 * The runtime auth flow ALSO promotes anyone whose lowercase username is in
 * the ADMIN_USERNAMES env var, so seeding here is not strictly required.
 */
export type SeedUser = {
  username: string;
  displayName: string;
  role: "user" | "admin";
};

export const USERS: SeedUser[] = [
  { username: "jason", displayName: "Jason", role: "admin" },
];
