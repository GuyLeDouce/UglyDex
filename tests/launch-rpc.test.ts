import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  record: vi.fn(),
  audit: vi.fn(),
  validate: vi.fn(),
  code: vi.fn(),
  block: vi.fn(),
  logs: vi.fn(),
  start: 100n,
}));
vi.mock('../src/server/launch', () => ({ recordGate: mock.record }));
vi.mock('../src/server/deployment', () => ({
  assertDeploymentBinding: vi.fn(),
}));
vi.mock('../src/server/db', () => ({
  db: () => ({ operationalAudit: { create: mock.audit } }),
}));
vi.mock('../src/server/env', () => ({
  readEnv: () => ({
    SQUIGS_START_BLOCK: mock.start,
    TRANSFER_BLOCK_BATCH: 10,
    RPC_RETRIES: 1,
  }),
}));
vi.mock('../src/integrations/blockchain', () => ({
  validateContract: mock.validate,
  squigsAbi: [],
}));
import { verifyLaunchRpc } from '../src/server/launch-rpc';
describe('bounded archive proof with controlled RPC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('ETH_RPC_URL', 'https://rpc.invalid/private-key');
    mock.start = 100n;
    mock.code.mockImplementation(
      async ({ blockNumber }: { blockNumber: bigint }) =>
        blockNumber >= 100n ? '0x1234' : '0x',
    );
    mock.block.mockImplementation(
      async ({ blockNumber }: { blockNumber?: bigint }) => ({
        number: blockNumber ?? 200n,
        hash: '0x' + 'a'.repeat(64),
      }),
    );
    mock.logs.mockResolvedValue([
      {
        blockNumber: 101n,
        logIndex: 0,
        transactionHash: '0x' + 'b'.repeat(64),
        args: { from: '0x' + '0'.repeat(40), tokenId: 3200n },
      },
    ]);
    mock.validate.mockResolvedValue({
      getCode: mock.code,
      getBlock: mock.block,
      getContractEvents: mock.logs,
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it('proves bytecode boundary independently of token 1', async () => {
    await verifyLaunchRpc();
    expect(mock.record).toHaveBeenCalledWith(
      'START_BLOCK',
      'VERIFIED',
      expect.stringContaining('100'),
      expect.objectContaining({
        deploymentBlock: '100',
        firstObservedMint: expect.objectContaining({ token: '3200' }),
      }),
    );
  });
  it('does not leak provider credentials into stored evidence', async () => {
    await verifyLaunchRpc();
    expect(JSON.stringify(mock.audit.mock.calls)).not.toContain('private-key');
  });
  it('caps the historical log range', async () => {
    await verifyLaunchRpc();
    expect(mock.logs.mock.calls[0][0]).toMatchObject({
      fromBlock: 100n,
      toBlock: 109n,
    });
    expect(mock.logs).toHaveBeenCalledTimes(1);
  });
  it('preserves partial state for wrong configured start', async () => {
    mock.start = 99n;
    await verifyLaunchRpc();
    expect(
      mock.record.mock.calls.find((c) => c[0] === 'START_BLOCK')?.[1],
    ).toBe('PARTIAL');
  });
  it('does not invent a missing mint boundary', async () => {
    mock.logs.mockResolvedValue([]);
    await verifyLaunchRpc();
    expect(
      mock.record.mock.calls.find((c) => c[0] === 'START_BLOCK')?.[1],
    ).toBe('PARTIAL');
  });
  it('rate limits/timeouts fail closed', async () => {
    mock.logs.mockRejectedValue(new Error('429 private RPC URL'));
    await expect(verifyLaunchRpc()).rejects.toThrow('RPC_VALIDATION_FAILED');
    expect(mock.record).toHaveBeenCalledWith(
      'ARCHIVE_RPC',
      'FAILED',
      expect.any(String),
      {},
    );
    expect(JSON.stringify(mock.record.mock.calls)).not.toContain('429');
  });
  it('recovers bounded transient provider failures without widening the probe', async () => {
    mock.validate.mockRejectedValueOnce(new Error('429 private RPC URL'));
    mock.code.mockRejectedValueOnce(new Error('429 private RPC URL'));
    mock.logs.mockRejectedValueOnce(new Error('429 private RPC URL'));
    await verifyLaunchRpc();
    expect(mock.validate).toHaveBeenCalledTimes(2);
    expect(mock.logs).toHaveBeenCalledTimes(2);
    for (const [request] of mock.logs.mock.calls)
      expect(request).toMatchObject({ fromBlock: 100n, toBlock: 109n });
    expect(mock.record).toHaveBeenCalledWith(
      'ARCHIVE_RPC',
      'VERIFIED',
      expect.any(String),
      expect.objectContaining({ retryCount: 3 }),
    );
    expect(JSON.stringify(mock.audit.mock.calls)).not.toContain('private RPC');
  });
  it('unconfigured RPC remains pending', async () => {
    vi.stubEnv('ETH_RPC_URL', '');
    await verifyLaunchRpc();
    expect(mock.validate).not.toHaveBeenCalled();
    expect(mock.record.mock.calls[0][1]).toBe('PENDING');
  });
});
