import { describe, it, expect } from 'vitest';

import {
  platformFee,
  freelancerPayout,
  toStroops,
  fromStroops,
  formatUsdc,
  PLATFORM_FEE_BPS,
} from './fees';

describe('escrow fee math', () => {
  it('uses a 1% default platform fee', () => {
    expect(PLATFORM_FEE_BPS).toBe(100);
  });

  it('matches the contract release split for a 600-unit milestone', () => {
    // Mirrors the on-chain test: fee 6, freelancer 594.
    expect(platformFee(600)).toBe(6);
    expect(freelancerPayout(600)).toBe(594);
  });

  it('matches the contract release split for a 400-unit milestone', () => {
    expect(platformFee(400)).toBe(4);
    expect(freelancerPayout(400)).toBe(396);
  });

  it('floors the fee like integer contract math', () => {
    // 1250 * 100 / 10000 = 12.5 → floored to 12
    expect(platformFee(1250)).toBe(12);
    expect(freelancerPayout(1250)).toBe(1238);
  });

  it('honours a custom fee in basis points', () => {
    expect(platformFee(1000, 250)).toBe(25); // 2.5%
  });
});

describe('stroop conversions', () => {
  it('round-trips USDC ↔ stroops', () => {
    expect(toStroops(594)).toBe(BigInt(5_940_000_000));
    expect(fromStroops(BigInt(5_940_000_000))).toBe(594);
  });

  it('formats stroops as a USDC string', () => {
    expect(formatUsdc(BigInt(5_940_000_000))).toBe('594.00 USDC');
    expect(formatUsdc(0)).toBe('0.00 USDC');
  });
});
