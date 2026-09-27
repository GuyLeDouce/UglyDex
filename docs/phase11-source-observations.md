# Phase 11 source count observations

Observed 2026-09-27 UTC using dedicated readers in a one-shot production operator process. These are SELECT count/time-boundary probes, not imported event counts, eligibility judgments or completeness certification. No private row values were exported. Built-in source validation and the additional privilege review are described in [phase11-report.md](phase11-report.md).

| Logical group | Table                           | Rows observed | Earliest timestamp            | Latest timestamp              |
| ------------- | ------------------------------- | ------------: | ----------------------------- | ----------------------------- |
| uglybot       | squig_duels                     |           281 | 2026-04-25 17:32:33.994319+00 | 2026-09-05 01:10:35.4698+00   |
| uglybot       | squig_duel_rounds               |          1896 | 2026-04-25 18:48:07.482643+00 | 2026-09-05 01:18:07.837494+00 |
| uglybot       | squig_duel_player_squigs        |             7 | 2026-04-30 02:51:31.570572+00 | 2026-07-11 11:43:46.564557+00 |
| prizes        | malformed_marketplace_purchases |            45 | 2026-07-06 13:57:12.688696+00 | 2026-09-19 09:04:39.20875+00  |
| prizes        | marketplace_purchases           |           323 | 2026-04-08 20:22:23.235356+00 | 2026-08-04 16:47:25.464965+00 |
| prizes        | bounty_submissions              |            12 | 2026-08-26 14:09:33.451539+00 | 2026-09-16 14:55:05.142127+00 |
| prizes        | bounty_draw_results             |             6 | 2026-08-31 20:00:24.695624+00 | 2026-08-31 20:00:24.695624+00 |
| prizes        | maw_return_sessions             |            81 | 2026-07-10 02:18:42.791139+00 | 2026-08-17 14:42:25.853174+00 |
| prizes        | madlib_sessions                 |            30 | 2026-09-13 02:09:49.052084+00 | 2026-09-23 01:08:44.282064+00 |
| prizes        | bounty_pool_entries             |            43 | 2026-08-26 14:14:52.481309+00 | 2026-09-27 01:15:17.845966+00 |
| prizes        | madlib_publications             |            13 | 2026-09-13 03:30:28.331111+00 | 2026-09-19 17:33:46.285503+00 |
| prizes        | madlib_operations               |            23 | 2026-09-13 03:19:32.588584+00 | 2026-09-17 01:53:10.418743+00 |
| prizes        | maw_squig_pool                  |            66 | 2026-07-10 02:20:36.232929+00 | 2026-08-17 14:43:28.344617+00 |
| claims        | claim_events                    |          1780 | 2026-03-01 15:02:27.953692+00 | 2026-09-27 01:07:41.966215+00 |
| claims        | nft_claims                      |          3664 | Unavailable                   | Unavailable                   |
| points        | holder_point_mappings           |             4 | Unavailable                   | Unavailable                   |
| links         | wallet_links                    |           377 | 2026-02-16 17:49:45.715019+00 | 2026-09-22 05:22:21.837636+00 |

Gauntlet, Survival, Images and ImageSubmit app-side count probes remain unavailable. The missing Gauntlet reward table was confirmed through its own database service. The image and survival readers authenticated locally but public TLS validation failed. Timestamp availability does not establish that every historical record is retained.
