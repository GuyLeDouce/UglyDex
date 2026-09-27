# Phase 11 source readers

The owner explicitly authorized dedicated UglyDex reader roles and SELECT grants on 2026-09-27 UTC. Seven physical databases now have a separate `uglydex_reader`, covering eight logical connections. Existing bot accounts, table definitions and source rows were not changed.

These SQL files are the reviewed provisioning templates. **Do not rerun them on provisioned databases:** their existing-role guard deliberately stops. Execution used the same transaction and guards, with a generated password supplied privately before COMMIT and a successful reader-login check afterward. Passwords were written directly to Railway variables, never to these files or reports.

| Template     | Railway source service                    | Logical UglyDex variables                              | Result                                                                 |
| ------------ | ----------------------------------------- | ------------------------------------------------------ | ---------------------------------------------------------------------- |
| holders.sql  | Ugly Bot / Holders Side                   | WALLET_LINKS_DATABASE_URL                              | Created; private-network read/schema/privilege checks pass             |
| team.sql     | Ugly Bot / Team Side                      | UGLYBOT_DATABASE_URL                                   | Created; private-network read/schema/privilege checks pass             |
| prizes.sql   | Ugly Bot / Prizes                         | UGLYBOT_PRIZES_DATABASE_URL                            | Created; private-network read/schema/privilege checks pass             |
| claims.sql   | Ugly Bot / NFTs Claims                    | UGLYBOT_CLAIMS_DATABASE_URL                            | Created; private-network read/schema/privilege checks pass             |
| points.sql   | Ugly Bot / Points Mapping                 | UGLYBOT_POINTS_DATABASE_URL                            | Created; private-network read/schema/privilege checks pass             |
| gauntlet.sql | The Gauntlet / Gauntlet Leaderboard       | GAUNTLET_DATABASE_URL                                  | Rolled back before role creation: gauntlet_online_reward_events absent |
| survival.sql | The Gauntlet / Squig Survival Leaderboard | GAUNTLET_SURVIVAL_DATABASE_URL                         | Created; source-local reader login passes; public TLS blocked          |
| images.sql   | The Gauntlet / Image Link Stroage         | GAUNTLET_IMAGE_DATABASE_URL, IMAGE_SUBMIT_DATABASE_URL | Created; both logical sources share this database; public TLS blocked  |

All created roles default to read-only transactions. They have CONNECT, public-schema USAGE and SELECT on the explicit registry tables. Transaction guards check database/schema/table ownership and CREATE/write privileges, column writes, SELECT access and executable user SECURITY DEFINER routines. They have no superuser, create-database, create-role, replication or bypass-RLS attributes. No source-row mutation was used to test privileges. New tables receive no automatic broad grants.

## What still needs an operator

1. **Fix the public PostgreSQL TLS identity.** All eight staged public reader URLs reached a server but failed normal certificate verification with SELF_SIGNED_CERT_IN_CHAIN. The inspected image database certificate is issued by root-ca and has only DNS:localhost in its SAN; it is valid from 2026-02-14 to 2028-05-14. Trusting its CA alone would not make the public hostname match. A source owner must provision a certificate valid for the approved endpoint and a trustworthy CA chain, or provide an approved private route between environments. Do not set rejectUnauthorized=false or downgrade sslmode. UglyDex public reader URLs now require sslmode=verify-full and fail closed. No PostgreSQL TLS configuration was changed during role provisioning.
2. **Resolve the missing Gauntlet feed contract.** gauntlet_runs exists; gauntlet_online_reward_events does not. Have the source maintainer confirm whether the online reward history exists elsewhere or is unavailable. Do not invent a table merely to pass validation. The main Gauntlet role remains uncreated. Its old production private hostname collides with an unrelated PostgreSQL service in the Ugly Bot project; the observed 28P01 was not proof of a stale password.
3. **Activate and validate production configuration through the controlled repair/rollout process.** The five UglyBot readers were verified in a one-shot operator process on production's private network. Their Railway desired variables are saved, but the existing production web process has not been redeployed. Staging has the new variables active. Survival/images use existing public TCP endpoints because their private names do not route across projects.
4. Run integrations:validate and launch:sources from the actual deployment. Require schema compatibility and verified effective privileges before pilots. Review pilots before any full import. Reader provisioning alone does not complete source history or close a source launch gate.

No new public database endpoint was created. No source password or connection string belongs in Git, an issue, or chat. Source credentials stay in Railway.

## Subsequent review request

The owner subsequently requested fresh repository/live-table inspection and SQL review before any additional grants. See the [new review-only mapping and SQL](../phase11-reader-review/README.md). Those proposals have not been executed. This directory records the earlier authorized provisioning; it is not authorization for additional changes.
