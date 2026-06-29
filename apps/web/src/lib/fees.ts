/**
 * Pure escrow money math, mirrored 1:1 with the on-chain contract so the UI can
 * show clients and freelancers exactly what the contract will transfer.
 *
 * Stellar assets use 7 decimal places ("stroops"). The platform fee is taken in
 * basis points (1 bps = 0.01%); the default is 100 bps = 1%.
 */

export const PLATFORM_FEE_BPS = 100;
export const BPS_DENOMINATOR = 10_000;
export const STROOPS_PER_UNIT = 10_000_000; // 7 decimals

/** Platform fee for a milestone/payout, floored like the integer contract math. */
export function platformFee(amount: number, feeBps: number = PLATFORM_FEE_BPS): number {
  return Math.floor((amount * feeBps) / BPS_DENOMINATOR);
}

/** Amount the freelancer actually receives after the platform fee. */
export function freelancerPayout(amount: number, feeBps: number = PLATFORM_FEE_BPS): number {
  return amount - platformFee(amount, feeBps);
}

/** Convert a human USDC amount to integer stroops. */
export function toStroops(units: number): bigint {
  return BigInt(Math.round(units * STROOPS_PER_UNIT));
}

/** Convert integer stroops back to a human USDC amount. */
export function fromStroops(stroops: bigint | number): number {
  return Number(stroops) / STROOPS_PER_UNIT;
}

/** Display helper, e.g. `formatUsdc(5940000000n) === "594.00 USDC"`. */
export function formatUsdc(stroops: bigint | number): string {
  return `${fromStroops(stroops).toFixed(2)} USDC`;
}
