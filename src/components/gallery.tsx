import Link from 'next/link';
import { Artwork } from './artwork';
import type { galleryView } from '@/server/galleries';
type Gallery = NonNullable<Awaited<ReturnType<typeof galleryView>>>;
export function GalleryArt({ gallery }: { gallery: Gallery }) {
  const sections: { name: string; items: Gallery['items'] }[] = [];
  for (const item of gallery.items) {
    const last = sections.at(-1);
    if (last?.name === item.section) last.items.push(item);
    else sections.push({ name: item.section, items: [item] });
  }
  return (
    <>
      {sections.map((section, index) => (
        <section className="gallery-room" key={index}>
          {section.name && <h2 className="gallery-section">{section.name}</h2>}
          <div
            className={'exhibition exhibition-' + gallery.layout.toLowerCase()}
          >
            {section.items.map((item) => (
              <figure key={item.tokenId}>
                <Link href={'/squig/' + item.tokenId}>
                  <Artwork src={item.image} alt={'Squig #' + item.tokenId} />
                </Link>
                <figcaption>
                  <div className="inline">
                    <Link href={'/squig/' + item.tokenId}>
                      <strong>Squig #{item.tokenId}</strong>
                    </Link>
                    <span className="badge">
                      {item.currentlyOwned
                        ? 'Currently Owned'
                        : 'Previously Owned'}
                    </span>
                  </div>
                  <p>{item.caption}</p>
                  <small>
                    {item.uglyPoints !== null
                      ? item.uglyPoints + ' UglyPoints'
                      : ''}
                    {item.legendary ? ' · Legendary' : item.og ? ' · OG' : ''}
                  </small>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
