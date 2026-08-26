/**
 * [INPUT]: 依赖 hash-locked QPA transition、固定 rollback 文件表面及同一时刻采集的 journal preimage 摘要。
 * [OUTPUT]: 提供固定 QPA surface 的精确 preimage baseline，并叠加逐路径、逐摘要的预期中间/最终 postimage 集合，供外层 durable journal 在首次写入前授权。
 * [POS]: windows_qpa 与 Program Files language transaction 的所有权投影层；只描述既有状态机可能写出的精确字节身份，不执行文件操作。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{collections::HashSet, path::PathBuf};

use crate::install::InstallLayout;

use super::{
    contract::{manifest_from_activation_plan, manifest_from_restore_plan},
    rollback_file_surface,
    storage::{
        sha256_bytes, MANIFEST_REPLACE_BACKUP_FILE, MANIFEST_TEMP_FILE, REPLACE_BACKUP_FILE,
        ROOT_REPLACEMENT_TEMP, VENDOR_TEMP_FILE,
    },
    QpaManifest, QpaManifestPhase, QpaTransitionPlan, RestoreAction, GENERIC_PLUGIN_RELATIVE_PATH,
    MANIFEST_FILE_NAME, QWINDOWS_FILE_NAME, VENDOR_QWINDOWS_FILE_NAME,
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ExpectedPostimage {
    pub path: PathBuf,
    pub sha256: Option<String>,
}

pub(crate) fn expected_transition_postimages(
    layout: &InstallLayout,
    plan: &QpaTransitionPlan,
    preimage_hashes: &[Option<String>],
) -> Result<Vec<ExpectedPostimage>, String> {
    let surface = rollback_file_surface(layout);
    if preimage_hashes.len() != surface.len() {
        return Err(
            "QPA preimage hash count does not match the fixed rollback surface.".to_string(),
        );
    }
    let recovery = super::recovery_directory(layout);
    let qwindows = layout.root.join(QWINDOWS_FILE_NAME);
    let root_temp = layout.root.join(ROOT_REPLACEMENT_TEMP);
    let generic = layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH);
    let vendor_backup = recovery.join(VENDOR_QWINDOWS_FILE_NAME);
    let manifest = recovery.join(MANIFEST_FILE_NAME);
    let vendor_temp = recovery.join(VENDOR_TEMP_FILE);
    let replace_backup = recovery.join(REPLACE_BACKUP_FILE);
    let manifest_temp = recovery.join(MANIFEST_TEMP_FILE);
    let manifest_backup = recovery.join(MANIFEST_REPLACE_BACKUP_FILE);
    let preimage = |path: &PathBuf| -> Result<Option<String>, String> {
        surface
            .iter()
            .position(|candidate| candidate == path)
            .map(|index| preimage_hashes[index].clone())
            .ok_or_else(|| {
                "QPA expected-postimage path is outside the rollback surface.".to_string()
            })
    };
    let mut states = Vec::new();
    let mut seen = HashSet::new();
    let mut add = |path: &PathBuf, sha256: Option<String>| {
        let key = (path.to_string_lossy().to_lowercase(), sha256.clone());
        if seen.insert(key) {
            states.push(ExpectedPostimage {
                path: path.clone(),
                sha256,
            });
        }
    };

    // The worker verifies every fixed QPA surface path after the transition, including paths
    // that a Noop or CleanupOnly plan intentionally leaves untouched. Keep each exact preimage
    // as an owned postimage baseline, then add only the hashes for states this plan may mutate.
    for (path, hash) in surface.iter().zip(preimage_hashes.iter()) {
        add(path, hash.clone());
    }

    match plan {
        QpaTransitionPlan::Activate(plan) => {
            let prepared = manifest_hash(&manifest_from_activation_plan(
                plan,
                QpaManifestPhase::Prepared,
            ))?;
            let active = manifest_hash(&manifest_from_activation_plan(
                plan,
                QpaManifestPhase::Active,
            ))?;
            add(&qwindows, Some(plan.vendor_qwindows_sha256.clone()));
            add(&qwindows, Some(plan.proxy_qwindows_sha256.clone()));
            add(&root_temp, Some(plan.vendor_qwindows_sha256.clone()));
            add(&root_temp, Some(plan.proxy_qwindows_sha256.clone()));
            add(&root_temp, None);
            add(&vendor_backup, Some(plan.vendor_qwindows_sha256.clone()));
            add(&vendor_temp, Some(plan.vendor_qwindows_sha256.clone()));
            add(&vendor_temp, None);
            add(&manifest, Some(prepared.clone()));
            add(&manifest, Some(active.clone()));
            add(&manifest_temp, Some(prepared.clone()));
            add(&manifest_temp, Some(active));
            add(&manifest_temp, None);
            if let Some(hash) = preimage(&manifest)? {
                add(&manifest_backup, Some(hash));
            }
            add(&manifest_backup, Some(prepared));
            add(&manifest_backup, None);
            if let Some(hash) = preimage(&qwindows)? {
                add(&replace_backup, Some(hash));
            }
            add(&replace_backup, Some(plan.vendor_qwindows_sha256.clone()));
            add(&replace_backup, None);
        }
        QpaTransitionPlan::EnglishRestore(plan) => {
            if plan.action != RestoreAction::CleanupOnly {
                let restoring = manifest_hash(&manifest_from_restore_plan(plan))?;
                add(&qwindows, Some(plan.vendor_qwindows_sha256.clone()));
                add(&root_temp, Some(plan.vendor_qwindows_sha256.clone()));
                add(&root_temp, None);
                add(&manifest, Some(restoring.clone()));
                add(&manifest_temp, Some(restoring.clone()));
                add(&manifest_temp, None);
                if let Some(hash) = preimage(&manifest)? {
                    add(&manifest_backup, Some(hash));
                }
                if let Some(hash) = preimage(&qwindows)? {
                    add(&replace_backup, Some(hash));
                }
            }
            for path in [
                &generic,
                &vendor_backup,
                &manifest,
                &vendor_temp,
                &replace_backup,
                &manifest_temp,
                &manifest_backup,
            ] {
                add(path, None);
            }
        }
        QpaTransitionPlan::Noop(_) => {}
    }
    Ok(states)
}

fn manifest_hash(manifest: &QpaManifest) -> Result<String, String> {
    serde_json::to_vec_pretty(manifest)
        .map(|bytes| sha256_bytes(&bytes))
        .map_err(|error| format!("Could not serialize an expected QPA manifest: {error}"))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;
    use crate::windows_qpa::{
        QpaActivationPlan, QpaNoopPlan, QpaNoopReason, QpaRestorePlan, RestoreReason,
    };

    fn layout() -> InstallLayout {
        InstallLayout::from_root(Path::new(r"C:\Program Files\Cavalry"))
    }

    fn activation() -> QpaTransitionPlan {
        QpaTransitionPlan::Activate(QpaActivationPlan {
            schema_version: 1,
            install_root: r"C:\Program Files\Cavalry".to_string(),
            proxy_source_path: r"C:\staging\proxy.dll".to_string(),
            cavalry_version: "2.7.2".to_string(),
            cavalry_executable_sha256: "a".repeat(64),
            qt_version: "6.6.3".to_string(),
            architecture: "x86_64".to_string(),
            expected_current_qwindows_sha256: Some("b".repeat(64)),
            vendor_qwindows_sha256: "b".repeat(64),
            proxy_qwindows_sha256: "c".repeat(64),
            generic_plugin_sha256: "d".repeat(64),
        })
    }

    fn restore(action: RestoreAction) -> QpaTransitionPlan {
        QpaTransitionPlan::EnglishRestore(QpaRestorePlan {
            schema_version: 1,
            install_root: r"C:\Program Files\Cavalry".to_string(),
            reason: RestoreReason::EnglishSelection,
            action,
            cavalry_version: "2.7.2".to_string(),
            cavalry_executable_sha256: "a".repeat(64),
            qt_version: "6.6.3".to_string(),
            architecture: "x86_64".to_string(),
            expected_current_qwindows_sha256: Some("c".repeat(64)),
            proxy_qwindows_sha256: "c".repeat(64),
            vendor_qwindows_sha256: "b".repeat(64),
            generic_plugin_sha256: "d".repeat(64),
        })
    }

    #[test]
    fn activation_declares_proxy_and_transient_states_before_writes() {
        let layout = layout();
        let states = expected_transition_postimages(
            &layout,
            &activation(),
            &vec![Some("e".repeat(64)); rollback_file_surface(&layout).len()],
        )
        .unwrap();
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(QWINDOWS_FILE_NAME)
                && state.sha256.as_deref() == Some("c".repeat(64).as_str())
        }));
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(ROOT_REPLACEMENT_TEMP) && state.sha256.is_none()
        }));
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(ROOT_REPLACEMENT_TEMP)
                && state.sha256.as_deref() == Some("b".repeat(64).as_str())
        }));
    }

    #[test]
    fn english_restore_declares_owned_deletions_and_vendor_result() {
        let layout = layout();
        let restoring = match restore(RestoreAction::ReplaceProxy) {
            QpaTransitionPlan::EnglishRestore(plan) => {
                manifest_hash(&manifest_from_restore_plan(&plan)).unwrap()
            }
            _ => unreachable!(),
        };
        let states = expected_transition_postimages(
            &layout,
            &restore(RestoreAction::ReplaceProxy),
            &vec![Some("e".repeat(64)); rollback_file_surface(&layout).len()],
        )
        .unwrap();
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(QWINDOWS_FILE_NAME)
                && state.sha256.as_deref() == Some("b".repeat(64).as_str())
        }));
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH) && state.sha256.is_none()
        }));
        assert!(!states.iter().any(|state| {
            state.path
                == super::super::recovery_directory(&layout).join(MANIFEST_REPLACE_BACKUP_FILE)
                && state.sha256.as_deref() == Some(restoring.as_str())
        }));
    }

    #[test]
    fn qpa_noop_declares_fixed_surface_preimages_as_ownership() {
        let layout = layout();
        let expected = "e".repeat(64);
        let preimages = vec![Some(expected.clone()); rollback_file_surface(&layout).len()];
        let plan = QpaTransitionPlan::Noop(QpaNoopPlan {
            schema_version: 1,
            install_root: layout.root.to_string_lossy().to_string(),
            reason: QpaNoopReason::AlreadyStock,
            cavalry_version: "2.7.2".to_string(),
            cavalry_executable_sha256: "a".repeat(64),
            qt_version: "6.6.3".to_string(),
            architecture: "x86_64".to_string(),
            expected_current_qwindows_sha256: Some("b".repeat(64)),
        });
        let states = expected_transition_postimages(&layout, &plan, &preimages).unwrap();
        assert_eq!(states.len(), rollback_file_surface(&layout).len());
        assert!(states
            .iter()
            .all(|state| state.sha256.as_deref() == Some(expected.as_str())));
    }

    #[test]
    fn cleanup_only_declares_unchanged_qpa_surface_before_deleting_owned_files() {
        let layout = layout();
        let preimage = "e".repeat(64);
        let states = expected_transition_postimages(
            &layout,
            &restore(RestoreAction::CleanupOnly),
            &vec![Some(preimage.clone()); rollback_file_surface(&layout).len()],
        )
        .unwrap();

        assert!(states.iter().any(|state| {
            state.path == layout.root.join(QWINDOWS_FILE_NAME)
                && state.sha256.as_deref() == Some(preimage.as_str())
        }));
        assert!(states.iter().any(|state| {
            state.path == layout.root.join(ROOT_REPLACEMENT_TEMP)
                && state.sha256.as_deref() == Some(preimage.as_str())
        }));
    }
}
