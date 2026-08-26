/**
 * [INPUT]: 依赖 worker 的固定 payload 表面、执行顺序、退出码投影与恢复目录 helper。
 * [OUTPUT]: 覆盖 elevated worker 的纯合同，不启动 UAC、不写状态、不重启 Cavalry。
 * [POS]: language_transaction/worker 的隔离单元测试；把测试职责与安全关键执行代码分离，维持单文件边界。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
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
