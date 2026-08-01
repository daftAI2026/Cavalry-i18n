/**
 * [INPUT]: 依赖 contract/transport 的 hash-locked plan、storage durable journal、OS Known Folder、固定资源映射与 windows_qpa transition。
 * [OUTPUT]: 提供同一 Switcher EXE 的 Program Files 提权 worker；固定执行 pending→assets/generic→QPA→pre-final proof→final，以 0/42/43/44 表达事务状态，并在任何写入前以 45 单独表达 Cavalry 可见窗口仍未关闭。
 * [POS]: privilege/windows/language_transaction 的唯一提权执行边界；不获取应用锁、不写 Tauri state、不重启 Cavalry，也不接受 plan 提供的任意目标路径。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    collections::HashSet,
    fs,
    io::Read,
    os::windows::fs::OpenOptionsExt,
    path::{Path, PathBuf},
};

use sha2::{Digest, Sha256};

use super::{
    contract::{
        deserialize_bound_plan, payload_source_path, ElevatedLanguagePlan, Language, PayloadKind,
        PayloadRecord, WorkerTransport, MAX_PLAN_BYTES, WORKER_EXIT_CAVALRY_STILL_RUNNING,
        WORKER_EXIT_COMMITTED_CLEAN, WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL,
        WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN, WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
    },
    storage::{CommitCleanup, DurableJournal, ResolvedPayload, ResolvedPreimage, RollbackOutcome},
};
use crate::{
    install::{normalize_path, InstallLayout},
    patch::{CORE_MAP, PLUGIN_DEFINITION_MAP},
    privilege::{
        close_cavalry_before_modification,
        windows::known_folders::{
            ensure_no_reparse_points, lexically_absolute_windows_path, metadata_is_reparse_point,
            path_is_within, paths_equal, trusted_root_for_destination,
            windows_trusted_program_files_roots,
        },
        CloseCavalryError, RealCommandRunner,
    },
    windows_qpa::{QpaDeploymentState, QpaNoopReason, QpaTransitionOutcome, QpaTransitionPlan},
};

#[derive(Debug)]
struct ResolvedTransaction {
    layout: InstallLayout,
    pending: ResolvedPayload,
    assets: Vec<ResolvedPayload>,
    generic: Option<ResolvedPayload>,
    final_marker: ResolvedPayload,
    qpa_proxy_source: Option<PathBuf>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MutationStep {
    Pending,
    Asset(usize),
    Generic,
    Qpa,
    Final,
}

pub(crate) fn run_elevated_worker(transport: &WorkerTransport) -> u32 {
    flatten_worker_result(run_elevated_worker_inner(transport))
}

fn flatten_worker_result(result: Result<u32, u32>) -> u32 {
    match result {
        Ok(exit_code) | Err(exit_code) => exit_code,
    }
}

fn run_elevated_worker_inner(transport: &WorkerTransport) -> Result<u32, u32> {
    let plan = load_verified_plan(transport)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    require_complete_core_surface(&plan.payloads)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    verify_current_executable(&plan).map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    let layout = validate_program_files_layout(&plan)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    let resolved = resolve_transaction(&plan, &transport.plan_path, layout)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    verify_staged_payloads(&plan, &transport.plan_path, &resolved)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    super::source_provenance::verify_staged_source_provenance(
        &plan,
        &transport.plan_path,
        &resolved.layout,
    )
    .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;

    let desired_complete = desired_payloads_match(&resolved);
    if should_skip_mutation(&plan.qpa_transition, desired_complete) {
        crate::windows_qpa::execute_writable_transition(&plan.qpa_transition)
            .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
        return Ok(WORKER_EXIT_COMMITTED_CLEAN);
    }

    let mut runner = RealCommandRunner;
    match close_cavalry_before_modification(&resolved.layout.root, &mut runner) {
        Ok(()) => {}
        Err(CloseCavalryError::StillRunning) => {
            return Err(WORKER_EXIT_CAVALRY_STILL_RUNNING);
        }
        Err(CloseCavalryError::Command(_)) => {
            return Err(WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN);
        }
    }

    let recovery = crate::windows_qpa::recovery_directory(&resolved.layout);
    let recovery_existed = ordinary_directory_state(&recovery)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    let qpa_surface = crate::windows_qpa::rollback_file_surface(&resolved.layout);
    let fixed_preimages = snapshot_fixed_surface(&resolved.layout.root, &qpa_surface)
        .map_err(|_| WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN)?;
    let pre_qpa_payloads = pre_qpa_payloads(&resolved);
    let mut journal = DurableJournal::prepare(
        &resolved.layout.root,
        &plan.nonce,
        &pre_qpa_payloads,
        &fixed_preimages,
    )
    .map_err(storage_error_exit)?;

    let mut qpa_outcome = None;
    let mutation_result = (|| {
        for step in mutation_order(resolved.assets.len(), resolved.generic.is_some()) {
            match step {
                MutationStep::Pending => journal.apply_payload(&resolved.pending)?,
                MutationStep::Asset(index) => journal.apply_payload(&resolved.assets[index])?,
                MutationStep::Generic => journal.apply_payload(
                    resolved
                        .generic
                        .as_ref()
                        .ok_or_else(|| storage_error("generic payload is missing"))?,
                )?,
                MutationStep::Qpa => {
                    let outcome = crate::windows_qpa::execute_writable_transition_with_outcome(
                        &plan.qpa_transition,
                        resolved.qpa_proxy_source.as_deref(),
                    )
                    .map_err(storage_error)?;
                    qpa_outcome = Some(outcome);
                }
                MutationStep::Final => {
                    verify_pre_final_postconditions(
                        &plan,
                        &resolved,
                        qpa_outcome.ok_or_else(|| storage_error("QPA outcome is missing"))?,
                    )?;
                    journal.apply_transition_payload(&resolved.final_marker)?;
                }
            }
        }
        Ok::<(), super::storage::StorageError>(())
    })();

    if mutation_result.is_err() {
        return Err(rollback_exit(
            journal,
            &resolved.layout.root,
            &recovery,
            recovery_existed,
            &resolved.pending.destination,
        ));
    }
    match journal.commit() {
        CommitCleanup::Clean => Ok(WORKER_EXIT_COMMITTED_CLEAN),
        CommitCleanup::Residual(_) => Ok(WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL),
    }
}

fn load_verified_plan(transport: &WorkerTransport) -> Result<ElevatedLanguagePlan, String> {
    let (bytes, hash) = read_locked_bounded(&transport.plan_path, MAX_PLAN_BYTES)?;
    if hash != transport.plan_sha256 {
        return Err("Elevated plan changed after its transport token was built.".to_string());
    }
    deserialize_bound_plan(&bytes, transport).map_err(|error| error.to_string())
}

fn verify_current_executable(plan: &ElevatedLanguagePlan) -> Result<(), String> {
    let current = std::env::current_exe()
        .map_err(|error| format!("Could not resolve elevated worker executable: {error}"))?;
    let actual = hash_locked_file(&current)?;
    if actual != plan.expected_worker_exe_sha256 {
        return Err("Elevated worker executable hash does not match the plan.".to_string());
    }
    Ok(())
}

fn validate_program_files_layout(plan: &ElevatedLanguagePlan) -> Result<InstallLayout, String> {
    let lexical = lexically_absolute_windows_path(Path::new(&plan.install_root))?;
    let trusted_roots = windows_trusted_program_files_roots()?;
    let trusted = trusted_root_for_destination(&lexical, &trusted_roots)
        .ok_or_else(|| "Install root is outside OS-known Program Files roots.".to_string())?;
    ensure_no_reparse_points(trusted, &lexical)?;
    let canonical =
        normalize_path(&fs::canonicalize(&lexical).map_err(|error| {
            format!("Could not canonicalize Program Files install root: {error}")
        })?);
    if !path_is_within(&canonical, trusted) {
        return Err("Canonical install root escaped OS-known Program Files.".to_string());
    }
    ensure_no_reparse_points(trusted, &canonical)?;
    let layout = InstallLayout::from_root(&canonical);
    if !paths_equal(&layout.root, &canonical) {
        return Err("Install layout changed while resolving Program Files.".to_string());
    }
    layout.validate()?;
    Ok(layout)
}

fn resolve_transaction(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    layout: InstallLayout,
) -> Result<ResolvedTransaction, String> {
    let mut pending = None;
    let mut final_marker = None;
    let mut generic = None;
    let mut qpa_proxy_source = None;
    let mut assets = Vec::new();
    for (index, record) in plan.payloads.iter().enumerate() {
        let source = payload_source_path(plan_path, index).map_err(|error| error.to_string())?;
        match record.kind {
            PayloadKind::PendingMarker => {
                pending = Some(resolved_payload(
                    record,
                    source,
                    layout.language_marker.clone(),
                ));
            }
            PayloadKind::FinalMarker => {
                final_marker = Some(resolved_payload(
                    record,
                    source,
                    layout.language_marker.clone(),
                ));
            }
            PayloadKind::GenericPlugin => {
                generic = Some(resolved_payload(
                    record,
                    source,
                    layout.root.join("generic").join("cavalryi18n.dll"),
                ));
            }
            PayloadKind::QpaProxySource => qpa_proxy_source = Some(source),
            PayloadKind::CoreAsset
            | PayloadKind::KnownPluginDefinition
            | PayloadKind::DiscoveredPluginStrings => {
                let destination = resolve_asset_destination(&layout, record)?;
                assets.push(resolved_payload(record, source, destination));
            }
        }
    }
    let pending = pending.ok_or_else(|| "Pending marker payload is missing.".to_string())?;
    let final_marker =
        final_marker.ok_or_else(|| "Final marker payload is missing.".to_string())?;
    if final_marker.expected_destination_sha256.as_deref() != Some(pending.source_sha256.as_str()) {
        return Err("Final marker preimage must be the pending marker hash.".to_string());
    }
    validate_resolved_destinations(&layout, &pending, &assets, generic.as_ref(), &final_marker)?;
    Ok(ResolvedTransaction {
        layout,
        pending,
        assets,
        generic,
        final_marker,
        qpa_proxy_source,
    })
}

fn resolve_asset_destination(
    layout: &InstallLayout,
    record: &PayloadRecord,
) -> Result<PathBuf, String> {
    let id = record.id.as_str();
    let allowed = match record.kind {
        PayloadKind::CoreAsset => CORE_MAP.iter().any(|(_, target)| *target == id),
        PayloadKind::KnownPluginDefinition => PLUGIN_DEFINITION_MAP
            .iter()
            .any(|(_, target)| *target == id),
        PayloadKind::DiscoveredPluginStrings => crate::patch::discover_plugins(&layout.root)
            .iter()
            .any(|plugin| format!("Plugins/{}/strings.json", plugin.folder_name) == id),
        _ => false,
    };
    if !allowed {
        return Err(format!(
            "Payload ID is not a live member of its fixed asset class: {id}"
        ));
    }
    let destination = layout.assets_root.join(id);
    let metadata = fs::symlink_metadata(&destination)
        .map_err(|_| format!("Mapped Cavalry asset does not exist: {id}"))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err(format!(
            "Mapped Cavalry asset is not an ordinary file: {id}"
        ));
    }
    ensure_no_reparse_points(&layout.root, &destination)?;
    if record.expected_destination_sha256.is_none() {
        return Err(format!(
            "Existing Cavalry asset lacks a preimage hash: {id}"
        ));
    }
    Ok(destination)
}

fn require_complete_core_surface(payloads: &[PayloadRecord]) -> Result<(), String> {
    let expected = CORE_MAP
        .iter()
        .map(|(_, target)| *target)
        .collect::<HashSet<_>>();
    let actual_records = payloads
        .iter()
        .filter(|record| record.kind == PayloadKind::CoreAsset)
        .map(|record| record.id.as_str())
        .collect::<Vec<_>>();
    let actual = actual_records.iter().copied().collect::<HashSet<_>>();
    if actual_records.len() != expected.len() || actual != expected {
        return Err(
            "Elevated language plan does not contain the exact CORE_MAP surface.".to_string(),
        );
    }
    Ok(())
}

fn resolved_payload(
    record: &PayloadRecord,
    source: PathBuf,
    destination: PathBuf,
) -> ResolvedPayload {
    ResolvedPayload {
        source,
        destination,
        source_sha256: record.source_sha256.clone(),
        expected_destination_sha256: record.expected_destination_sha256.clone(),
    }
}

fn validate_resolved_destinations(
    layout: &InstallLayout,
    pending: &ResolvedPayload,
    assets: &[ResolvedPayload],
    generic: Option<&ResolvedPayload>,
    final_marker: &ResolvedPayload,
) -> Result<(), String> {
    let mut seen = HashSet::new();
    for payload in std::iter::once(pending).chain(assets).chain(generic) {
        ensure_no_reparse_points(&layout.root, &payload.destination)?;
        let key = payload.destination.to_string_lossy().to_lowercase();
        if !seen.insert(key) {
            return Err("Two payload IDs resolved to the same destination.".to_string());
        }
    }
    if !paths_equal(&pending.destination, &final_marker.destination) {
        return Err("Pending and final markers must resolve to one target.".to_string());
    }
    Ok(())
}

fn verify_staged_payloads(
    plan: &ElevatedLanguagePlan,
    plan_path: &Path,
    resolved: &ResolvedTransaction,
) -> Result<(), String> {
    let plan_directory = plan_path
        .parent()
        .ok_or_else(|| "Plan path has no parent.".to_string())?;
    for (index, record) in plan.payloads.iter().enumerate() {
        let source = payload_source_path(plan_path, index).map_err(|error| error.to_string())?;
        ensure_no_reparse_points(plan_directory, &source)?;
        match record.kind {
            PayloadKind::PendingMarker | PayloadKind::FinalMarker => {
                let (bytes, hash) = read_locked_bounded(&source, 64)?;
                if hash != record.source_sha256 {
                    return Err(format!("Staged payload {index} changed before elevation."));
                }
                if record.kind == PayloadKind::PendingMarker && bytes != b"pending\n" {
                    return Err("Pending marker payload has invalid content.".to_string());
                }
                if record.kind == PayloadKind::FinalMarker
                    && bytes != format!("{}\n", plan.language.as_str()).as_bytes()
                {
                    return Err("Final marker payload does not match plan language.".to_string());
                }
            }
            _ if hash_locked_file(&source)? != record.source_sha256 => {
                return Err(format!("Staged payload {index} changed before elevation."));
            }
            _ => {}
        }
    }
    if plan.language == Language::English
        && (resolved.generic.is_some() || resolved.qpa_proxy_source.is_some())
    {
        return Err("English transaction carried non-English runtime payloads.".to_string());
    }
    Ok(())
}

fn pre_qpa_payloads(resolved: &ResolvedTransaction) -> Vec<ResolvedPayload> {
    std::iter::once(resolved.pending.clone())
        .chain(resolved.assets.iter().cloned())
        .chain(resolved.generic.iter().cloned())
        .collect()
}

fn mutation_order(asset_count: usize, has_generic: bool) -> Vec<MutationStep> {
    let mut steps = vec![MutationStep::Pending];
    steps.extend((0..asset_count).map(MutationStep::Asset));
    if has_generic {
        steps.push(MutationStep::Generic);
    }
    steps.extend([MutationStep::Qpa, MutationStep::Final]);
    steps
}

fn should_skip_mutation(qpa: &QpaTransitionPlan, desired_payloads_match: bool) -> bool {
    desired_payloads_match && matches!(qpa, QpaTransitionPlan::Noop(_))
}

fn desired_payloads_match(resolved: &ResolvedTransaction) -> bool {
    resolved
        .assets
        .iter()
        .chain(resolved.generic.iter())
        .chain(std::iter::once(&resolved.final_marker))
        .all(|payload| {
            snapshot_file_hash(&payload.destination)
                .ok()
                .flatten()
                .as_deref()
                == Some(payload.source_sha256.as_str())
        })
}

fn pre_final_payloads_match(resolved: &ResolvedTransaction) -> bool {
    std::iter::once(&resolved.pending)
        .chain(resolved.assets.iter())
        .chain(resolved.generic.iter())
        .all(|payload| {
            snapshot_file_hash(&payload.destination)
                .ok()
                .flatten()
                .as_deref()
                == Some(payload.source_sha256.as_str())
        })
}

fn snapshot_fixed_surface(
    install_root: &Path,
    paths: &[PathBuf],
) -> Result<Vec<ResolvedPreimage>, String> {
    let mut seen = HashSet::new();
    paths
        .iter()
        .map(|path| {
            if !path_is_within(path, install_root) {
                return Err("QPA rollback file escaped the install root.".to_string());
            }
            ensure_no_reparse_points(install_root, path)?;
            let key = path.to_string_lossy().to_lowercase();
            if !seen.insert(key) {
                return Err("QPA rollback file surface contains a duplicate.".to_string());
            }
            Ok(ResolvedPreimage {
                destination: path.clone(),
                expected_sha256: snapshot_file_hash(path)?,
            })
        })
        .collect()
}

fn verify_pre_final_postconditions(
    plan: &ElevatedLanguagePlan,
    resolved: &ResolvedTransaction,
    outcome: QpaTransitionOutcome,
) -> Result<(), super::storage::StorageError> {
    if !pre_final_payloads_match(resolved) {
        return Err(storage_error(
            "pre-final payload postcondition hash mismatch",
        ));
    }
    let qpa = crate::windows_qpa::inspect(&resolved.layout).map_err(storage_error)?;
    let qpa_matches = match outcome {
        QpaTransitionOutcome::VendorUpdatePreserved => false,
        QpaTransitionOutcome::ExecutedOwned => match &plan.qpa_transition {
            QpaTransitionPlan::Activate(_) => qpa.state == QpaDeploymentState::Active,
            QpaTransitionPlan::EnglishRestore(_) => qpa.state == QpaDeploymentState::Stock,
            QpaTransitionPlan::Noop(noop) => match noop.reason {
                QpaNoopReason::AlreadyStock => qpa.state == QpaDeploymentState::Stock,
                QpaNoopReason::VendorUpdatePreserved => false,
            },
        },
    };
    if !qpa_matches {
        return Err(storage_error("QPA postcondition state mismatch"));
    }
    Ok(())
}

fn rollback_exit(
    journal: DurableJournal,
    install_root: &Path,
    recovery: &Path,
    recovery_existed: bool,
    marker: &Path,
) -> u32 {
    if recovery_existed && ensure_recovery_for_rollback(install_root, recovery).is_err() {
        return WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN;
    }
    match journal.rollback_fail_closed(marker) {
        RollbackOutcome::Restored => {
            if !recovery_existed && remove_new_empty_recovery(install_root, recovery).is_err() {
                WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN
            } else {
                WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN
            }
        }
        RollbackOutcome::Uncertain(_) => WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
    }
}

fn ensure_recovery_for_rollback(install_root: &Path, recovery: &Path) -> Result<(), String> {
    let Some(parent) = recovery.parent() else {
        return Err("QPA recovery directory has no install-root parent.".to_string());
    };
    if !paths_equal(parent, install_root) {
        return Err("QPA recovery directory escaped the install root.".to_string());
    }
    match fs::symlink_metadata(recovery) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(recovery).map_err(|error| {
                format!("Could not recreate QPA recovery directory before rollback: {error}")
            })?;
        }
        Err(error) => {
            return Err(format!(
                "Could not inspect QPA recovery directory before rollback: {error}"
            ))
        }
        Ok(_) => {}
    }
    let metadata = fs::symlink_metadata(recovery)
        .map_err(|error| format!("Could not verify recreated QPA recovery directory: {error}"))?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err("Recreated QPA recovery path is not an ordinary directory.".to_string());
    }
    ensure_no_reparse_points(install_root, recovery)
}

fn ordinary_directory_state(path: &Path) -> Result<bool, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.is_dir() && !metadata_is_reparse_point(&metadata) => Ok(true),
        Ok(_) => Err("QPA recovery path is not an ordinary directory.".to_string()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(error) => Err(format!("Could not inspect QPA recovery directory: {error}")),
    }
}

fn remove_new_empty_recovery(install_root: &Path, path: &Path) -> Result<(), String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(format!(
            "Could not inspect new QPA recovery directory: {error}"
        )),
        Ok(metadata) if metadata.is_dir() && !metadata_is_reparse_point(&metadata) => {
            ensure_no_reparse_points(install_root, path)?;
            let mut entries = fs::read_dir(path)
                .map_err(|error| format!("Could not read new QPA recovery directory: {error}"))?;
            if entries.next().is_some() {
                return Err("New QPA recovery directory is not empty after rollback.".to_string());
            }
            fs::remove_dir(path)
                .map_err(|error| format!("Could not remove new QPA recovery directory: {error}"))
        }
        Ok(_) => Err("New QPA recovery path is not an ordinary directory.".to_string()),
    }
}

fn snapshot_file_hash(path: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not inspect transaction file: {error}")),
        Ok(metadata) if metadata.is_file() && !metadata_is_reparse_point(&metadata) => {
            hash_locked_file(path).map(Some)
        }
        Ok(_) => Err("Transaction file is not an ordinary file.".to_string()),
    }
}

fn read_locked_bounded(path: &Path, limit: usize) -> Result<(Vec<u8>, String), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect locked input: {error}"))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err("Locked input is not an ordinary file.".to_string());
    }
    if metadata.len() > limit as u64 {
        return Err("Locked input exceeds its byte bound.".to_string());
    }
    let mut file = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(path)
        .map_err(|error| format!("Could not exclusively open locked input: {error}"))?;
    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    file.read_to_end(&mut bytes)
        .map_err(|error| format!("Could not read locked input: {error}"))?;
    if bytes.len() > limit {
        return Err("Locked input grew beyond its byte bound.".to_string());
    }
    let hash = lower_sha256(&bytes);
    Ok((bytes, hash))
}

fn hash_locked_file(path: &Path) -> Result<String, String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect hash-locked file: {error}"))?;
    if !metadata.is_file() || metadata_is_reparse_point(&metadata) {
        return Err("Hash-locked input is not an ordinary file.".to_string());
    }
    let mut file = fs::OpenOptions::new()
        .read(true)
        .share_mode(0)
        .open(path)
        .map_err(|error| format!("Could not exclusively open hash-locked file: {error}"))?;
    let mut digest = Sha256::new();
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("Could not hash locked file: {error}"))?;
        if read == 0 {
            break;
        }
        digest.update(&buffer[..read]);
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn lower_sha256(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}

fn storage_error(message: impl Into<String>) -> super::storage::StorageError {
    super::storage::StorageError {
        message: message.into(),
        cleanup_residual: None,
    }
}

fn storage_error_exit(error: super::storage::StorageError) -> u32 {
    if error.cleanup_residual.is_some() {
        WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN
    } else {
        WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn elevated_plan_requires_the_exact_core_map_surface() {
        let mut payloads = CORE_MAP
            .iter()
            .map(|(_, target)| PayloadRecord {
                id: (*target).to_string(),
                kind: PayloadKind::CoreAsset,
                source_sha256: "a".repeat(64),
                expected_destination_sha256: Some("b".repeat(64)),
            })
            .collect::<Vec<_>>();
        assert!(require_complete_core_surface(&payloads).is_ok());

        payloads.push(payloads[0].clone());
        assert!(require_complete_core_surface(&payloads).is_err());
        payloads.pop();
        payloads.pop();
        assert!(require_complete_core_surface(&payloads).is_err());
    }

    #[test]
    fn mutation_order_is_fixed_and_final_is_last() {
        assert_eq!(
            mutation_order(2, true),
            vec![
                MutationStep::Pending,
                MutationStep::Asset(0),
                MutationStep::Asset(1),
                MutationStep::Generic,
                MutationStep::Qpa,
                MutationStep::Final,
            ]
        );
    }

    #[test]
    fn exit_codes_are_stable_and_distinct() {
        assert_eq!(
            [
                WORKER_EXIT_COMMITTED_CLEAN,
                WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL,
                WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN,
                WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
                WORKER_EXIT_CAVALRY_STILL_RUNNING
            ],
            [0, 42, 43, 44, 45]
        );
    }

    #[test]
    fn uncertain_inner_exit_is_never_collapsed_into_exact_rollback() {
        assert_eq!(
            flatten_worker_result(Err(WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN)),
            WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN
        );
        assert_ne!(
            flatten_worker_result(Err(WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN)),
            WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN
        );
    }

    #[test]
    fn english_stock_classification_skips_mutation() {
        assert!(should_skip_mutation(
            &QpaTransitionPlan::Noop(crate::windows_qpa::QpaNoopPlan {
                schema_version: 1,
                install_root: r"C:\Program Files\Cavalry".to_string(),
                reason: QpaNoopReason::AlreadyStock,
                cavalry_version: "2.7.2".to_string(),
                cavalry_executable_sha256: "a".repeat(64),
                qt_version: "6.6.3".to_string(),
                architecture: "x86_64".to_string(),
                expected_current_qwindows_sha256: Some("b".repeat(64)),
            }),
            true
        ));
    }

    #[test]
    fn canonical_verbatim_prefix_is_removed_before_known_folder_checks() {
        let normalized = normalize_path(Path::new(r"\\?\C:\Program Files\Cavalry"));
        assert!(paths_equal(
            &normalized,
            Path::new(r"C:\Program Files\Cavalry")
        ));
    }

    #[test]
    fn rollback_recovery_directory_is_recreated_and_new_empty_directory_is_removed() {
        let root = tempfile::tempdir().unwrap();
        let recovery = root.path().join("cavalry-i18n-qpa");

        ensure_recovery_for_rollback(root.path(), &recovery).unwrap();
        assert!(ordinary_directory_state(&recovery).unwrap());
        remove_new_empty_recovery(root.path(), &recovery).unwrap();
        assert!(!recovery.exists());
    }

    #[test]
    fn prepare_cleanup_residual_maps_to_uncertain_exit() {
        let error = super::super::storage::StorageError {
            message: "prepare failed".to_string(),
            cleanup_residual: Some(super::super::storage::CleanupResidual {
                paths: vec![PathBuf::from(r"C:\Program Files\Cavalry\journal")],
                detail: "journal remains".to_string(),
            }),
        };
        assert_eq!(
            storage_error_exit(error),
            WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN
        );
    }

    #[test]
    fn worker_source_has_no_restart_state_or_application_lock_sink() {
        let source = include_str!("worker.rs");
        for forbidden in [
            ["restart", "_cavalry"].concat(),
            ["write", "_state"].concat(),
            ["acquire_instance", "_lock"].concat(),
            ["try", "_lock"].concat(),
        ] {
            assert!(!source.contains(&forbidden), "{forbidden}");
        }
    }
}
