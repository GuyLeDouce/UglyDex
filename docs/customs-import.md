# Initial Squigs Customs import

Owner-authorized catalog import for Ethereum contract `0x64abc24b4e26b89ec4ed03563fafa82dd5f61576`.

OpenSea collection and item pages were inspected on November 7, 2026. Both items report ERC1155-C (ERC1155 ownership ABI). Original metadata was read from the linked IPFS documents:

- Token 1, **Squigs Custom #1**, trait name **Samurai Panduh Squig**: `ipfs://QmQy6zbzy4RdVYuRrqr8uWX4FZkvSwZBmSYN5jYtuKUVNS/1`.
- Token 4, **Squigs Custom #2**, trait name **Mysterious Bun**: `ipfs://bafybeibdeyrgnnh6immlmqrvv7zjnmjihyxesg4p5yjg6kdsr5tq4nn5vq/4`.

Display sequence and on-chain token ID are different. Preserve token ID 4 for Custom #2. Artwork URIs are pinned in `src/server/customs-bootstrap.ts`; the existing importer validates PNG/JPEG bytes, decodes them, computes SHA-256, and records an audit snapshot before publication. Supply one follows the official collection description of custom 1/1s. Dates, artist attribution, associated Reloaded token IDs, and collector ownership are not inferred.

After successful database migrations, the web pre-deploy command imports missing initial records. Existing contract/token records are left intact, including later edits or retirement. A slug collision fails closed. This is a bounded import of these two known items, not automatic discovery of future releases. No blockchain transaction is submitted.

The owner provided the marketplace wording and 1,000,000 $CHARM price. These custom commissions are purchased through the Malformed Marketplace in the Squigs Discord.
