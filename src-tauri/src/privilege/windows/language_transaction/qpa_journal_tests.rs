/**
 * [INPUT]: 依赖 storage 的 durable journal、预期 postimage 所有权记录与 tempfile 文件系统夹具。
 * [OUTPUT]: 证明 QPA 首次写入前已持久化精确 postimage、Noop/清理路径保留固定 surface 所有权、崩溃后可恢复原始字节，且损坏备份不会制造空目标。
 * [POS]: language_transaction/storage 的 QPA 崩溃窗口回归测试；模拟进程遗忘 journal，不触碰真实 Cavalry 安装。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{fs, mem};

use sha2::{Digest, Sha256};

use crate::{
    install::InstallLayout,
    windows_qpa::{QpaNoopPlan, QpaNoopReason, QpaTransitionPlan},
};

use super::*;

#[test]
fn expected_qpa_postimage_is_durable_before_the_first_qpa_write() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Cavalry");
    let qwindows = root.join("qwindows.dll");
    let marker = root.join("cavalry-i18n-lang.txt");
    let pending_source = temp.path().join("pending-marker.txt");
    fs::create_dir_all(&root).unwrap();
    fs::write(&qwindows, b"vendor-qwindows").unwrap();
    fs::write(&marker, b"en\n").unwrap();
    fs::write(&pending_source, b"pending\n").unwrap();
    let pending = ResolvedPayload {
        source: pending_source,
        destination: marker.clone(),
        source_sha256: hash(b"pending\n"),
        expected_destination_sha256: Some(hash(b"en\n")),
    };
    let preimage = ResolvedPreimage {
        destination: qwindows.clone(),
        expected_sha256: Some(hash(b"vendor-qwindows")),
    };
    let mut journal = DurableJournal::prepare(
        &root,
        &"a".repeat(64),
        std::slice::from_ref(&pending),
        std::slice::from_ref(&preimage),
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    journal
        .record_expected_postimages(&[ResolvedPostimage {
            destination: qwindows.clone(),
            expected_sha256: Some(hash(b"proxy-qwindows")),
        }])
        .unwrap();

    fs::write(&qwindows, b"proxy-qwindows").unwrap();
    mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(qwindows).unwrap(), b"vendor-qwindows");
    assert_eq!(fs::read(marker).unwrap(), b"en\n");
    assert!(!has_pending(&root).unwrap());
}

#[test]
fn noop_qpa_allows_json_and_marker_reconciliation_with_an_unchanged_surface() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Cavalry");
    let layout = InstallLayout::from_root(&root);
    let qwindows = root.join("qwindows.dll");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    let marker_source = temp.path().join("marker.pending");
    let asset_source = temp.path().join("asset.next");
    fs::create_dir_all(asset.parent().unwrap()).unwrap();
    fs::write(&qwindows, b"vendor-qwindows").unwrap();
    fs::write(&marker, b"en\n").unwrap();
    fs::write(&asset, b"official").unwrap();
    fs::write(&marker_source, b"pending\n").unwrap();
    fs::write(&asset_source, b"translated").unwrap();

    let surface = crate::windows_qpa::rollback_file_surface(&layout);
    let fixed = surface
        .iter()
        .map(|destination| ResolvedPreimage {
            destination: destination.clone(),
            expected_sha256: snapshot_hash(destination).unwrap(),
        })
        .collect::<Vec<_>>();
    let preimage_hashes = fixed
        .iter()
        .map(|entry| entry.expected_sha256.clone())
        .collect::<Vec<_>>();
    let qpa_plan = QpaTransitionPlan::Noop(QpaNoopPlan {
        schema_version: 1,
        install_root: root.to_string_lossy().to_string(),
        reason: QpaNoopReason::AlreadyStock,
        cavalry_version: "2.7.2".to_string(),
        cavalry_executable_sha256: "a".repeat(64),
        qt_version: "6.6.3".to_string(),
        architecture: "x86_64".to_string(),
        expected_current_qwindows_sha256: Some(hash(b"vendor-qwindows")),
    });
    let marker_payload = ResolvedPayload {
        source: marker_source,
        destination: marker,
        source_sha256: hash(b"pending\n"),
        expected_destination_sha256: Some(hash(b"en\n")),
    };
    let asset_payload = ResolvedPayload {
        source: asset_source,
        destination: asset,
        source_sha256: hash(b"translated"),
        expected_destination_sha256: Some(hash(b"official")),
    };
    let qpa_postimages =
        crate::windows_qpa::expected_transition_postimages(&layout, &qpa_plan, &preimage_hashes)
            .unwrap()
            .into_iter()
            .map(|postimage| ResolvedPostimage {
                destination: postimage.path,
                expected_sha256: postimage.sha256,
            })
            .collect::<Vec<_>>();
    let mut journal = DurableJournal::prepare(
        &root,
        &"f".repeat(64),
        &[marker_payload.clone(), asset_payload.clone()],
        &fixed,
    )
    .unwrap();
    journal.record_expected_postimages(&qpa_postimages).unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    journal.apply_payload(&asset_payload).unwrap();

    journal.verify_expected_postimages(&surface).unwrap();
}

#[test]
fn recovery_recreates_an_original_qpa_directory_removed_before_a_crash() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Cavalry");
    let recovery = root.join("cavalry-i18n-qpa");
    let vendor = recovery.join("vendor-qwindows.dll");
    let manifest = recovery.join("manifest.json");
    let marker = root.join("cavalry-i18n-lang.txt");
    let pending_source = temp.path().join("pending-marker.txt");
    fs::create_dir_all(&recovery).unwrap();
    fs::write(&vendor, b"vendor-backup").unwrap();
    fs::write(&manifest, b"manifest-before").unwrap();
    fs::write(&marker, b"en\n").unwrap();
    fs::write(&pending_source, b"pending\n").unwrap();
    let pending = ResolvedPayload {
        source: pending_source,
        destination: marker.clone(),
        source_sha256: hash(b"pending\n"),
        expected_destination_sha256: Some(hash(b"en\n")),
    };
    let fixed = [
        ResolvedPreimage {
            destination: vendor.clone(),
            expected_sha256: Some(hash(b"vendor-backup")),
        },
        ResolvedPreimage {
            destination: manifest.clone(),
            expected_sha256: Some(hash(b"manifest-before")),
        },
    ];
    let mut journal = DurableJournal::prepare(
        &root,
        &"b".repeat(64),
        std::slice::from_ref(&pending),
        &fixed,
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    journal
        .record_expected_postimages(&[
            ResolvedPostimage {
                destination: vendor.clone(),
                expected_sha256: None,
            },
            ResolvedPostimage {
                destination: manifest.clone(),
                expected_sha256: None,
            },
        ])
        .unwrap();
    fs::remove_file(&vendor).unwrap();
    fs::remove_file(&manifest).unwrap();
    fs::remove_dir(&recovery).unwrap();
    mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(vendor).unwrap(), b"vendor-backup");
    assert_eq!(fs::read(manifest).unwrap(), b"manifest-before");
    assert_eq!(fs::read(marker).unwrap(), b"en\n");
}

#[test]
fn corrupt_backup_never_creates_a_missing_original_target() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Cavalry");
    let qwindows = root.join("qwindows.dll");
    fs::create_dir_all(&root).unwrap();
    fs::write(&qwindows, b"vendor-qwindows").unwrap();
    let preimage = ResolvedPreimage {
        destination: qwindows.clone(),
        expected_sha256: Some(hash(b"vendor-qwindows")),
    };
    let mut journal =
        DurableJournal::prepare(&root, &"c".repeat(64), &[], std::slice::from_ref(&preimage))
            .unwrap();
    journal
        .record_expected_postimages(&[ResolvedPostimage {
            destination: qwindows.clone(),
            expected_sha256: None,
        }])
        .unwrap();
    let backup = journal.entries[0].backup.clone().unwrap();
    fs::remove_file(&qwindows).unwrap();
    fs::write(backup, b"corrupt-backup").unwrap();

    assert!(matches!(journal.rollback(), RollbackOutcome::Uncertain(_)));
    assert!(!qwindows.exists());
}

#[test]
fn write_after_qpa_is_never_adopted_as_transaction_owned() {
    let temp = tempfile::tempdir().unwrap();
    let root = temp.path().join("Cavalry");
    let qwindows = root.join("qwindows.dll");
    fs::create_dir_all(&root).unwrap();
    fs::write(&qwindows, b"vendor-qwindows").unwrap();
    let preimage = ResolvedPreimage {
        destination: qwindows.clone(),
        expected_sha256: Some(hash(b"vendor-qwindows")),
    };
    let mut journal =
        DurableJournal::prepare(&root, &"d".repeat(64), &[], std::slice::from_ref(&preimage))
            .unwrap();
    journal
        .record_expected_postimages(&[ResolvedPostimage {
            destination: qwindows.clone(),
            expected_sha256: Some(hash(b"proxy-qwindows")),
        }])
        .unwrap();
    fs::write(&qwindows, b"external-write").unwrap();

    assert!(journal
        .verify_expected_postimages(std::slice::from_ref(&qwindows))
        .is_err());
    assert!(matches!(journal.rollback(), RollbackOutcome::Uncertain(_)));
    assert_eq!(fs::read(qwindows).unwrap(), b"external-write");
}

fn hash(bytes: &[u8]) -> String {
    format!("{:x}", Sha256::digest(bytes))
}
