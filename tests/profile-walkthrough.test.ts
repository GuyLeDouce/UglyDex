import { describe, expect, it } from 'vitest';
import {
  walkthroughInput,
  walkthroughSharing,
  walkthroughStep,
} from '../src/domain/profile-walkthrough';

describe('profile walkthrough', () => {
  it('asks for a name before DRIP and cannot advance without verification', () => {
    expect(walkthroughStep(0, false)).toBe('NAME');
    expect(walkthroughStep(1, false)).toBe('DRIP');
    expect(walkthroughStep(2, false)).toBe('DRIP');
    expect(walkthroughStep(1, true)).toBe('AVATAR');
    expect(walkthroughStep(2, true)).toBe('SHARING');
  });
  it('rejects empty names and invalid avatar/choice values', () => {
    for (const input of [
      { action: 'name', name: '  ' },
      { action: 'avatar', tokenId: -1 },
      { action: 'sharing', share: 'yes' },
    ])
      expect(walkthroughInput.safeParse(input).success).toBe(false);
  });
  it('both choices check public privacy options; only Yes shares name and collection', () => {
    expect(walkthroughSharing(true)).toEqual({
      isPublic: true,
      showUsername: true,
      showWallets: true,
      showDiscord: true,
      showCommunityActivity: true,
      collectionVisibility: 'FULL',
    });
    expect(walkthroughSharing(false)).toEqual({
      isPublic: true,
      showUsername: false,
      showWallets: true,
      showDiscord: true,
      showCommunityActivity: true,
      collectionVisibility: 'HIDDEN',
    });
  });
});
