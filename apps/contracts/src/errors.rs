use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    Unauthorized = 3,
    ProjectNotFound = 4,
    MilestoneNotFound = 5,
    InvalidAmount = 6,
    NoMilestones = 7,
    MilestoneAmountMismatch = 8,
    InvalidStatus = 9,
    AlreadyFunded = 10,
    InsufficientFunds = 11,
    MilestoneNotSubmitted = 12,
    MilestoneAlreadyApproved = 13,
    DisputeExists = 14,
    DisputeNotFound = 15,
    DisputeAlreadyResolved = 16,
    ProjectNotFunded = 17,
    ProjectAlreadyCancelled = 18,
    NotClient = 19,
    NotFreelancer = 20,
    NotArbitrator = 21,
    TransferFailed = 22,
    InvalidSplit = 23,
}
