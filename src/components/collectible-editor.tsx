'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
type RecordInput = {
  name?: string;
  description?: string;
  artist?: string | null;
  issuedAt?: string | null;
  imageUri?: string;
  source?: string;
  sourceReference?: string;
  status?: string;
  revision?: number;
  key?: string;
  slug?: string;
  tokenId?: number | string | null;
  sortOrder?: number;
  supply?: number | null;
  standard?: string;
  chainId?: number | null;
  contractAddress?: string | null;
  relatedTokens?: number[];
};
export function CollectibleEditor({
  kind,
  initial = {},
}: {
  kind: 'CUSTOM' | 'EDITION';
  initial?: RecordInput;
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function submit(body: unknown) {
    setBusy(true);
    setMessage('Validating artwork and catalog…');
    try {
      const r = await fetch('/api/admin/collectibles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      setMessage(r.ok ? 'Saved with audit history.' : data.error);
      if (r.ok) router.refresh();
    } catch {
      setMessage('Unable to save catalog.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const string = (key: string) => String(f.get(key) ?? '');
          const number = (key: string) =>
            string(key) ? Number(string(key)) : null;
          void submit({
            version: 1,
            kind,
            records: [
              {
                name: string('name'),
                description: string('description'),
                artist: string('artist') || null,
                issuedAt: string('issuedAt')
                  ? new Date(string('issuedAt')).toISOString()
                  : null,
                imageUri: string('imageUri'),
                source: string('source'),
                sourceReference: string('sourceReference'),
                status: string('status'),
                ...(initial.revision ? { revision: initial.revision } : {}),
                ...(kind === 'CUSTOM'
                  ? {
                      key: string('key'),
                      tokenId: number('tokenId'),
                      sortOrder: number('sortOrder') ?? 0,
                    }
                  : {
                      slug: string('key'),
                      supply: number('supply'),
                      standard: string('standard'),
                      chainId: number('chainId'),
                      contractAddress: string('contractAddress') || null,
                      tokenId: string('editionToken') || null,
                      relatedTokens: string('relatedTokens')
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                        .map(Number),
                    }),
              },
            ],
          });
        }}
      >
        <label>
          Stable catalog key
          <input
            name="key"
            required
            defaultValue={initial.key ?? initial.slug}
            readOnly={!!initial.revision}
            pattern="[a-zA-Z0-9]+(-[a-zA-Z0-9]+)*"
            maxLength={48}
          />
        </label>
        {kind === 'CUSTOM' && (
          <>
            <label>
              Reloaded token ID
              <input
                name="tokenId"
                type="number"
                min={1}
                max={4444}
                required
                defaultValue={initial.tokenId ?? ''}
                readOnly={!!initial.revision}
              />
            </label>
            <label>
              Display order
              <input
                name="sortOrder"
                type="number"
                min={0}
                max={10000}
                defaultValue={initial.sortOrder ?? 0}
              />
            </label>
          </>
        )}
        <label>
          Name
          <input
            name="name"
            required
            maxLength={100}
            defaultValue={initial.name}
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={1000}
            defaultValue={initial.description}
          />
        </label>
        <label>
          Artist
          <input
            name="artist"
            maxLength={100}
            defaultValue={initial.artist ?? ''}
          />
        </label>
        <label>
          Issue date (UTC)
          <input
            name="issuedAt"
            type="date"
            defaultValue={initial.issuedAt?.slice(0, 10) ?? ''}
          />
        </label>
        <label>
          Immutable IPFS artwork URI
          <input
            name="imageUri"
            required
            maxLength={300}
            placeholder="ipfs://…"
            defaultValue={initial.imageUri}
          />
        </label>
        <p>
          PNG or JPEG, at most 3 MB and 4096 × 4096 pixels. Artwork is decoded
          and checked before approval. No uploads to ephemeral storage.
        </p>
        <label>
          Official source
          <input
            name="source"
            required
            maxLength={80}
            defaultValue={initial.source}
          />
        </label>
        <label>
          Approval/source reference
          <input
            name="sourceReference"
            required
            maxLength={250}
            defaultValue={initial.sourceReference}
          />
        </label>
        {kind === 'EDITION' && (
          <>
            <label>
              Supply (if documented)
              <input
                name="supply"
                type="number"
                min={1}
                max={1000000000}
                defaultValue={initial.supply ?? ''}
              />
            </label>
            <label>
              Ownership standard
              <select name="standard" defaultValue={initial.standard ?? 'NONE'}>
                <option value="NONE">
                  Catalog only / ownership unavailable
                </option>
                <option>ERC721</option>
                <option>ERC1155</option>
              </select>
            </label>
            <label>
              Chain ID
              <input
                name="chainId"
                type="number"
                min={1}
                defaultValue={initial.chainId ?? ''}
              />
            </label>
            <label>
              Reviewed contract address
              <input
                name="contractAddress"
                defaultValue={initial.contractAddress ?? ''}
              />
            </label>
            <label>
              Edition token ID
              <input name="editionToken" defaultValue={initial.tokenId ?? ''} />
            </label>
            <label>
              Associated Reloaded tokens (comma separated)
              <input
                name="relatedTokens"
                defaultValue={initial.relatedTokens?.join(',') ?? ''}
              />
            </label>
            <p>
              Only reviewed Ethereum entries support read-only ownership checks.
              Do not infer a contract from the Edition’s name.
            </p>
          </>
        )}
        <label>
          Catalog status
          <select name="status" defaultValue={initial.status ?? 'DRAFT'}>
            <option>DRAFT</option>
            <option>VERIFIED</option>
            <option>RETIRED</option>
          </select>
        </label>
        <label>
          <input type="checkbox" required /> I reviewed the official source,
          token relationship and artwork. VERIFIED publishes this
          representation.
        </label>
        <button className="button" disabled={busy}>
          Validate and save
        </button>
      </form>
      <details>
        <summary>Import a reviewed JSON manifest (up to 10 rows)</summary>
        <form
          className="settings-form catalog-editor"
          onSubmit={(e) => {
            e.preventDefault();
            try {
              void submit(
                JSON.parse(
                  String(new FormData(e.currentTarget).get('manifest')),
                ),
              );
            } catch {
              setMessage('Invalid JSON.');
            }
          }}
        >
          <label>
            Version 1 manifest
            <textarea name="manifest" required maxLength={100000} />
          </label>
          <button className="button" disabled={busy}>
            Validate and import
          </button>
        </form>
      </details>
      <p role="status">{message}</p>
    </>
  );
}
