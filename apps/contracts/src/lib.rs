#![no_std]

mod errors;
mod events;
mod types;

use errors::ContractError;
use events::*;
use types::*;

use soroban_sdk::{
    contract, contractimpl, panic_with_error, token, Address, Env, String, Vec,
};

#[contract]
pub struct EscrowXContract;

#[contractimpl]
impl EscrowXContract {
    pub fn initialize(env: Env, admin: Address, platform_wallet: Address, fee_bps: u32) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic_with_error!(&env, ContractError::AlreadyInitialized);
        }
        admin.require_auth();
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::PlatformWallet, &platform_wallet);
        env.storage().instance().set(&DataKey::FeeBps, &fee_bps);
        env.storage().instance().set(&DataKey::ProjectCount, &0u64);
        env.storage().instance().extend_ttl(100_000, 100_000);
    }

    pub fn create_project(
        env: Env,
        client: Address,
        freelancer: Address,
        arbitrator: Address,
        token: Address,
        total_amount: i128,
        milestones: Vec<MilestoneInput>,
    ) -> u64 {
        client.require_auth();

        if total_amount <= 0 {
            panic_with_error!(&env, ContractError::InvalidAmount);
        }
        if milestones.is_empty() {
            panic_with_error!(&env, ContractError::NoMilestones);
        }

        let mut milestone_sum: i128 = 0;
        for m in milestones.iter() {
            if m.amount <= 0 {
                panic_with_error!(&env, ContractError::InvalidAmount);
            }
            milestone_sum += m.amount;
        }
        if milestone_sum != total_amount {
            panic_with_error!(&env, ContractError::MilestoneAmountMismatch);
        }

        let project_count: u64 = env
            .storage()
            .instance()
            .get(&DataKey::ProjectCount)
            .unwrap_or(0);
        let project_id = project_count + 1;
        env.storage()
            .instance()
            .set(&DataKey::ProjectCount, &project_id);

        let project = Project {
            id: project_id,
            client: client.clone(),
            freelancer: freelancer.clone(),
            arbitrator: arbitrator.clone(),
            token: token.clone(),
            total_amount,
            funded_amount: 0,
            released_amount: 0,
            status: ProjectStatus::AwaitingFunding,
            milestone_count: milestones.len() as u32,
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        for (i, milestone_input) in milestones.iter().enumerate() {
            let milestone = Milestone {
                id: i as u32,
                project_id,
                amount: milestone_input.amount,
                status: MilestoneStatus::Pending,
                proof_hash: String::from_str(&env, ""),
                submitted_at: 0,
                approved_at: 0,
            };
            env.storage()
                .persistent()
                .set(&DataKey::Milestone(project_id, i as u32), &milestone);
        }

        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Project(project_id), 100_000, 100_000);

        project_created(&env, project_id, &client, &freelancer, total_amount);

        project_id
    }

    pub fn fund_project(env: Env, funder: Address, project_id: u64) {
        funder.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if project.status != ProjectStatus::AwaitingFunding {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }
        if funder != project.client {
            panic_with_error!(&env, ContractError::NotClient);
        }

        let token_client = token::Client::new(&env, &project.token);
        token_client.transfer(&funder, &env.current_contract_address(), &project.total_amount);

        project.funded_amount = project.total_amount;
        project.status = ProjectStatus::Funded;

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        project_funded(&env, project_id, &funder, project.total_amount);
    }

    pub fn accept_project(env: Env, project_id: u64, freelancer: Address) {
        freelancer.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if project.status != ProjectStatus::Funded {
            panic_with_error!(&env, ContractError::ProjectNotFunded);
        }
        if freelancer != project.freelancer {
            panic_with_error!(&env, ContractError::NotFreelancer);
        }

        project.status = ProjectStatus::InProgress;

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        project_accepted(&env, project_id, &freelancer);
    }

    pub fn submit_milestone(
        env: Env,
        project_id: u64,
        milestone_id: u32,
        freelancer: Address,
        proof_hash: String,
    ) {
        freelancer.require_auth();

        let project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if project.status != ProjectStatus::InProgress {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }
        if freelancer != project.freelancer {
            panic_with_error!(&env, ContractError::NotFreelancer);
        }

        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&DataKey::Milestone(project_id, milestone_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MilestoneNotFound));

        if milestone.status != MilestoneStatus::Pending
            && milestone.status != MilestoneStatus::Rejected
        {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }

        milestone.status = MilestoneStatus::Submitted;
        milestone.proof_hash = proof_hash.clone();
        milestone.submitted_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Milestone(project_id, milestone_id), &milestone);

        milestone_submitted(&env, project_id, milestone_id, &proof_hash);
    }

    pub fn approve_milestone(env: Env, project_id: u64, milestone_id: u32, client: Address) {
        client.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if client != project.client {
            panic_with_error!(&env, ContractError::NotClient);
        }

        let mut milestone: Milestone = env
            .storage()
            .persistent()
            .get(&DataKey::Milestone(project_id, milestone_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MilestoneNotFound));

        if milestone.status != MilestoneStatus::Submitted {
            panic_with_error!(&env, ContractError::MilestoneNotSubmitted);
        }

        milestone.status = MilestoneStatus::Approved;
        milestone.approved_at = env.ledger().timestamp();

        env.storage()
            .persistent()
            .set(&DataKey::Milestone(project_id, milestone_id), &milestone);

        // Release funds for this milestone
        let fee_bps: u32 = env
            .storage()
            .instance()
            .get(&DataKey::FeeBps)
            .unwrap_or(100); // default 1%

        let platform_wallet: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformWallet)
            .unwrap();

        let fee = milestone.amount * fee_bps as i128 / 10_000;
        let freelancer_amount = milestone.amount - fee;

        let token_client = token::Client::new(&env, &project.token);

        if freelancer_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &project.freelancer,
                &freelancer_amount,
            );
        }

        if fee > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &platform_wallet,
                &fee,
            );
        }

        project.released_amount += milestone.amount;

        // Check if all milestones approved → complete project
        let all_approved = (0..project.milestone_count).all(|i| {
            let ms: Milestone = env
                .storage()
                .persistent()
                .get(&DataKey::Milestone(project_id, i))
                .unwrap();
            ms.status == MilestoneStatus::Approved
        });

        if all_approved {
            project.status = ProjectStatus::Completed;
            project_completed(&env, project_id);
        }

        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        milestone_approved(&env, project_id, milestone_id, milestone.amount);
        funds_released(&env, project_id, &project.freelancer, freelancer_amount);
    }

    pub fn raise_dispute(
        env: Env,
        project_id: u64,
        milestone_id: u32,
        raised_by: Address,
        reason: String,
    ) {
        raised_by.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if raised_by != project.client && raised_by != project.freelancer {
            panic_with_error!(&env, ContractError::Unauthorized);
        }

        if project.status == ProjectStatus::Completed
            || project.status == ProjectStatus::Cancelled
            || project.status == ProjectStatus::Disputed
        {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }

        if env
            .storage()
            .persistent()
            .has(&DataKey::Dispute(project_id))
        {
            panic_with_error!(&env, ContractError::DisputeExists);
        }

        let dispute = Dispute {
            project_id,
            milestone_id,
            raised_by: raised_by.clone(),
            reason,
            created_at: env.ledger().timestamp(),
            resolved: false,
            resolution: DisputeResolution::FullClientRefund,
            client_amount: 0,
            freelancer_amount: 0,
        };

        env.storage()
            .persistent()
            .set(&DataKey::Dispute(project_id), &dispute);

        project.status = ProjectStatus::Disputed;
        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        dispute_raised(&env, project_id, &raised_by, milestone_id);
    }

    pub fn resolve_dispute(
        env: Env,
        project_id: u64,
        arbitrator: Address,
        resolution: DisputeResolution,
        client_bps: u32,
    ) {
        arbitrator.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if arbitrator != project.arbitrator {
            panic_with_error!(&env, ContractError::NotArbitrator);
        }

        if project.status != ProjectStatus::Disputed {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }

        let mut dispute: Dispute = env
            .storage()
            .persistent()
            .get(&DataKey::Dispute(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::DisputeNotFound));

        if dispute.resolved {
            panic_with_error!(&env, ContractError::DisputeAlreadyResolved);
        }

        if resolution == DisputeResolution::PartialSplit && client_bps > 10_000 {
            panic_with_error!(&env, ContractError::InvalidSplit);
        }

        let remaining = project.funded_amount - project.released_amount;

        let token_client = token::Client::new(&env, &project.token);
        let platform_wallet: Address = env
            .storage()
            .instance()
            .get(&DataKey::PlatformWallet)
            .unwrap();
        let fee_bps: u32 = env.storage().instance().get(&DataKey::FeeBps).unwrap_or(100);

        let (client_amount, freelancer_amount) = match resolution {
            DisputeResolution::FullClientRefund => (remaining, 0i128),
            DisputeResolution::FullFreelancerPayment => (0i128, remaining),
            DisputeResolution::PartialSplit => {
                let c = remaining * client_bps as i128 / 10_000;
                let f = remaining - c;
                (c, f)
            }
        };

        // Transfer to client
        if client_amount > 0 {
            token_client.transfer(
                &env.current_contract_address(),
                &project.client,
                &client_amount,
            );
        }

        // Transfer to freelancer (minus platform fee)
        if freelancer_amount > 0 {
            let fee = freelancer_amount * fee_bps as i128 / 10_000;
            let net = freelancer_amount - fee;
            if net > 0 {
                token_client.transfer(
                    &env.current_contract_address(),
                    &project.freelancer,
                    &net,
                );
            }
            if fee > 0 {
                token_client.transfer(
                    &env.current_contract_address(),
                    &platform_wallet,
                    &fee,
                );
            }
        }

        dispute.resolved = true;
        dispute.resolution = resolution;
        dispute.client_amount = client_amount;
        dispute.freelancer_amount = freelancer_amount;

        env.storage()
            .persistent()
            .set(&DataKey::Dispute(project_id), &dispute);

        project.status = ProjectStatus::Resolved;
        project.released_amount = project.funded_amount;
        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        dispute_resolved(&env, project_id, resolution as u32);
    }

    pub fn cancel_project(env: Env, project_id: u64, caller: Address) {
        caller.require_auth();

        let mut project: Project = env
            .storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound));

        if caller != project.client {
            panic_with_error!(&env, ContractError::NotClient);
        }

        if project.status != ProjectStatus::AwaitingFunding
            && project.status != ProjectStatus::Funded
        {
            panic_with_error!(&env, ContractError::InvalidStatus);
        }

        let refund = project.funded_amount - project.released_amount;

        if refund > 0 {
            let token_client = token::Client::new(&env, &project.token);
            token_client.transfer(
                &env.current_contract_address(),
                &project.client,
                &refund,
            );
        }

        project.status = ProjectStatus::Cancelled;
        env.storage()
            .persistent()
            .set(&DataKey::Project(project_id), &project);

        project_cancelled(&env, project_id, refund);
    }

    pub fn get_project(env: Env, project_id: u64) -> Project {
        env.storage()
            .persistent()
            .get(&DataKey::Project(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::ProjectNotFound))
    }

    pub fn get_milestone(env: Env, project_id: u64, milestone_id: u32) -> Milestone {
        env.storage()
            .persistent()
            .get(&DataKey::Milestone(project_id, milestone_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::MilestoneNotFound))
    }

    pub fn get_dispute(env: Env, project_id: u64) -> Dispute {
        env.storage()
            .persistent()
            .get(&DataKey::Dispute(project_id))
            .unwrap_or_else(|| panic_with_error!(&env, ContractError::DisputeNotFound))
    }

    pub fn get_project_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::ProjectCount)
            .unwrap_or(0)
    }
}
