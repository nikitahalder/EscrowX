use soroban_sdk::{contracttype, Address, String};

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ProjectStatus {
    Created = 0,
    AwaitingFunding = 1,
    Funded = 2,
    FreelancerAccepted = 3,
    InProgress = 4,
    Submitted = 5,
    UnderReview = 6,
    Approved = 7,
    Completed = 8,
    Disputed = 9,
    Resolved = 10,
    Cancelled = 11,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum MilestoneStatus {
    Pending = 0,
    InProgress = 1,
    Submitted = 2,
    Approved = 3,
    Rejected = 4,
    Disputed = 5,
}

#[contracttype]
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum DisputeResolution {
    FullClientRefund = 0,
    FullFreelancerPayment = 1,
    PartialSplit = 2,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Project {
    pub id: u64,
    pub client: Address,
    pub freelancer: Address,
    pub arbitrator: Address,
    pub token: Address,
    pub total_amount: i128,
    pub funded_amount: i128,
    pub released_amount: i128,
    pub status: ProjectStatus,
    pub milestone_count: u32,
    pub created_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Milestone {
    pub id: u32,
    pub project_id: u64,
    pub amount: i128,
    pub status: MilestoneStatus,
    pub proof_hash: String,
    pub submitted_at: u64,
    pub approved_at: u64,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct MilestoneInput {
    pub amount: i128,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Dispute {
    pub project_id: u64,
    pub milestone_id: u32,
    pub raised_by: Address,
    pub reason: String,
    pub created_at: u64,
    pub resolved: bool,
    pub resolution: DisputeResolution,
    pub client_amount: i128,
    pub freelancer_amount: i128,
}

#[contracttype]
pub enum DataKey {
    Admin,
    FeeBps,
    PlatformWallet,
    ProjectCount,
    Project(u64),
    Milestone(u64, u32),
    Dispute(u64),
}
