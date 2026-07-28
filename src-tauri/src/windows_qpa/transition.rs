/**
 * [INPUT]: 依赖 windows_qpa 的 hash-locked 激活/恢复计划构建与可写执行原语。
 * [OUTPUT]: 提供显式 English transition、Activate/EnglishRestore/Noop 统一执行、以共享 live-root 谓词约束的厂商更新保留 outcome，及提升 worker 的代理源覆盖入口。
 * [POS]: windows_qpa 的事务适配层；让普通可写路径与受限提升 worker 消费同一状态机，且不扩张 RestoreReason。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::Path;

use crate::install::InstallLayout;

use super::storage::{ensure_path_chain_has_no_reparse_points, require_hash, validate_x64_pe};
use super::{
    contract::{validate_noop_plan, Policy},
    execute_writable_activation_with_source, execute_writable_restore,
    identity::verify_runtime_identity,
    inspect_with_policy, require_windows_layout, sha256_file, snapshot_hash, ActivationOutcome,
    ActivationRequest, PreparedRestore, QpaDeploymentState, QpaNoopPlan, QpaNoopReason,
    QpaTransitionPlan, RestoreOutcome, RestoreRequest, PLAN_SCHEMA_VERSION, QT_CORE_FILE_NAME,
    QWINDOWS_FILE_NAME, SUPPORTED_ARCHITECTURE, SUPPORTED_CAVALRY_VERSION, SUPPORTED_QT_VERSION,
};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum QpaTransitionOutcome {
    ExecutedOwned,
    VendorUpdatePreserved,
}

pub fn activate_writable(request: ActivationRequest<'_>) -> Result<ActivationOutcome, String> {
    let plan = super::build_activation_plan(request)?;
    super::execute_writable_activation(&plan)
}

pub fn restore_writable(request: RestoreRequest<'_>) -> Result<RestoreOutcome, String> {
    match super::build_restore_plan(request)? {
        PreparedRestore::Execute(plan) => super::execute_writable_restore(&plan),
        PreparedRestore::Complete(RestoreOutcome::VendorUpdatePreserved) => {
            Err(vendor_update_requires_supported_install())
        }
        PreparedRestore::Complete(outcome) => Ok(outcome),
    }
}

pub fn build_english_transition(request: RestoreRequest<'_>) -> Result<QpaTransitionPlan, String> {
    build_english_transition_with_policy(request, &Policy::production())
}

pub(super) fn build_english_transition_with_policy(
    request: RestoreRequest<'_>,
    policy: &Policy,
) -> Result<QpaTransitionPlan, String> {
    let layout = request.layout;
    match super::build_restore_plan_with_policy(request, policy)? {
        PreparedRestore::Execute(plan) => Ok(QpaTransitionPlan::EnglishRestore(plan)),
        PreparedRestore::Complete(outcome) => {
            let reason = match outcome {
                RestoreOutcome::AlreadyStock => QpaNoopReason::AlreadyStock,
                RestoreOutcome::VendorUpdatePreserved => {
                    return Err(vendor_update_requires_supported_install())
                }
                RestoreOutcome::Restored => {
                    return Err(
                        "A completed QPA restore cannot report a pending restore.".to_string()
                    )
                }
            };
            Ok(QpaTransitionPlan::Noop(QpaNoopPlan {
                schema_version: PLAN_SCHEMA_VERSION,
                install_root: layout.root.to_string_lossy().to_string(),
                reason,
                cavalry_version: SUPPORTED_CAVALRY_VERSION.to_string(),
                cavalry_executable_sha256: sha256_file(&layout.executable)?,
                qt_version: SUPPORTED_QT_VERSION.to_string(),
                architecture: SUPPORTED_ARCHITECTURE.to_string(),
                expected_current_qwindows_sha256: snapshot_hash(
                    &layout.root.join(QWINDOWS_FILE_NAME),
                    "installed qwindows.dll",
                )?,
            }))
        }
    }
}

pub fn execute_writable_transition(plan: &QpaTransitionPlan) -> Result<(), String> {
    execute_writable_transition_with_proxy_source(plan, None)
}

pub fn execute_writable_transition_with_proxy_source(
    plan: &QpaTransitionPlan,
    proxy_source_override: Option<&Path>,
) -> Result<(), String> {
    execute_writable_transition_with_outcome(plan, proxy_source_override).map(|_| ())
}

pub fn execute_writable_transition_with_outcome(
    plan: &QpaTransitionPlan,
    proxy_source_override: Option<&Path>,
) -> Result<QpaTransitionOutcome, String> {
    match plan {
        QpaTransitionPlan::Activate(plan) => {
            execute_writable_activation_with_source(plan, proxy_source_override)?;
            Ok(QpaTransitionOutcome::ExecutedOwned)
        }
        QpaTransitionPlan::EnglishRestore(plan) => {
            if proxy_source_override.is_some() {
                return Err("English QPA restore does not consume a proxy source.".to_string());
            }
            Ok(restore_transition_outcome(execute_writable_restore(plan)?))
        }
        QpaTransitionPlan::Noop(plan) => {
            if proxy_source_override.is_some() {
                return Err("A QPA no-op does not consume a proxy source.".to_string());
            }
            execute_writable_noop(plan)?;
            Ok(match plan.reason {
                QpaNoopReason::AlreadyStock => QpaTransitionOutcome::ExecutedOwned,
                QpaNoopReason::VendorUpdatePreserved => QpaTransitionOutcome::VendorUpdatePreserved,
            })
        }
    }
}

fn restore_transition_outcome(outcome: RestoreOutcome) -> QpaTransitionOutcome {
    match outcome {
        RestoreOutcome::Restored | RestoreOutcome::AlreadyStock => {
            QpaTransitionOutcome::ExecutedOwned
        }
        RestoreOutcome::VendorUpdatePreserved => QpaTransitionOutcome::VendorUpdatePreserved,
    }
}

fn execute_writable_noop(plan: &QpaNoopPlan) -> Result<(), String> {
    let policy = Policy::production();
    execute_writable_noop_with_policy(plan, &policy, true)
}

#[cfg(test)]
mod outcome_tests {
    use super::{restore_transition_outcome, QpaTransitionOutcome, RestoreOutcome};

    #[test]
    fn vendor_update_restore_outcome_is_never_collapsed_into_owned_execution() {
        assert_eq!(
            restore_transition_outcome(RestoreOutcome::VendorUpdatePreserved),
            QpaTransitionOutcome::VendorUpdatePreserved
        );
        assert_eq!(
            restore_transition_outcome(RestoreOutcome::Restored),
            QpaTransitionOutcome::ExecutedOwned
        );
    }
}

pub(super) fn execute_writable_noop_with_policy(
    plan: &QpaNoopPlan,
    policy: &Policy,
    verify_versions: bool,
) -> Result<(), String> {
    validate_noop_plan(plan, policy)?;
    let layout = InstallLayout::from_root(Path::new(&plan.install_root));
    require_windows_layout(&layout)?;
    ensure_path_chain_has_no_reparse_points(&layout.root)?;
    if verify_versions {
        verify_runtime_identity(&layout, policy)?;
    } else {
        validate_x64_pe(&layout.executable, "Cavalry.exe")?;
        validate_x64_pe(&layout.root.join(QT_CORE_FILE_NAME), "Qt6Core.dll")?;
    }
    require_hash(
        &layout.executable,
        &plan.cavalry_executable_sha256,
        "hash-locked Cavalry executable",
    )?;
    let current = snapshot_hash(
        &layout.root.join(QWINDOWS_FILE_NAME),
        "installed qwindows.dll",
    )?;
    if current != plan.expected_current_qwindows_sha256 {
        return Err(
            "qwindows.dll changed after the QPA no-op plan was built; refusing stale state."
                .to_string(),
        );
    }
    let inspection = inspect_with_policy(&layout, policy)?;
    match plan.reason {
        QpaNoopReason::AlreadyStock if inspection.state == QpaDeploymentState::Stock => Ok(()),
        QpaNoopReason::VendorUpdatePreserved => Err(vendor_update_requires_supported_install()),
        _ => Err(format!(
            "QPA no-op evidence no longer matches the inspected state: {}",
            inspection.detail
        )),
    }
}

fn vendor_update_requires_supported_install() -> String {
    "Cavalry replaced the managed qwindows.dll with an unrecognized vendor file. The newer file was preserved, but Cavalry Language Switcher cannot prove a supported English runtime; reinstall the supported Cavalry release before applying a language."
        .to_string()
}
