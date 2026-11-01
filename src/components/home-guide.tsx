import Link from 'next/link';
import { SquigCard } from './collection';
import type { SquigCardData } from '@/server/collections';
import styles from './home-guide.module.css';

const destinations = [
  {
    title: 'Explore Squigs',
    href: '/squigs',
    label: 'Browse the collection',
    description:
      'Meet the 4,444 canonical Squigs. Browse artwork, filter traits, and open any card to see that Squig’s Passport.',
  },
  {
    title: 'Squig Passports',
    href: '/squigs',
    label: 'Find a Squig’s story',
    description:
      'The record behind each character: traits, indexed ownership, transfers, achievements, and supported ecosystem events. Its history stays with it when it changes hands.',
  },
  {
    title: 'Collectors & Field Guides',
    href: '/collectors/directory',
    label: 'Meet the collectors',
    description:
      'Explore public collector profiles and their collections. A personal Field Guide tracks unique discoveries, traits, and sets; Top Collectors ranks overall Field Guide completion.',
  },
  {
    title: 'Collector Thread',
    href: '/thread',
    label: 'See community activity',
    description:
      'Follow recorded transfers, achievements, set completions, and milestones across the community. Open a public profile for that collector’s activity.',
  },
];

export function HomeIntroduction() {
  return (
    <section className={styles.section} aria-labelledby="home-guide-title">
      <p className="eyebrow">YOUR GUIDE TO THE UGLY</p>
      <h2 id="home-guide-title">
        A collection of characters. A history worth keeping.
      </h2>
      <p className={styles.intro}>
        UglyDex is the field guide and community history of Squigs, built by
        Ugly Labs. It brings the artwork, the collectors, and the stories behind
        them into one place. You can explore the public collection without
        connecting a wallet.
      </p>
      <div className={styles.destinations}>
        {destinations.map((item) => (
          <article key={item.title}>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <Link href={item.href}>
              {item.label} <span aria-hidden>→</span>
            </Link>
          </article>
        ))}
      </div>
      <p className={styles.note}>
        There’s more to explore: <Link href="/editions">Editions</Link> has
        separate collectible records, while public galleries and share cards let
        collectors showcase their collections. Your own favorites and Field
        Guide live in My UglyDex once you sign in.
      </p>
    </section>
  );
}

export function HomeCardGuide({ sample }: { sample?: SquigCardData }) {
  return (
    <section className={styles.section} aria-labelledby="card-guide-title">
      <p className="eyebrow">READING THE CARDS</p>
      <h2 id="card-guide-title">Small card. Plenty of character.</h2>
      <p>
        Read a Squig card from top to bottom. Select its artwork or name to open
        the full Passport.
      </p>
      <div
        className={`${styles.anatomy} ${sample ? '' : styles.withoutExample}`}
      >
        {sample && (
          <figure className={styles.example}>
            <SquigCard item={sample} />
            <figcaption>
              A real Squig from the collection. Some cards have more recorded
              history than others.
            </figcaption>
          </figure>
        )}
        <ol className={styles.legend}>
          <li>
            <h3>Artwork & token ID</h3>
            <p>
              The portrait and # number identify the Squig. Opening the card
              takes you to its individual record.
            </p>
          </li>
          <li>
            <h3>Rarity, UP & rank</h3>
            <p>
              The rarity label and card styling describe its catalog
              classification. UP means Ugly Points; Rank is its catalog Maw
              rank. These are collection scores, not prices, $CHARM balances, or
              collector leaderboard positions.
            </p>
          </li>
          <li>
            <h3>Origin & traits</h3>
            <p>
              OG and Legendary tags appear where applicable. The other tags
              preview up to three traits; the Passport contains the full trait
              list.
            </p>
          </li>
          <li>
            <h3>Achievements & history icons</h3>
            <p>
              Badges represent earned Squig achievements. Status icons describe
              recorded history or characteristics. Select a status icon for its
              explanation. Pending evaluation is different from having no
              achievements.
            </p>
          </li>
          <li>
            <h3>Your connection to the Squig</h3>
            <p>
              In personal views, labels distinguish currently owned and already
              discovered Squigs. Set hints show where a discovery could help
              your progress. Hearts let you choose up to six currently owned
              favorites in your collection.
            </p>
          </li>
          <li>
            <h3>Marketplace link</h3>
            <p>
              The footer opens OpenSea separately. A listing price is shown only
              when available; check OpenSea for current price and availability.
              An unknown listing status does not mean a Squig is unlisted.
            </p>
          </li>
        </ol>
      </div>
      <details className={styles.details}>
        <summary>What do the numbers on collector profiles mean?</summary>
        <dl className={styles.definitions}>
          <div>
            <dt>Owned</dt>
            <dd>
              Squigs held now, according to the latest indexed ownership
              snapshot.
            </dd>
          </div>
          <div>
            <dt>Discovered</dt>
            <dd>
              Unique Squigs currently held across active verified wallets, plus
              previously attributed discoveries that remain valid. Each Squig
              counts once, even if it has been held more than once.
            </dd>
          </div>
          <div>
            <dt>Sets & completion</dt>
            <dd>
              Current sets use current holdings. Historical sets use eligible
              discoveries. Field Guide completion brings collection progress
              together; it is not a count of Squigs currently owned.
            </dd>
          </div>
          <div>
            <dt>Collector badges</dt>
            <dd>
              Achievements earned by the collector. They are separate from the
              achievements on an individual Squig’s card.
            </dd>
          </div>
        </dl>
      </details>
      <details className={styles.details}>
        <summary>
          Where do the stories come from, and what stays private?
        </summary>
        <p>
          Ownership and transfers come from indexed Ethereum records. Supported
          game and community activity comes from ecosystem services such as
          UglyBot and The Gauntlet. Updates take time, and historical coverage
          can be incomplete.
        </p>
        <p>
          A public “Unverified Squig Holder” profile is an observation of a
          holding wallet, not proof that someone has signed in. Claiming a
          profile requires wallet verification. Linking a wallet does not
          automatically attribute all of its earlier history to you.
        </p>
        <p>
          Public profiles and sharing respect visibility settings. Private
          Discord and DRIP identifiers and wallet-verification evidence are not
          displayed publicly. Read our{' '}
          <Link href="/privacy">Privacy Policy</Link> for more.
        </p>
      </details>
    </section>
  );
}
