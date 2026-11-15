/**
 * [INPUT]: 依赖native runtime终结器、source SHA intent、owner前像和typed baseline fixture。
 * [OUTPUT]: 锁定live proof消费、commit、owner回滚/重放、第三态拒绝与原厂恢复；宿主fixture使用当前目标版本以抵达真实验源门。
 * 新增恢复回调时序合同由子模块native_runtime_preflight_tests复用fixture。
 * [POS]: recovery独立验源；generic finalizer拒绝NRT。
 * fixture source不证明厂商身份；不访问用户App/profile。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use super::*;

use std::{fs, path::PathBuf};

use crate::{
    native_mac_vendor_baseline::{
        load_baseline,
        tests::{capture_fixture_baseline, fixture, verify_fixture_baseline},
    },
    privilege::CommandRunner,
};

const TEST_BASELINE_ID: &str = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

#[derive(Default)]
struct FixtureRunner;

impl CommandRunner for FixtureRunner {
    fn run(&mut self, _program: &str, _args: &[String]) -> Result<(), String> {
        Ok(())
    }
}

fn vendor_intent(baseline_id: impl Into<String>) -> NativeRuntimeIntent {
    NativeRuntimeIntent::VendorBaselineRestore {
        baseline_id: baseline_id.into(),
    }
}

fn begin_transaction(
    state_dir: &Path,
    app_path: &Path,
    intent: NativeRuntimeIntent,
) -> MacApplyTransaction {
    let code_resources = app_path.join("Contents/_CodeSignature/CodeResources");
    let preimages =
        MacApplyTransaction::capture_preimages(app_path, std::slice::from_ref(&code_resources))
            .unwrap();
    MacApplyTransaction::begin_native_runtime_only_with_deferred_pairs_and_removals_guarded_by(
        intent,
        state_dir,
        app_path,
        &[],
        &[],
        &[],
        &[],
        &[],
        &[],
        std::slice::from_ref(&code_resources),
        &preimages,
        |_| Ok(()),
    )
    .unwrap()
}

fn reach_runtime_committed(transaction: &mut MacApplyTransaction) {
    transaction.begin_signing().unwrap();
    transaction
        .verify_and_record_signing_postimages(|_| Ok(()))
        .unwrap();
    transaction.checkpoint_verified_bundle().unwrap();
    transaction.checkpoint_native_runtime_commit().unwrap();
}

fn terminal_transaction(
    state_dir: &Path,
    app_path: &Path,
    intent: NativeRuntimeIntent,
    phase: JournalPhase,
) -> PathBuf {
    let mut transaction = begin_transaction(state_dir, app_path, intent);
    if phase == JournalPhase::Restored {
        let message = transaction.rollback_with_cause("fixture rollback");
        assert!(message.contains("preimages were restored"), "{message}");
        return journal_root(state_dir);
    }

    reach_runtime_committed(&mut transaction);
    assert!(matches!(
        phase,
        JournalPhase::RuntimeCommitted | JournalPhase::Committed
    ));
    if phase == JournalPhase::Committed {
        transaction.manifest.phase = JournalPhase::Committed;
        write_manifest(&transaction.journal_dir, &transaction.manifest).unwrap();
    }
    transaction.active = false;
    drop(transaction);
    journal_root(state_dir)
}

fn verify_fixture_intent(manifest: &JournalManifest, state_dir: &Path) -> Result<(), String> {
    match manifest.native_runtime_intent.as_ref() {
        Some(NativeRuntimeIntent::ManagedRuntime) => Ok(()),
        Some(NativeRuntimeIntent::BoundManagedRuntime { baseline_id, .. }) => {
            let app = Path::new(&manifest.install_root);
            load_baseline(app, state_dir, baseline_id)?;
            Ok(())
        }
        Some(NativeRuntimeIntent::VendorBaselineRestore { baseline_id }) => {
            let app = Path::new(&manifest.install_root);
            let baseline = load_baseline(app, state_dir, baseline_id)?;
            verify_fixture_baseline(&baseline, app)
        }
        None => Err("fixture journal has no durable source intent".into()),
    }
}

fn assert_journal_and_backup_exist(journal: &Path) {
    assert!(journal.is_dir());
    assert!(journal.join("backups/0.preimage").is_file());
}

fn write_observable_non_vendor_identity(app: &Path) {
    let target: serde_json::Value = serde_json::from_str(include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../tools/cavalry_native_target.json"
    )))
    .unwrap();
    fs::write(
        app.join("Contents/Info.plist"),
        format!(r#"<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleIdentifier</key><string>com.scenegroup.cavalry</string><key>CFBundleShortVersionString</key><string>{}</string><key>CFBundleExecutable</key><string>Cavalry</string></dict></plist>"#, target["cavalryVersion"].as_str().unwrap()),
    )
    .unwrap();
}

#[test]
fn intent_is_tagged_and_rejects_noncanonical_baseline_ids() {
    let intent = vendor_intent(TEST_BASELINE_ID);
    assert_eq!(intent.validate(), Ok(()));
    assert_eq!(
        serde_json::to_value(&intent).unwrap(),
        serde_json::json!({
            "kind": "vendorBaselineRestore",
            "baselineId": TEST_BASELINE_ID,
        })
    );
    assert!(vendor_intent("A".repeat(64)).validate().is_err());
    assert!(vendor_intent("a".repeat(63)).validate().is_err());
    assert!(vendor_intent("g".repeat(64)).validate().is_err());
    assert!(
        serde_json::from_value::<NativeRuntimeIntent>(serde_json::json!({
            "kind": "vendorBaselineRestore",
            "baselineId": TEST_BASELINE_ID,
            "extra": true,
        }))
        .is_err()
    );
}

#[test]
fn live_vendor_commit_loads_and_checks_the_bound_stock_slots() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let transaction = begin_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
    );
    let mut transaction = transaction;
    reach_runtime_committed(&mut transaction);

    let completion = transaction
        .commit_native_vendor_restore_with(|manifest, state_dir| {
            verify_fixture_intent(manifest, state_dir)
        })
        .unwrap();

    assert_eq!(completion.mode, "direct");
    assert!(!journal_root(&baseline_fixture.state).exists());
}

#[test]
fn live_vendor_commit_consumes_its_single_final_source_proof() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let baseline =
        load_baseline(&baseline_fixture.app, &baseline_fixture.state, &baseline_id).unwrap();
    let mut transaction = begin_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
    );

    transaction.begin_signing().unwrap();
    let mut source_proofs = 0;
    // Fixture槽核对仅测试proof流转，不充当真实Apple来源证明。
    let proof = transaction
        .verify_and_record_native_runtime_postimages(|app| {
            source_proofs += 1;
            verify_fixture_baseline(&baseline, app)
        })
        .unwrap();
    transaction.checkpoint_verified_bundle().unwrap();
    transaction.checkpoint_native_runtime_commit().unwrap();

    transaction
        .commit_native_vendor_restore_verified(proof)
        .unwrap();

    assert_eq!(source_proofs, 1);
    assert!(!journal_root(&baseline_fixture.state).exists());
}

#[test]
fn live_vendor_commit_rejects_generic_ad_hoc_validity_when_stock_slot_drifted() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    fs::write(
        baseline_fixture.app.join("Contents/MacOS/Cavalry"),
        b"post-capture drift",
    )
    .unwrap();
    let mut transaction = begin_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
    );
    reach_runtime_committed(&mut transaction);
    let journal = journal_root(&baseline_fixture.state);

    let error = transaction
        .commit_native_vendor_restore_with(|manifest, state_dir| {
            // FixtureRunner只模拟通用seal；固定槽前像仍须匹配。
            let mut runner = FixtureRunner;
            ensure_bundle_signature(Path::new(&manifest.install_root), &mut runner)?;
            verify_fixture_intent(manifest, state_dir)
        })
        .unwrap_err();

    assert!(error.contains("slots"), "{error}");
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn public_live_and_recovery_vendor_gates_reject_fixture_source_after_slot_match() {
    // fixture许可只服务槽合同，真实厂商门仍须拒绝。
    let live = fixture(false);
    write_observable_non_vendor_identity(&live.app);
    let live_id = capture_fixture_baseline(&live.app, &live.state);
    let baseline = load_baseline(&live.app, &live.state, &live_id).unwrap();
    verify_fixture_baseline(&baseline, &live.app).unwrap();
    let mut transaction = begin_transaction(&live.state, &live.app, vendor_intent(&live_id));
    reach_runtime_committed(&mut transaction);
    let live_journal = journal_root(&live.state);
    let mut runner = FixtureRunner;

    let error = transaction
        .commit_native_vendor_restore(&mut runner)
        .unwrap_err();
    assert!(
        error.contains("native host executable digest differs"),
        "{error}"
    );
    assert_journal_and_backup_exist(&live_journal);

    let recovery = fixture(false);
    write_observable_non_vendor_identity(&recovery.app);
    let recovery_id = capture_fixture_baseline(&recovery.app, &recovery.state);
    let baseline = load_baseline(&recovery.app, &recovery.state, &recovery_id).unwrap();
    verify_fixture_baseline(&baseline, &recovery.app).unwrap();
    let recovery_journal = terminal_transaction(
        &recovery.state,
        &recovery.app,
        vendor_intent(&recovery_id),
        JournalPhase::Committed,
    );
    let error =
        finalize_native_runtime_recovered(&recovery.state, &recovery.app, &mut runner).unwrap_err();
    assert!(
        error.contains("native host executable digest differs"),
        "{error}"
    );
    assert_journal_and_backup_exist(&recovery_journal);
}

#[test]
fn generic_commit_and_finalizer_keep_the_vendor_intent_blocked() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let mut transaction = begin_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
    );
    reach_runtime_committed(&mut transaction);
    let journal = journal_root(&baseline_fixture.state);

    let error = transaction.commit().unwrap_err();
    assert!(error.contains("source-specific"), "{error}");
    assert_journal_and_backup_exist(&journal);
    let error = finalize_recovered(&baseline_fixture.state, &baseline_fixture.app).unwrap_err();
    assert!(error.contains("source-specific"), "{error}");
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn recovery_vendor_commit_uses_expected_baseline_and_full_inventory() {
    for phase in [JournalPhase::RuntimeCommitted, JournalPhase::Committed] {
        let baseline_fixture = fixture(false);
        let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
        let journal = terminal_transaction(
            &baseline_fixture.state,
            &baseline_fixture.app,
            vendor_intent(&baseline_id),
            phase,
        );

        let outcome = finalize_native_runtime_recovered_with(
            &baseline_fixture.state,
            &baseline_fixture.app,
            verify_fixture_intent,
        )
        .unwrap();

        assert_eq!(outcome, NativeRuntimeRecoveryOutcome::Committed);
        assert!(!journal.exists());
    }
}

#[test]
fn managed_runtime_uses_the_existing_generic_seal_gate() {
    let baseline_fixture = fixture(false);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        NativeRuntimeIntent::ManagedRuntime,
        JournalPhase::Committed,
    );
    let mut runner = FixtureRunner;

    let outcome = finalize_native_runtime_recovered(
        &baseline_fixture.state,
        &baseline_fixture.app,
        &mut runner,
    )
    .unwrap();

    assert_eq!(outcome, NativeRuntimeRecoveryOutcome::Committed);
    assert!(!journal.exists());
}

#[test]
fn recovery_rejects_wrong_baseline_id_and_bundle_root() {
    let baseline_fixture = fixture(false);
    let _stored_baseline_id =
        capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent("b".repeat(64)),
        JournalPhase::Committed,
    );

    let error = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &baseline_fixture.app,
        verify_fixture_intent,
    )
    .unwrap_err();
    assert!(error.contains("baseline"), "{error}");
    assert_journal_and_backup_exist(&journal);

    let other = fixture(false);
    let error = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &other.app,
        verify_fixture_intent,
    )
    .unwrap_err();
    assert!(error.contains("not the selected"), "{error}");
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn restored_phase_cleans_exact_preimages_as_rollback_not_vendor_success() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
        JournalPhase::Restored,
    );
    let mut terminal_checks = 0;

    let outcome = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &baseline_fixture.app,
        |manifest, _| {
            assert_eq!(manifest.phase, JournalPhase::Restored);
            // Restored生产分支只验证原运行态的通用seal。
            terminal_checks += 1;
            Ok(())
        },
    )
    .unwrap();

    assert_eq!(outcome, NativeRuntimeRecoveryOutcome::RolledBack);
    assert_eq!(terminal_checks, 1);
    assert!(!journal.exists());
}

#[test]
fn restored_preimage_drift_keeps_journal_and_backup() {
    let baseline_fixture = fixture(false);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        NativeRuntimeIntent::ManagedRuntime,
        JournalPhase::Restored,
    );
    fs::write(
        baseline_fixture
            .app
            .join("Contents/_CodeSignature/CodeResources"),
        b"changed after rollback",
    )
    .unwrap();

    let error = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &baseline_fixture.app,
        |_, _| Ok(()),
    )
    .unwrap_err();

    assert!(
        error.contains("no longer matches its journaled preimage"),
        "{error}"
    );
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn production_restored_branch_checks_generic_seal_and_reports_rollback() {
    let baseline_fixture = fixture(false);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        NativeRuntimeIntent::ManagedRuntime,
        JournalPhase::Restored,
    );
    let mut runner = FixtureRunner;

    let outcome = finalize_native_runtime_recovered(
        &baseline_fixture.state,
        &baseline_fixture.app,
        &mut runner,
    )
    .unwrap();

    assert_eq!(outcome, NativeRuntimeRecoveryOutcome::RolledBack);
    assert!(!journal.exists());
}

#[test]
fn recovery_postimage_drift_blocks_retirement() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
        JournalPhase::Committed,
    );
    fs::write(
        baseline_fixture
            .app
            .join("Contents/_CodeSignature/CodeResources"),
        b"ad-hoc seal after commit",
    )
    .unwrap();

    let error = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &baseline_fixture.app,
        verify_fixture_intent,
    )
    .unwrap_err();

    assert!(
        error.contains("Committed macOS transaction postimage drifted"),
        "{error}"
    );
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn manifest_bytes_changed_during_source_check_block_retirement() {
    let baseline_fixture = fixture(false);
    let baseline_id = capture_fixture_baseline(&baseline_fixture.app, &baseline_fixture.state);
    let journal = terminal_transaction(
        &baseline_fixture.state,
        &baseline_fixture.app,
        vendor_intent(&baseline_id),
        JournalPhase::RuntimeCommitted,
    );

    let error = finalize_native_runtime_recovered_with(
        &baseline_fixture.state,
        &baseline_fixture.app,
        |manifest, state_dir| {
            verify_fixture_intent(manifest, state_dir)?;
            let path = journal.join(MANIFEST_NAME);
            let mut bytes = fs::read(&path).unwrap();
            bytes.push(b'\n');
            fs::write(path, bytes).unwrap();
            Ok(())
        },
    )
    .unwrap_err();

    assert!(error.contains("journal changed"), "{error}");
    assert_journal_and_backup_exist(&journal);
}

#[test]
fn vendor_restore_rollback_without_prior_owner_retains_journal() {
    let fixture = fixture(false);
    let journal = terminal_transaction(
        &fixture.state,
        &fixture.app,
        vendor_intent(TEST_BASELINE_ID),
        JournalPhase::Restored,
    );
    let error = finalize_native_runtime_recovered(&fixture.state, &fixture.app, &mut FixtureRunner)
        .unwrap_err();
    assert!(error.contains("no prior owner"), "{error}");
    assert_journal_and_backup_exist(&journal);
}

#[path = "native_runtime_preflight_tests.rs"]
mod preflight;
