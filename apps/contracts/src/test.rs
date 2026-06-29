#![cfg(test)]

use crate::types::*;
use crate::{EscrowXContract, EscrowXContractClient};

use soroban_sdk::{
    testutils::Address as _,
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, String,
};

const FEE_BPS: u32 = 100; // 1%

struct TestContext<'a> {
    env: Env,
    contract: EscrowXContractClient<'a>,
    token: TokenClient<'a>,
    client: Address,
    freelancer: Address,
    arbitrator: Address,
    platform: Address,
}

fn setup<'a>(mint_to_client: i128) -> TestContext<'a> {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let platform = Address::generate(&env);
    let client = Address::generate(&env);
    let freelancer = Address::generate(&env);
    let arbitrator = Address::generate(&env);

    // Deploy a Stellar Asset Contract to stand in for USDC.
    let token_admin = Address::generate(&env);
    let sac = env.register_stellar_asset_contract_v2(token_admin.clone());
    let token = TokenClient::new(&env, &sac.address());
    let token_admin_client = StellarAssetClient::new(&env, &sac.address());
    if mint_to_client > 0 {
        token_admin_client.mint(&client, &mint_to_client);
    }

    // Deploy and initialize the escrow contract.
    let contract_id = env.register(EscrowXContract, ());
    let contract = EscrowXContractClient::new(&env, &contract_id);
    contract.initialize(&admin, &platform, &FEE_BPS);

    TestContext {
        env,
        contract,
        token,
        client,
        freelancer,
        arbitrator,
        platform,
    }
}

#[test]
fn test_full_milestone_lifecycle_releases_funds_minus_fee() {
    let ctx = setup(1_000);

    let milestones = vec![
        &ctx.env,
        MilestoneInput { amount: 600 },
        MilestoneInput { amount: 400 },
    ];

    let project_id = ctx.contract.create_project(
        &ctx.client,
        &ctx.freelancer,
        &ctx.arbitrator,
        &ctx.token.address,
        &1_000,
        &milestones,
    );
    assert_eq!(project_id, 1);
    assert_eq!(ctx.contract.get_project_count(), 1);

    ctx.contract.fund_project(&ctx.client, &project_id);
    assert_eq!(ctx.token.balance(&ctx.client), 0);
    assert_eq!(ctx.token.balance(&ctx.contract.address), 1_000);

    ctx.contract.accept_project(&project_id, &ctx.freelancer);

    // Milestone 0: 600 → 1% fee (6) to platform, 594 to freelancer.
    ctx.contract.submit_milestone(
        &project_id,
        &0,
        &ctx.freelancer,
        &String::from_str(&ctx.env, "ipfs://proof-0"),
    );
    ctx.contract.approve_milestone(&project_id, &0, &ctx.client);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 594);
    assert_eq!(ctx.token.balance(&ctx.platform), 6);

    // Milestone 1: 400 → 1% fee (4) to platform, 396 to freelancer.
    ctx.contract.submit_milestone(
        &project_id,
        &1,
        &ctx.freelancer,
        &String::from_str(&ctx.env, "ipfs://proof-1"),
    );
    ctx.contract.approve_milestone(&project_id, &1, &ctx.client);
    assert_eq!(ctx.token.balance(&ctx.freelancer), 990);
    assert_eq!(ctx.token.balance(&ctx.platform), 10);

    let project = ctx.contract.get_project(&project_id);
    assert_eq!(project.status, ProjectStatus::Completed);
    assert_eq!(project.released_amount, 1_000);

    // Contract holds nothing once every milestone is paid out.
    assert_eq!(ctx.token.balance(&ctx.contract.address), 0);
}

#[test]
fn test_dispute_resolved_full_freelancer_payment() {
    let ctx = setup(1_000);

    let milestones = vec![&ctx.env, MilestoneInput { amount: 1_000 }];
    let project_id = ctx.contract.create_project(
        &ctx.client,
        &ctx.freelancer,
        &ctx.arbitrator,
        &ctx.token.address,
        &1_000,
        &milestones,
    );

    ctx.contract.fund_project(&ctx.client, &project_id);
    ctx.contract.accept_project(&project_id, &ctx.freelancer);

    ctx.contract.raise_dispute(
        &project_id,
        &0,
        &ctx.client,
        &String::from_str(&ctx.env, "work not delivered"),
    );
    assert_eq!(
        ctx.contract.get_project(&project_id).status,
        ProjectStatus::Disputed
    );

    // Arbitrator awards everything to the freelancer (minus 1% platform fee).
    ctx.contract.resolve_dispute(
        &project_id,
        &ctx.arbitrator,
        &DisputeResolution::FullFreelancerPayment,
        &0,
    );

    assert_eq!(ctx.token.balance(&ctx.freelancer), 990);
    assert_eq!(ctx.token.balance(&ctx.platform), 10);
    assert_eq!(ctx.token.balance(&ctx.client), 0);

    let dispute = ctx.contract.get_dispute(&project_id);
    assert!(dispute.resolved);
    assert_eq!(dispute.freelancer_amount, 1_000);
}

#[test]
fn test_dispute_partial_split() {
    let ctx = setup(1_000);

    let milestones = vec![&ctx.env, MilestoneInput { amount: 1_000 }];
    let project_id = ctx.contract.create_project(
        &ctx.client,
        &ctx.freelancer,
        &ctx.arbitrator,
        &ctx.token.address,
        &1_000,
        &milestones,
    );
    ctx.contract.fund_project(&ctx.client, &project_id);
    ctx.contract.accept_project(&project_id, &ctx.freelancer);
    ctx.contract.raise_dispute(
        &project_id,
        &0,
        &ctx.freelancer,
        &String::from_str(&ctx.env, "partial delivery"),
    );

    // 60% to client, 40% to freelancer (less 1% fee on the freelancer portion).
    ctx.contract.resolve_dispute(
        &project_id,
        &ctx.arbitrator,
        &DisputeResolution::PartialSplit,
        &6_000,
    );

    assert_eq!(ctx.token.balance(&ctx.client), 600);
    // 400 freelancer share → 4 fee, 396 net.
    assert_eq!(ctx.token.balance(&ctx.freelancer), 396);
    assert_eq!(ctx.token.balance(&ctx.platform), 4);
}

#[test]
fn test_cancel_before_acceptance_refunds_client() {
    let ctx = setup(1_000);

    let milestones = vec![&ctx.env, MilestoneInput { amount: 1_000 }];
    let project_id = ctx.contract.create_project(
        &ctx.client,
        &ctx.freelancer,
        &ctx.arbitrator,
        &ctx.token.address,
        &1_000,
        &milestones,
    );
    ctx.contract.fund_project(&ctx.client, &project_id);
    assert_eq!(ctx.token.balance(&ctx.client), 0);

    ctx.contract.cancel_project(&project_id, &ctx.client);

    assert_eq!(ctx.token.balance(&ctx.client), 1_000);
    assert_eq!(ctx.token.balance(&ctx.contract.address), 0);
    assert_eq!(
        ctx.contract.get_project(&project_id).status,
        ProjectStatus::Cancelled
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #8)")] // MilestoneAmountMismatch
fn test_create_rejects_mismatched_milestone_sum() {
    let ctx = setup(1_000);

    let milestones = vec![
        &ctx.env,
        MilestoneInput { amount: 500 },
        MilestoneInput { amount: 400 }, // sums to 900, not 1000
    ];
    ctx.contract.create_project(
        &ctx.client,
        &ctx.freelancer,
        &ctx.arbitrator,
        &ctx.token.address,
        &1_000,
        &milestones,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #1)")] // AlreadyInitialized
fn test_double_initialize_panics() {
    let ctx = setup(0);
    let admin = Address::generate(&ctx.env);
    let platform = Address::generate(&ctx.env);
    ctx.contract.initialize(&admin, &platform, &FEE_BPS);
}
