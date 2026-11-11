'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Artwork } from './artwork';
import { CharmDripLink } from './charm-drip-link';

type Step = 'NAME' | 'DRIP' | 'AVATAR' | 'SHARING';
const image = (id: number) => `https://squigs.io/images/images/${id}.png`;

export function ProfileWalkthrough({
  step,
  name,
  avatarId,
  squigs,
}: {
  step: Step;
  name: string;
  avatarId: number | null;
  squigs: { tokenId: number; mawRank: number | null }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dripChoice, setDripChoice] = useState<boolean | null>(null);
  const [chooseAvatar, setChooseAvatar] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function save(body: object) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/onboarding/profile', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Please try again.');
      if (result.complete) setDone(result.next);
      else router.refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not save. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  const number = done
    ? 5
    : ['NAME', 'DRIP', 'AVATAR', 'SHARING'].indexOf(step) + 1;
  return (
    <section className="panel profile-walkthrough" aria-busy={busy}>
      <p className="eyebrow">YOUR PERSONAL UGLYDEX · {number} / 5</p>
      <div className="walkthrough-progress" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={n <= number ? 'active' : ''} />
        ))}
      </div>
      {done ? (
        <>
          <h1>You’re set to go, {name}!</h1>
          {avatarId && (
            <div className="walkthrough-avatar">
              <Artwork src={image(avatarId)} alt={`Your Squig #${avatarId}`} />
            </div>
          )}
          <p>
            Check out your UglyDex and have fun collecting Squigs! Complete
            Sets, unlock Achievements, and more.
          </p>
          <p>
            Your history may take some time to catch up, but the Squigs watched
            everything you’ve done with Ugly Labs… and don’t say you weren’t
            warned. 😆
          </p>
          <Link className="button primary" href={done}>
            Explore
          </Link>
        </>
      ) : (
        <>
          {step === 'NAME' && (
            <>
              <h1>Welcome to your personal UglyDex.</h1>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void save({
                    action: 'name',
                    name: new FormData(event.currentTarget).get('name'),
                  });
                }}
              >
                <label htmlFor="collector-name">What shall we call you?</label>
                <input
                  id="collector-name"
                  name="name"
                  defaultValue={name}
                  autoComplete="nickname"
                  maxLength={60}
                  required
                  placeholder="Your collector name"
                />
                <button className="button primary" disabled={busy}>
                  {busy ? 'Saving…' : 'Continue'}
                </button>
              </form>
            </>
          )}
          {step === 'DRIP' && (
            <>
              <h1>Hi {name}, do you know your DRIP ID?</h1>
              <div className="actions">
                <button
                  className="button primary"
                  aria-pressed={dripChoice === true}
                  onClick={() => setDripChoice(true)}
                >
                  Yes, I have it
                </button>
                <a
                  className="button"
                  href="https://squigs.io/discord"
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setDripChoice(false)}
                >
                  No — find it in Discord ↗
                </a>
              </div>
              {dripChoice === false && (
                <p role="status">
                  In the Squigs Discord, type <code>/mydrip</code> in chat. Then
                  come back here and enter your ID below. Your place is saved;
                  this step stays open until your ID is verified.
                </p>
              )}
              {dripChoice !== null && <CharmDripLink onboarding />}
            </>
          )}
          {step === 'AVATAR' && (
            <>
              <h1>Make it your kind of Ugly.</h1>
              {avatarId ? (
                <>
                  <div className="walkthrough-avatar">
                    <Artwork
                      src={image(avatarId)}
                      alt={`Your highest ranked Squig #${avatarId}`}
                    />
                  </div>
                  <p>
                    Your highest ranked Squig is already your profile picture.
                    Would you like to use a different PFP?
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => setChooseAvatar(true)}
                    >
                      Yes, choose a Squig
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void save({ action: 'avatar', tokenId: null })
                      }
                    >
                      No, keep this one
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p>
                    Your owned Squigs haven’t appeared here yet. You can refresh
                    to check again, or continue and your highest ranked Squig
                    will become your PFP when your collection catches up.
                  </p>
                  <div className="actions">
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => router.refresh()}
                    >
                      Refresh collection
                    </button>
                    <button
                      className="button primary"
                      disabled={busy}
                      onClick={() =>
                        void save({ action: 'avatar', tokenId: null })
                      }
                    >
                      Continue
                    </button>
                  </div>
                </>
              )}
              {chooseAvatar && (
                <>
                  <div
                    className="walkthrough-squigs"
                    aria-label="Choose an owned Squig"
                  >
                    {squigs.map((s) => (
                      <button
                        key={s.tokenId}
                        type="button"
                        className="walkthrough-squig"
                        aria-label={`Squig #${s.tokenId}${s.mawRank ? `, rank ${s.mawRank}` : ''}`}
                        aria-pressed={selected === s.tokenId}
                        disabled={busy}
                        onClick={() => setSelected(s.tokenId)}
                      >
                        <Artwork
                          src={image(s.tokenId)}
                          alt={`Squig #${s.tokenId}`}
                          sizes="100px"
                        />
                        <span>#{s.tokenId}</span>
                      </button>
                    ))}
                  </div>
                  <button
                    className="button primary"
                    disabled={busy || selected === null}
                    onClick={() =>
                      void save({ action: 'avatar', tokenId: selected })
                    }
                  >
                    {busy ? 'Saving…' : 'Continue with selected Squig'}
                  </button>
                </>
              )}
            </>
          )}
          {step === 'SHARING' && (
            <>
              <h1>
                {avatarId
                  ? `That’s one Ugly PFP you have there, ${name}!`
                  : `Make yourself at home, ${name}!`}
              </h1>
              {avatarId && (
                <div className="walkthrough-avatar">
                  <Artwork
                    src={image(avatarId)}
                    alt={`Your Squig #${avatarId}`}
                  />
                </div>
              )}
              <p>Are you going to show it off to the rest of the public Dex?</p>
              <p>
                Both choices make your profile public and enable linked wallet,
                Discord username, and community activity sharing.
              </p>
              <p>
                <strong>Yes:</strong> also show your collector name and full
                current collection.
                <br />
                <strong>No:</strong> hide your collector name, collection, and
                featured Squigs.
              </p>
              <p className="hint">
                You can change these choices later in Settings.
              </p>
              <div className="actions">
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => void save({ action: 'sharing', share: true })}
                >
                  Yes, show it off
                </button>
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void save({ action: 'sharing', share: false })}
                >
                  No, hide my name and collection
                </button>
              </div>
            </>
          )}
          {error && <p role="alert">{error}</p>}
        </>
      )}
    </section>
  );
}
