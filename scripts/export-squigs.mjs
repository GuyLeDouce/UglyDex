// Reviewed, explicit offline export. Never executes UglyBot's application entry point.
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
const require = createRequire(import.meta.url);
const root = resolve(process.argv[2] || '.inspection/UglyBot');
const ranking = require(resolve(root, 'modules/mawRarity.js'));
const pointsBytes = await readFile(
  resolve(root, 'Squigs_Reloaded_Token_UglyPoints.csv'),
);
const metadataBytes = await readFile(resolve(root, 'metadata.csv'));
const traitBytes = await readFile(
  resolve(root, 'Squigs_Reloaded_Traits_Only_UglyPoints.csv'),
);
const ranks = ranking.parseMawRankingCsvContent(pointsBytes);
const rows = parse(metadataBytes, {
  columns: true,
  bom: true,
  skip_empty_lines: true,
});
const records = rows.map((row) => {
  const r = ranks.tokenMap.get(row.tokenID);
  if (!r) throw new Error('Missing rank');
  return {
    tokenId: Number(row.tokenID),
    name: row.name,
    description: row.description,
    fileName: row.file_name,
    traits: Object.fromEntries(
      Object.entries(row)
        .filter(([k]) => k.startsWith('attributes['))
        .map(([k, v]) => [k.slice(11, -1), v]),
    ),
    uglyPoints: r.totalUglyPoints,
    mawRank: r.mawRank,
    rarityTier: r.rarityKey,
    legendary: r.isLegendary,
    og: row['attributes[Status]'] === 'OG',
  };
});
if (
  records.length !== 4444 ||
  new Set(records.map((r) => r.tokenId)).size !== 4444
)
  throw new Error('Incomplete metadata');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir('data', { recursive: true });
await writeFile(
  'data/squigs.json',
  JSON.stringify({
    sourceRepository: 'GuyLeDouce/UglyBot',
    sourceRevision: 'a693d46c4a8ccaf663d8b308dee0a7578e1268e6',
    rulesVersion: ranking.MAW_REWARD_RULES_VERSION,
    hashes: {
      metadata: sha(metadataBytes),
      points: sha(pointsBytes),
      traitPoints: sha(traitBytes),
    },
    records,
  }),
);
console.log(
  JSON.stringify({
    event: 'squigs.exported',
    records: records.length,
    legendary: records.filter((r) => r.legendary).length,
  }),
);
