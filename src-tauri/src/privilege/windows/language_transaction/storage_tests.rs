/**
 * [INPUT]: 依赖 storage/destination_io 的 tempfile-free 测试 seam、真实 Windows FileShare.None 与文件系统。
 * [OUTPUT]: 证明目标 CAS 至写入/删除保持同一独占句柄，并覆盖 prepare、apply-N、marker commit、rollback、cleanup、缺失 existing target 与篡改阻断等崩溃点；未知 postimage/成员/路径/摘要一律 fail closed。
 * [POS]: language_transaction/storage 的 Windows durable recovery 单元合同；只修改当前用户 TEMP 下的隔离夹具，不接触真实安装。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::{
    destination_io::LockedDestination, lower_hex, recover_pending, CommitCleanup, DurableJournal,
    JournalPhase, RecoveryOutcome, ResolvedPayload, ResolvedPreimage, RollbackOutcome,
    JOURNAL_PREFIX,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        static SEQUENCE: AtomicU64 = AtomicU64::new(0);
        let nonce = SEQUENCE.fetch_add(1, Ordering::Relaxed);
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "cavalry-i18n-storage-test-{}-{timestamp}-{nonce}",
            std::process::id()
        ));
        fs::create_dir(&path).unwrap();
        Self(path)
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn hash(bytes: &[u8]) -> String {
    lower_hex(&Sha256::digest(bytes))
}

fn write(path: &Path, bytes: &[u8]) {
    fs::create_dir_all(path.parent().unwrap()).unwrap();
    fs::write(path, bytes).unwrap();
}

fn payload(source: &Path, destination: &Path, original: Option<&[u8]>) -> ResolvedPayload {
    ResolvedPayload {
        source: source.to_path_buf(),
        destination: destination.to_path_buf(),
        source_sha256: hash(&fs::read(source).unwrap()),
        expected_destination_sha256: original.map(hash),
    }
}

fn nonce(character: char) -> String {
    character.to_string().repeat(64)
}

#[test]
fn journal_state_persists_versioned_entry_provenance() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("translated.bin");
    let destination = root.join("assets/value.json");
    write(&source, b"translated");
    write(&destination, b"official");

    let journal = DurableJournal::prepare(
        &root,
        &nonce('0'),
        std::slice::from_ref(&payload(&source, &destination, Some(b"official"))),
        &[],
    )
    .unwrap();
    let state = fs::read_to_string(journal.journal_root().join("journal.state")).unwrap();
    let manifest: serde_json::Value = serde_json::from_str(&state)
        .expect("durable journal state must be a versioned JSON manifest");
    let entry = &manifest["entries"][0];

    assert_eq!(manifest["schemaVersion"], 2);
    assert_eq!(manifest["phase"], "prepared");
    assert_eq!(manifest["installRoot"], root.to_string_lossy().as_ref());
    assert_eq!(entry["destination"], destination.to_string_lossy().as_ref());
    assert_eq!(entry["preimageSha256"], hash(b"official"));
    assert!(entry["postimageSha256"].is_array());
    assert!(entry["backup"].as_str().is_some());
    assert!(entry["permission"].is_object());
}

#[test]
fn startup_recovery_rolls_back_a_prepared_journal_after_crash() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let destination = root.join("assets/value.json");
    write(&marker_source, b"pending\n");
    write(&source, b"translated");
    write(&marker, b"en\n");
    write(&destination, b"official");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&source, &destination, Some(b"official"));
    let journal =
        DurableJournal::prepare(&root, &nonce('6'), &[marker_payload, asset_payload], &[]).unwrap();
    let journal_root = journal.journal_root().to_path_buf();

    let manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(journal_root.join("journal.state")).unwrap())
            .unwrap();
    assert_eq!(manifest["phase"], "prepared");
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&destination).unwrap(), b"official");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_accepts_a_complete_temporary_manifest_after_publish_crash() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let asset_source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    write(&marker_source, b"pending\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    write(&asset, b"official");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, Some(b"official"));
    let journal =
        DurableJournal::prepare(&root, &nonce('5'), &[marker_payload, asset_payload], &[]).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    fs::rename(
        journal_root.join("journal.state"),
        journal_root.join("journal.state.tmp"),
    )
    .unwrap();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
    assert_eq!(fs::read(&asset).unwrap(), b"official");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_prefers_authoritative_state_when_temporary_generation_differs() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&marker_source, b"pending\n");
    write(&marker, b"en\n");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let journal = DurableJournal::prepare(
        &root,
        &nonce('4'),
        std::slice::from_ref(&marker_payload),
        &[],
    )
    .unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    let mut different = fs::read(journal_root.join("journal.state")).unwrap();
    different.extend_from_slice(b"\n");
    fs::write(journal_root.join("journal.state.tmp"), different).unwrap();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert!(!journal_root.exists());
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
}

#[test]
fn startup_recovery_never_adopts_uncommitted_postimages_from_temporary_generation() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&marker_source, b"pending\n");
    write(&marker, b"en\n");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('e'),
        std::slice::from_ref(&marker_payload),
        &[],
    )
    .unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    let prepared = fs::read(journal_root.join("journal.state")).unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    let applying = fs::read(journal_root.join("journal.state")).unwrap();
    fs::write(journal_root.join("journal.state"), prepared).unwrap();
    fs::write(journal_root.join("journal.state.tmp"), applying).unwrap();
    std::mem::forget(journal);

    let error = recover_pending(&root).unwrap_err();
    assert!(error.contains("uncertain"), "{error}");
    assert!(!error.contains("disagree"), "{error}");
    assert!(journal_root.exists());
    assert_eq!(fs::read(&marker).unwrap(), b"pending\n");
}

#[test]
fn startup_recovery_rolls_back_after_an_interrupted_apply_n() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let first_source = temp.0.join("first.next");
    let second_source = temp.0.join("second.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let first = root.join("assets/first.json");
    let second = root.join("assets/second.json");
    write(&marker_source, b"pending\n");
    write(&first_source, b"first-translated");
    write(&second_source, b"second-translated");
    write(&marker, b"en\n");
    write(&first, b"first-official");
    write(&second, b"second-official");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let first_payload = payload(&first_source, &first, Some(b"first-official"));
    let second_payload = payload(&second_source, &second, Some(b"second-official"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('7'),
        &[
            marker_payload.clone(),
            first_payload.clone(),
            second_payload.clone(),
        ],
        &[],
    )
    .unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    journal.apply_payload(&first_payload).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
    assert_eq!(fs::read(&first).unwrap(), b"first-official");
    assert_eq!(fs::read(&second).unwrap(), b"second-official");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_removes_directories_created_after_their_manifest_entry() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let asset_source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("new/deep/value.json");
    let created_parent = root.join("new");
    write(&marker_source, b"pending\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, None);
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('d'),
        &[marker_payload.clone(), asset_payload.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    journal.apply_payload(&asset_payload).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    assert!(asset.is_file());
    assert!(created_parent.is_dir());
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
    assert!(!asset.exists());
    assert!(!created_parent.exists());
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_rolls_back_an_interrupted_marker_commit() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let pending_source = temp.0.join("marker.pending");
    let final_source = temp.0.join("marker.final");
    let asset_source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    write(&pending_source, b"pending\n");
    write(&final_source, b"zh-Hans\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    write(&asset, b"official");
    let pending = payload(&pending_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, Some(b"official"));
    let final_marker = payload(&final_source, &marker, Some(b"pending\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('8'),
        &[pending.clone(), asset_payload.clone(), final_marker.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    journal.apply_payload(&asset_payload).unwrap();
    journal.apply_transition_payload(&final_marker).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
    assert_eq!(fs::read(&asset).unwrap(), b"official");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_replays_a_rolling_back_journal_after_crash() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let asset_source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    write(&marker_source, b"pending\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    write(&asset, b"official");
    let pending = payload(&marker_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, Some(b"official"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('9'),
        &[pending.clone(), asset_payload.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    journal.apply_payload(&asset_payload).unwrap();
    journal.persist_manifest(JournalPhase::RollingBack).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::RolledBack);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
    assert_eq!(fs::read(&asset).unwrap(), b"official");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_finishes_committed_cleanup_after_backup_delete_crash() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("asset.next");
    let destination = root.join("assets/value.json");
    write(&source, b"translated");
    write(&destination, b"official");
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('a'),
        std::slice::from_ref(&payload(&source, &destination, Some(b"official"))),
        &[],
    )
    .unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    let backup = journal_root.join("0.preimage");
    let payload = payload(&source, &destination, Some(b"official"));
    journal.apply_payload(&payload).unwrap();
    journal.persist_manifest(JournalPhase::Committed).unwrap();
    fs::remove_file(backup).unwrap();
    std::mem::forget(journal);

    assert_eq!(recover_pending(&root).unwrap(), RecoveryOutcome::Completed);
    assert_eq!(fs::read(&destination).unwrap(), b"translated");
    assert!(!journal_root.exists());
}

#[test]
fn startup_recovery_blocks_an_unknown_hash_and_retains_the_journal() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let marker_source = temp.0.join("marker.pending");
    let asset_source = temp.0.join("asset.next");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    write(&marker_source, b"pending\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    write(&asset, b"official");
    let marker_payload = payload(&marker_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, Some(b"official"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('b'),
        &[marker_payload.clone(), asset_payload.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    journal.apply_payload(&asset_payload).unwrap();
    fs::write(&asset, b"unknown-third-party").unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    std::mem::forget(journal);

    let error = recover_pending(&root).unwrap_err();
    assert!(error.contains("uncertain"));
    assert_eq!(fs::read(&asset).unwrap(), b"unknown-third-party");
    assert!(journal_root.exists());
}

#[test]
fn startup_recovery_blocks_a_tampered_manifest_path() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("asset.next");
    let destination = root.join("assets/value.json");
    let outside = temp.0.join("outside.txt");
    write(&source, b"translated");
    write(&destination, b"official");
    write(&outside, b"must remain untouched");
    let journal = DurableJournal::prepare(
        &root,
        &nonce('c'),
        std::slice::from_ref(&payload(&source, &destination, Some(b"official"))),
        &[],
    )
    .unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    std::mem::forget(journal);
    let state_path = journal_root.join("journal.state");
    let mut manifest: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(&state_path).unwrap()).unwrap();
    manifest["entries"][0]["destination"] =
        serde_json::Value::String(outside.to_string_lossy().to_string());
    fs::write(&state_path, serde_json::to_vec_pretty(&manifest).unwrap()).unwrap();

    let error = recover_pending(&root).unwrap_err();
    assert!(error.contains("escaped") || error.contains("install root"));
    assert_eq!(fs::read(&outside).unwrap(), b"must remain untouched");
    assert!(journal_root.exists());
}

#[test]
fn destination_cas_and_write_share_one_exclusive_handle() {
    let temp = TestDirectory::new();
    let destination = temp.0.join("destination.bin");
    let source = temp.0.join("source.bin");
    write(&destination, b"original");
    write(&source, b"translated");

    let mut locked = LockedDestination::open_for_write(&destination, true).unwrap();
    assert_eq!(locked.preimage_sha256(), Some(hash(b"original").as_str()));

    let external_write = fs::write(&destination, b"external-race");
    assert!(
        external_write.is_err(),
        "FileShare.None must block a writer between CAS and mutation"
    );
    let external_rename = fs::rename(&destination, temp.0.join("replacement.bin"));
    assert!(
        external_rename.is_err(),
        "FileShare.None must block path replacement between CAS and mutation"
    );

    let mut source_file = fs::File::open(&source).unwrap();
    let permissions = source_file.metadata().unwrap().permissions();
    let mutation = locked.overwrite_from(&mut source_file, &permissions);
    assert_eq!(mutation.error, None);
    assert_eq!(mutation.observed_sha256, Some(hash(b"translated")));
    assert!(
        fs::write(&destination, b"external-after-write").is_err(),
        "the target must remain exclusive through its postcondition"
    );
    drop(locked);
    assert_eq!(fs::read(&destination).unwrap(), b"translated");
}

#[test]
fn transaction_created_target_is_deleted_by_its_verified_handle() {
    let temp = TestDirectory::new();
    let destination = temp.0.join("created.bin");
    write(&destination, b"owned");

    let locked = LockedDestination::open_existing_for_delete(&destination)
        .unwrap()
        .unwrap();
    assert_eq!(locked.preimage_sha256(), Some(hash(b"owned").as_str()));
    assert!(
        fs::write(&destination, b"external-race").is_err(),
        "rollback deletion must retain its CAS handle"
    );

    locked.delete_on_close().unwrap();
    assert!(!destination.exists());
}

#[test]
fn destination_drift_is_rechecked_immediately_before_write() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("staged.bin");
    let destination = root.join("assets/value.json");
    write(&source, b"translated");
    write(&destination, b"original");
    let payload = payload(&source, &destination, Some(b"original"));
    let mut journal =
        DurableJournal::prepare(&root, &nonce('a'), std::slice::from_ref(&payload), &[]).unwrap();
    fs::write(&destination, b"external-drift").unwrap();

    let error = journal.apply_payload(&payload).unwrap_err();

    assert!(error.message.contains("changed before payload write"));
    assert_eq!(fs::read(&destination).unwrap(), b"external-drift");
    assert!(matches!(journal.rollback(), RollbackOutcome::Uncertain(_)));
    assert_eq!(fs::read(&destination).unwrap(), b"external-drift");
}

#[test]
fn rollback_missing_existing_target_never_creates_an_empty_file() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("staged.bin");
    let destination = root.join("assets/value.json");
    write(&source, b"translated");
    write(&destination, b"original");
    let payload = payload(&source, &destination, Some(b"original"));
    let mut journal =
        DurableJournal::prepare(&root, &nonce('9'), std::slice::from_ref(&payload), &[]).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    journal.apply_payload(&payload).unwrap();
    fs::remove_file(&destination).unwrap();

    assert!(matches!(journal.rollback(), RollbackOutcome::Uncertain(_)));
    assert!(
        !destination.exists(),
        "missing expected-existing target must remain missing instead of becoming an empty file"
    );
    assert!(journal_root.is_dir());
}

#[test]
fn failure_between_payloads_rolls_back_every_owned_write() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let first_source = temp.0.join("first.bin");
    let second_source = temp.0.join("second.bin");
    let first_target = root.join("assets/first.json");
    let second_target = root.join("assets/second.json");
    write(&first_source, b"first-translated");
    write(&second_source, b"second-translated");
    write(&first_target, b"first-original");
    write(&second_target, b"second-original");
    let first = payload(&first_source, &first_target, Some(b"first-original"));
    let second = payload(&second_source, &second_target, Some(b"second-original"));
    let mut journal =
        DurableJournal::prepare(&root, &nonce('b'), &[first.clone(), second.clone()], &[]).unwrap();
    journal.apply_payload(&first).unwrap();
    fs::write(&second_source, b"tampered-after-plan").unwrap();

    assert!(journal.apply_payload(&second).is_err());
    assert_eq!(journal.rollback(), RollbackOutcome::Restored);
    assert_eq!(fs::read(&first_target).unwrap(), b"first-original");
    assert_eq!(fs::read(&second_target).unwrap(), b"second-original");
}

#[test]
fn unowned_qpa_delta_keeps_pending_marker_and_is_uncertain() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("marker.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    let qwindows = root.join("qwindows.dll");
    write(&source, b"pending\n");
    write(&marker, b"en\n");
    write(&qwindows, b"vendor-qwindows");
    let marker_payload = payload(&source, &marker, Some(b"en\n"));
    let qpa = ResolvedPreimage {
        destination: qwindows.clone(),
        expected_sha256: Some(hash(b"vendor-qwindows")),
    };
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('c'),
        std::slice::from_ref(&marker_payload),
        std::slice::from_ref(&qpa),
    )
    .unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    fs::write(&qwindows, b"proxy-qwindows").unwrap();
    let journal_root = journal.journal_root().to_path_buf();

    assert!(matches!(
        journal.rollback_fail_closed(&marker),
        RollbackOutcome::Uncertain(_)
    ));
    assert_eq!(fs::read(&marker).unwrap(), b"pending\n");
    assert_eq!(fs::read(&qwindows).unwrap(), b"proxy-qwindows");
    assert!(journal_root.is_dir());
}

#[test]
fn unknown_current_hash_is_preserved_and_marks_rollback_uncertain() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    fs::create_dir(&root).unwrap();
    let qwindows = root.join("qwindows.dll");
    write(&qwindows, b"vendor-qwindows");
    let qpa = ResolvedPreimage {
        destination: qwindows.clone(),
        expected_sha256: Some(hash(b"vendor-qwindows")),
    };
    let journal =
        DurableJournal::prepare(&root, &nonce('d'), &[], std::slice::from_ref(&qpa)).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    fs::write(&qwindows, b"unknown-third-party").unwrap();

    let RollbackOutcome::Uncertain(residual) = journal.rollback() else {
        panic!("unknown current hash must make rollback uncertain");
    };
    assert_eq!(fs::read(&qwindows).unwrap(), b"unknown-third-party");
    assert!(residual.paths.contains(&qwindows));
    assert!(journal_root.is_dir());
}

#[test]
fn clean_commit_removes_the_nonce_derived_journal() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    fs::create_dir(&root).unwrap();
    let journal = DurableJournal::prepare(&root, &nonce('e'), &[], &[]).unwrap();
    let path = journal.journal_root().to_path_buf();
    assert!(path.ends_with(format!("{JOURNAL_PREFIX}{}", nonce('e'))));

    assert_eq!(journal.commit(), CommitCleanup::Clean);
    assert!(!path.exists());
}

#[test]
fn unknown_journal_member_is_preserved_and_keeps_pending_marker() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let source = temp.0.join("pending-marker.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&source, b"pending\n");
    write(&marker, b"en\n");
    let marker_payload = payload(&source, &marker, Some(b"en\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('3'),
        std::slice::from_ref(&marker_payload),
        &[],
    )
    .unwrap();
    journal.apply_payload(&marker_payload).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    let unknown = journal_root.join("unknown.bin");
    fs::write(&unknown, b"not-owned").unwrap();

    assert!(matches!(
        journal.rollback_fail_closed(&marker),
        RollbackOutcome::Uncertain(_)
    ));
    assert_eq!(fs::read(&marker).unwrap(), b"pending\n");
    assert_eq!(fs::read(&unknown).unwrap(), b"not-owned");
    assert!(journal_root.is_dir());
}

#[test]
fn commit_preserves_unknown_journal_member_as_cleanup_residual() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    fs::create_dir(&root).unwrap();
    let journal = DurableJournal::prepare(&root, &nonce('4'), &[], &[]).unwrap();
    let journal_root = journal.journal_root().to_path_buf();
    let unknown = journal_root.join("unknown.bin");
    fs::write(&unknown, b"not-owned").unwrap();

    assert!(matches!(journal.commit(), CommitCleanup::Residual(_)));
    assert_eq!(fs::read(&unknown).unwrap(), b"not-owned");
    assert!(journal_root.is_dir());
}

#[test]
fn fail_closed_rollback_restores_marker_only_after_other_payloads() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let pending_source = temp.0.join("pending-marker.bin");
    let asset_source = temp.0.join("asset.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    let asset = root.join("assets/value.json");
    write(&pending_source, b"pending\n");
    write(&asset_source, b"translated");
    write(&marker, b"en\n");
    write(&asset, b"original");
    let pending = payload(&pending_source, &marker, Some(b"en\n"));
    let asset_payload = payload(&asset_source, &asset, Some(b"original"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('5'),
        &[pending.clone(), asset_payload.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    journal.apply_payload(&asset_payload).unwrap();

    assert_eq!(
        journal.rollback_fail_closed(&marker),
        RollbackOutcome::Restored
    );
    assert_eq!(fs::read(&asset).unwrap(), b"original");
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
}

#[test]
fn same_destination_pending_then_final_is_allowed_in_order() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let pending_source = temp.0.join("pending-marker.bin");
    let final_source = temp.0.join("final-marker.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&pending_source, b"pending\n");
    write(&final_source, b"zh-Hans\n");
    write(&marker, b"en\n");
    let pending = payload(&pending_source, &marker, Some(b"en\n"));
    let final_payload = payload(&final_source, &marker, Some(b"pending\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('f'),
        &[pending.clone(), final_payload.clone()],
        &[],
    )
    .unwrap();

    journal.apply_payload(&pending).unwrap();
    journal.apply_transition_payload(&final_payload).unwrap();

    assert_eq!(fs::read(&marker).unwrap(), b"zh-Hans\n");
    assert_eq!(journal.commit(), CommitCleanup::Clean);
}

#[test]
fn rollback_after_pending_then_final_restores_first_preimage() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let pending_source = temp.0.join("pending-marker.bin");
    let final_source = temp.0.join("final-marker.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&pending_source, b"pending\n");
    write(&final_source, b"ja_JP\n");
    write(&marker, b"en\n");
    let pending = payload(&pending_source, &marker, Some(b"en\n"));
    let final_payload = payload(&final_source, &marker, Some(b"pending\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('1'),
        &[pending.clone(), final_payload.clone()],
        &[],
    )
    .unwrap();

    journal.apply_payload(&pending).unwrap();
    journal.apply_transition_payload(&final_payload).unwrap();

    assert_eq!(journal.rollback(), RollbackOutcome::Restored);
    assert_eq!(fs::read(&marker).unwrap(), b"en\n");
}

#[test]
fn unknown_intermediate_hash_blocks_final_and_is_preserved() {
    let temp = TestDirectory::new();
    let root = temp.0.join("Cavalry");
    let pending_source = temp.0.join("pending-marker.bin");
    let final_source = temp.0.join("final-marker.bin");
    let marker = root.join("cavalry-i18n-lang.txt");
    write(&pending_source, b"pending\n");
    write(&final_source, b"zh-Hant\n");
    write(&marker, b"en\n");
    let pending = payload(&pending_source, &marker, Some(b"en\n"));
    let final_payload = payload(&final_source, &marker, Some(b"pending\n"));
    let mut journal = DurableJournal::prepare(
        &root,
        &nonce('2'),
        &[pending.clone(), final_payload.clone()],
        &[],
    )
    .unwrap();
    journal.apply_payload(&pending).unwrap();
    fs::write(&marker, b"external-change\n").unwrap();

    let error = journal
        .apply_transition_payload(&final_payload)
        .unwrap_err();

    assert!(error.message.contains("changed before payload write"));
    assert!(matches!(journal.rollback(), RollbackOutcome::Uncertain(_)));
    assert_eq!(fs::read(&marker).unwrap(), b"external-change\n");
}
