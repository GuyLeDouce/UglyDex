# Legal policy publication

The canonical drafts are [PRIVACY.md](../PRIVACY.md) and [TERMS.md](../TERMS.md).
The public, unauthenticated `/privacy` and `/terms` routes render those files;
the global footer links to both. `docs/privacy.md` remains technical documentation.

## Before merging and publishing

- Replace every placeholder in both files: PUBLICATION DATE, FULL LEGAL NAME,
  PRIVACY EMAIL, LEGAL EMAIL, BUSINESS ADDRESS and OFFICIAL URL. Do not infer a
  legal identity or contact address from a GitHub username.
- Verify actual production data flows, vendors, processing locations, cookies,
  category-specific retention schedules, Discord permissions and integrations.
  Reconcile the prose with deployed behaviour, including public-profile consent.
- Review chance-based games, raffles, prizes and $CHARM mechanics separately.
- Obtain qualified Canadian counsel review and confirm Quebec, EU/UK and other
  jurisdictional applicability. These drafts do not establish compliance.
- Set the actual effective date; remove the draft notice in LegalPolicy and
  noindex metadata on both routes only once publication is approved.
- Deploy and check both routes over the official HTTPS domain in a signed-out
  browser, including footer links, readability and absence of placeholders.
- Enter the resulting official `/privacy` and `/terms` URLs in the appropriate
  Discord Developer Portal fields. Git publication alone neither verifies an
  application nor guarantees approval. Portal configuration is a separate step.

Keep effective dates current when approved policy changes take effect. Never
replace the source files with independently maintained copies in page components.
