import 'server-only';
import { createPublicClient, http, parseAbi, type Address } from 'viem';
import { mainnet } from 'viem/chains';
import { readEnv } from '@/server/env';
import {
  normalizeWallet,
  SQUIGS_CONTRACT,
  squigToken,
} from '@/domain/validation';
export const squigsAbi = parseAbi([
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function supportsInterface(bytes4 interfaceId) view returns (bool)',
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);
export function rpc() {
  const url = readEnv().ETH_RPC_URL;
  if (!url) throw new Error('RPC_UNCONFIGURED');
  return createPublicClient({
    chain: mainnet,
    transport: http(url, { timeout: readEnv().RPC_TIMEOUT_MS, retryCount: 0 }),
  });
}
export async function validateContract() {
  const client = rpc();
  if ((await client.getChainId()) !== 1) throw new Error('WRONG_CHAIN');
  const code = await client.getCode({ address: SQUIGS_CONTRACT });
  if (!code || code === '0x') throw new Error('CONTRACT_NOT_DEPLOYED');
  if (
    !(await client.readContract({
      address: SQUIGS_CONTRACT,
      abi: squigsAbi,
      functionName: 'supportsInterface',
      args: ['0x80ac58cd'],
    }))
  )
    throw new Error('NOT_ERC721');
  return client;
}
export async function getCurrentOwner(tokenId: string) {
  const client = await validateContract();
  const block = await client.getBlock({ blockTag: 'finalized' });
  const owner = await client.readContract({
    address: SQUIGS_CONTRACT,
    abi: squigsAbi,
    functionName: 'ownerOf',
    args: [BigInt(squigToken(tokenId))],
    blockNumber: block.number,
  });
  return {
    owner: normalizeWallet(owner),
    blockNumber: block.number,
    blockHash: block.hash,
    observedAt: new Date(Number(block.timestamp) * 1000),
  };
}
export async function getOwnershipBatch(
  client: ReturnType<typeof rpc>,
  tokens: number[],
  blockNumber: bigint,
) {
  if (tokens.length > 100) throw new Error('BATCH_TOO_LARGE');
  return client.multicall({
    allowFailure: true,
    blockNumber,
    contracts: tokens.map((token) => ({
      address: SQUIGS_CONTRACT as Address,
      abi: squigsAbi,
      functionName: 'ownerOf' as const,
      args: [BigInt(squigToken(token))] as const,
    })),
  });
}
