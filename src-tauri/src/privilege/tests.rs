/**
 * [INPUT]: 依赖 privilege 子模块、临时文件夹、CopyPair 和 fake CommandRunner。
 * [OUTPUT]: 覆盖 direct 事务回滚、typed cleanup warning、Windows 0/42/43/44 UAC 边界。
 * [POS]: privilege 的 owner unit tests；安全契约在模块拆分后仍贴近实际事务所有者。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::fs;
#[cfg(target_os = "windows")]
use std::path::{Path, PathBuf};

use crate::patch::CopyPair;

#[cfg(target_os = "windows")]
use super::CommandStatus;
use super::{
    copy_transaction::{
        begin_direct_copy_transaction, copy_file_with_source_permissions,
        run_direct_copy_with_writer, run_direct_copy_with_writer_and_cleanup, DirectCopyWriteError,
        PostCommitWarningCode,
    },
    copy_with_privilege, RecordingRunner,
};

#[test]
fn direct_copy_transaction_restores_existing_and_new_targets_after_write_failure() {
    let temp = tempfile::tempdir().unwrap();
    let staged = temp.path().join("staged");
    let destination = temp.path().join("Cavalry");
    fs::create_dir_all(&staged).unwrap();

    let marker = destination.join("cavalry-i18n-lang.txt");
    let asset = destination.join("resources").join("nodeStrings.json");
    let plugin = destination.join("generic").join("cavalryi18n.dll");
    fs::create_dir_all(asset.parent().unwrap()).unwrap();
    fs::write(&marker, "en\n").unwrap();
    fs::write(&asset, "{\"language\":\"English\"}\n").unwrap();

    let staged_marker = staged.join("marker.pending");
    let staged_asset = staged.join("nodeStrings.json");
    let staged_plugin = staged.join("cavalryi18n.dll");
    fs::write(&staged_marker, "pending\n").unwrap();
    fs::write(&staged_asset, "{\"language\":\"Chinese\"}\n").unwrap();
    fs::write(&staged_plugin, "plugin bytes").unwrap();
    let pairs = [
        CopyPair {
            src: staged_marker,
            dst: marker.clone(),
        },
        CopyPair {
            src: staged_asset,
            dst: asset.clone(),
        },
        CopyPair {
            src: staged_plugin,
            dst: plugin.clone(),
        },
    ];

    let mut writes = 0;
    let error = run_direct_copy_with_writer(&pairs, |pair| {
        copy_file_with_source_permissions(pair)?;
        writes += 1;
        if writes == 3 {
            Err(DirectCopyWriteError::other(
                "simulated write failure after pair 3",
            ))
        } else {
            Ok(())
        }
    })
    .unwrap_err()
    .display();

    assert!(
        error.contains("simulated write failure after pair 3"),
        "{error}"
    );
    assert!(error.contains("Original contents were restored"), "{error}");
    assert_eq!(fs::read_to_string(&marker).unwrap(), "en\n");
    assert_eq!(
        fs::read_to_string(&asset).unwrap(),
        "{\"language\":\"English\"}\n"
    );
    assert!(!plugin.exists());
    assert!(!plugin.parent().unwrap().exists());
}

#[test]
fn committed_direct_copy_exposes_typed_backup_cleanup_warning() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source.json");
    let destination = temp.path().join("Cavalry/assets/copy.json");
    fs::write(&source, b"translated").unwrap();
    let pair = CopyPair {
        src: source,
        dst: destination.clone(),
    };
    let mut retained_backup_root = None;

    let completion = run_direct_copy_with_writer_and_cleanup(
        &[pair],
        copy_file_with_source_permissions,
        |path| {
            retained_backup_root = Some(path.to_path_buf());
            Err("simulated cleanup lock".to_string())
        },
    )
    .unwrap();

    assert_eq!(fs::read(&destination).unwrap(), b"translated");
    assert_eq!(completion.warnings.len(), 1);
    assert_eq!(
        completion.warnings[0].stable_code(),
        PostCommitWarningCode::TransactionBackupCleanup.stable_code()
    );
    assert_eq!(
        completion.warnings[0].paths,
        vec![retained_backup_root.clone().unwrap()]
    );
    fs::remove_dir_all(retained_backup_root.unwrap()).unwrap();
}

#[test]
fn pending_direct_copy_restores_exact_preimages_after_a_downstream_failure() {
    let temp = tempfile::tempdir().unwrap();
    let existing_source = temp.path().join("existing.next");
    let created_source = temp.path().join("created.next");
    let existing = temp.path().join("Cavalry/assets/existing.json");
    let created = temp.path().join("Cavalry/runtime/new-marker.txt");
    fs::create_dir_all(existing.parent().unwrap()).unwrap();
    fs::write(&existing_source, b"translated").unwrap();
    fs::write(&created_source, b"new").unwrap();
    fs::write(&existing, b"official").unwrap();

    let transaction = begin_direct_copy_transaction(&[
        CopyPair {
            src: existing_source,
            dst: existing.clone(),
        },
        CopyPair {
            src: created_source,
            dst: created.clone(),
        },
    ])
    .unwrap();
    assert_eq!(fs::read(&existing).unwrap(), b"translated");
    assert_eq!(fs::read(&created).unwrap(), b"new");

    let error = transaction.rollback_with_cause("simulated signing failure");
    assert!(
        error.contains("Exact bundle preimages were restored"),
        "{error}"
    );
    assert_eq!(fs::read(&existing).unwrap(), b"official");
    assert!(!created.exists());
    assert!(!created.parent().unwrap().exists());
}

#[test]
fn public_copy_outcome_keeps_the_legacy_warning_field_for_renderer_compatibility() {
    let temp = tempfile::tempdir().unwrap();
    let source = temp.path().join("source.json");
    let destination = temp.path().join("Cavalry/copy.json");
    fs::write(&source, b"translated").unwrap();
    let mut runner = RecordingRunner::default();
    let outcome = copy_with_privilege(
        &[CopyPair {
            src: source,
            dst: destination,
        }],
        &mut runner,
    )
    .unwrap();
    assert_eq!(outcome.mode, "direct");
    assert_eq!(outcome.warning, None);
}

#[cfg(target_os = "windows")]
#[test]
fn windows_uac_exit_codes_keep_all_four_transaction_states_structured() {
    use super::windows::admin_copy::finish_windows_admin_copy;

    let parents = vec![
        PathBuf::from(r"C:\Program Files\Cavalry\assets\Definitions"),
        PathBuf::from(r"C:\Program Files\Cavalry\generic"),
        PathBuf::from(r"c:\program files\cavalry\assets\definitions"),
    ];
    let status = |exit_code| CommandStatus {
        exit_code: Some(exit_code),
        stdout: String::new(),
        stderr: String::new(),
    };

    let clean = finish_windows_admin_copy(Ok(status(0)), &parents, Vec::new()).unwrap();
    assert_eq!(clean.mode, "elevated");
    assert!(clean.warnings.is_empty());

    let committed_with_residuals =
        finish_windows_admin_copy(Ok(status(42)), &parents, Vec::new()).unwrap();
    assert_eq!(committed_with_residuals.warnings.len(), 1);
    assert_eq!(
        committed_with_residuals.warnings[0].stable_code(),
        PostCommitWarningCode::ElevatedTransactionCleanup.stable_code()
    );

    let restored = finish_windows_admin_copy(Ok(status(43)), &parents, Vec::new())
        .unwrap_err()
        .display();
    assert!(
        restored.contains("original contents were restored"),
        "{restored}"
    );

    let residual = finish_windows_admin_copy(Ok(status(44)), &parents, Vec::new())
        .unwrap_err()
        .display();
    assert!(
        residual.contains("rollback or cleanup residuals"),
        "{residual}"
    );
}

#[cfg(target_os = "windows")]
#[test]
fn windows_uac_script_remains_hash_locked_and_never_writes_a_temp_report() {
    let script = super::windows::manifest::windows_admin_copy_script(
        Path::new(r"C:\Temp\copy-manifest.json"),
        &"a".repeat(64),
    );
    let legacy_warning_variable = ["warning", "Path"].concat();
    let legacy_write_api = ["Write", "AllText"].concat();
    assert!(script.contains("ReadAllBytes($manifestPath)"));
    assert!(script.contains("sourceSha256"));
    assert!(script.contains("[System.IO.FileShare]::None"));
    assert!(script.contains("exit 0"));
    assert!(script.contains("exit 42"));
    assert!(script.contains("exit 43"));
    assert!(script.contains("exit 44"));
    assert!(!script.contains(&legacy_warning_variable));
    assert!(!script.contains(&legacy_write_api));
}
