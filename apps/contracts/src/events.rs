use soroban_sdk::{symbol_short, Address, Env};

pub fn project_created(
    env: &Env,
    project_id: u64,
    client: &Address,
    freelancer: &Address,
    amount: i128,
) {
    let topics = (symbol_short!("proj_crt"), project_id);
    env.events()
        .publish(topics, (client.clone(), freelancer.clone(), amount));
}

pub fn project_funded(env: &Env, project_id: u64, funder: &Address, amount: i128) {
    let topics = (symbol_short!("proj_fnd"), project_id);
    env.events().publish(topics, (funder.clone(), amount));
}

pub fn project_accepted(env: &Env, project_id: u64, freelancer: &Address) {
    let topics = (symbol_short!("proj_acc"), project_id);
    env.events().publish(topics, freelancer.clone());
}

pub fn milestone_submitted(
    env: &Env,
    project_id: u64,
    milestone_id: u32,
    proof_hash: &soroban_sdk::String,
) {
    let topics = (symbol_short!("ms_sub"), project_id, milestone_id);
    env.events().publish(topics, proof_hash.clone());
}

pub fn milestone_approved(env: &Env, project_id: u64, milestone_id: u32, amount: i128) {
    let topics = (symbol_short!("ms_appr"), project_id, milestone_id);
    env.events().publish(topics, amount);
}

pub fn funds_released(env: &Env, project_id: u64, recipient: &Address, amount: i128) {
    let topics = (symbol_short!("funds_rel"), project_id);
    env.events().publish(topics, (recipient.clone(), amount));
}

pub fn dispute_raised(env: &Env, project_id: u64, raised_by: &Address, milestone_id: u32) {
    let topics = (symbol_short!("disp_rsd"), project_id);
    env.events()
        .publish(topics, (raised_by.clone(), milestone_id));
}

pub fn dispute_resolved(env: &Env, project_id: u64, resolution: u32) {
    let topics = (symbol_short!("disp_rsv"), project_id);
    env.events().publish(topics, resolution);
}

pub fn project_cancelled(env: &Env, project_id: u64, refunded: i128) {
    let topics = (symbol_short!("proj_cnc"), project_id);
    env.events().publish(topics, refunded);
}

pub fn project_completed(env: &Env, project_id: u64) {
    let topics = (symbol_short!("proj_cmp"), project_id);
    env.events().publish(topics, true);
}
