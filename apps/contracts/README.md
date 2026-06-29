# EscrowX Soroban Contract

The on-chain core of [EscrowX](../../README.md) — a milestone-based escrow for
freelance work, written in Rust for [Soroban](https://soroban.stellar.org/)
(Stellar smart contracts). Client funds are locked in this contract and released
to the freelancer only as each milestone is approved, with a configurable
platform fee taken at release. Disputes are settled on-chain by a named
arbitrator.

## Deployment (Stellar Testnet)

| Field | Value |
|---|---|
| **Contract ID** | `CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO` |
| **WASM hash** | `512f6a9ac3084e13caa73d3d4d063938853d527a2487fb6c7e35bf118775ea8e` |
| **Deploy tx** | `67818174c4b5daf1db623b8b9ab194cf0781d32daf40bdb617d9483397c9e338` |
| **Platform wallet** | `GA4UMRAEAUHPZKI23QEJT3LOHMVTDZS2PFTCEXV2MH25O5PM3C7AHKZG` |
| **Admin / deployer** | `GCOJ7BMTKNNLMJGHX6C6IE5HL3BS6KIGJ74KGNMM7XSQFFUKGJCMZQQZ` |
| **USDC (SAC) token** | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` |
| **Network** | Testnet (`Test SDF Network ; September 2015`) |
| **Platform fee** | 1% (`fee_bps = 100`) |

View on explorer:
<https://stellar.expert/explorer/testnet/contract/CDTSW6SSYKQIGF24GKIE5ZRYW3HNX7KNWGVZFYSKAC7XGFH7P6WP42XO>

## Layout

```
apps/contracts/
├── Cargo.toml        # crate + soroban-sdk 22 dependency, release profile
├── Cargo.lock        # pinned dependency graph (committed for reproducible builds)
├── Makefile          # build / test / deploy targets
└── src/
    ├── lib.rs        # contract entrypoints (the EscrowXContract impl)
    ├── types.rs      # Project / Milestone / Dispute storage types + DataKey
    ├── errors.rs     # ContractError enum
    ├── events.rs     # typed event emitters
    └── test.rs       # unit-test suite (run with `make test`)
```

## Contract interface

| Function | Caller | Purpose |
|---|---|---|
| `initialize(admin, platform_wallet, fee_bps)` | admin | one-time setup of platform wallet + fee |
| `create_project(client, freelancer, arbitrator, token, total_amount, milestones)` | client | open a project; milestone amounts must sum to `total_amount` |
| `fund_project(funder, project_id)` | client | transfer the full amount into escrow |
| `accept_project(project_id, freelancer)` | freelancer | freelancer agrees to start |
| `submit_milestone(project_id, milestone_id, freelancer, proof_hash)` | freelancer | submit deliverable proof |
| `approve_milestone(project_id, milestone_id, client)` | client | release milestone funds (minus fee) |
| `raise_dispute(project_id, milestone_id, raised_by, reason)` | client/freelancer | freeze the project for arbitration |
| `resolve_dispute(project_id, arbitrator, resolution, client_bps)` | arbitrator | split/refund/pay out remaining funds |
| `cancel_project(project_id, caller)` | client | cancel before work starts; refunds escrow |
| `get_project` / `get_milestone` / `get_dispute` / `get_project_count` | anyone | read-only views |

### Release math

On `approve_milestone`, the milestone amount is split:
`fee = amount * fee_bps / 10_000` goes to the platform wallet and the remainder
goes to the freelancer. When every milestone is approved the project moves to
`Completed`. The same fee is applied to the freelancer's share in
`resolve_dispute`.

## Build, test, deploy

Prerequisites: Rust (stable) with the `wasm32-unknown-unknown` target, and the
[Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli/stellar-cli).

```bash
rustup target add wasm32-unknown-unknown

# Run the test suite (6 tests covering the full lifecycle, disputes, cancel, guards)
make test

# Compile the optimized release WASM → target/wasm32-unknown-unknown/release/escrowx_contract.wasm
make build

# Deploy to testnet (SOURCE = a funded stellar CLI identity)
make deploy SOURCE=deployer NETWORK=testnet
```

### Initialize after deploy

```bash
stellar contract invoke \
  --id <CONTRACT_ID> --source admin --network testnet -- \
  initialize \
  --admin <ADMIN_G...> \
  --platform_wallet <PLATFORM_G...> \
  --fee_bps 100
```
