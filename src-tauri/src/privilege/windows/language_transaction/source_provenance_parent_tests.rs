/**
 * [INPUT]: 依赖 patch::build_copy_pairs_checked/build_overlay_pairs、parent 真实 classify/prepare/stage 路径、编译期 catalog 与 source_provenance test seam。
 * [OUTPUT]: 证明 zh-Hans 当前态到 ja_JP 的 canonical overlay 与 English 快照原字节经真实 parent staging 后都被 verifier 接受，且同一 staged payload 篡改后被拒绝。
 * [POS]: parent tests 的端到端来源合同；连接上游 canonical overlay、数字 payload staging 与提权 worker 只读 provenance，不模拟复制算法。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fs,
    path::{Path, PathBuf},
};

use crate::{
    install::InstallLayout,
    patch::{self, CORE_MAP},
};

use super::{
    super::{classify_overlay_pairs, prepare_parent_plan, ParentApplyRequest, RuntimeSources},
    synthetic_transition,
};
use crate::privilege::windows::language_transaction::{
    contract::{payload_source_path, Language, PayloadKind},
    source_provenance::verify_payload_records_for_test,
};

#[test]
fn real_parent_staging_accepts_cross_language_zh_hans_to_japanese() {
    let fixture = ProvenanceFixture::new();
    let prepared = fixture.prepare(Language::Japanese);

    verify_payload_records_for_test(
        &prepared.plan,
        &prepared.plan_path,
        &fixture.layout,
        &fixture.package_root,
    )
    .unwrap();
}

#[test]
fn real_parent_staging_accepts_exact_english_snapshot_bytes() {
    let fixture = ProvenanceFixture::new();
    let prepared = fixture.prepare(Language::English);

    verify_payload_records_for_test(
        &prepared.plan,
        &prepared.plan_path,
        &fixture.layout,
        &fixture.package_root,
    )
    .unwrap();
}

#[test]
fn real_parent_staging_rejects_post_prepare_payload_tampering() {
    let fixture = ProvenanceFixture::new();
    let prepared = fixture.prepare(Language::Japanese);
    let asset_index = prepared
        .plan
        .payloads
        .iter()
        .position(|record| record.kind == PayloadKind::CoreAsset)
        .unwrap();
    let source = payload_source_path(&prepared.plan_path, asset_index).unwrap();
    let mut bytes = fs::read(&source).unwrap();
    bytes.extend_from_slice(b"\n");
    fs::write(&source, bytes).unwrap();

    assert!(verify_payload_records_for_test(
        &prepared.plan,
        &prepared.plan_path,
        &fixture.layout,
        &fixture.package_root,
    )
    .is_err());
}

struct ProvenanceFixture {
    _temp: tempfile::TempDir,
    package_root: PathBuf,
    layout: InstallLayout,
    state_dir: PathBuf,
    staging_root: PathBuf,
    worker_executable: PathBuf,
}

impl ProvenanceFixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let repository_root = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .to_path_buf();
        let package_root = temp.path().join("package");
        for language in ["en", "zh-Hans", "ja_JP"] {
            for (language_relative, _) in CORE_MAP {
                copy_file(
                    &repository_root
                        .join("languages")
                        .join(language)
                        .join(language_relative),
                    &package_root
                        .join("languages")
                        .join(language)
                        .join(language_relative),
                );
            }
        }
        for relative in [
            "injector/windows/generic/cavalryi18n.dll",
            "injector/windows/qpa/qwindows.dll",
        ] {
            copy_file(
                &repository_root.join(relative),
                &package_root.join(relative),
            );
        }
        let install_root = temp.path().join("Program Files/Cavalry");
        fs::create_dir_all(&install_root).unwrap();
        let layout = InstallLayout::from_root(&fs::canonicalize(install_root).unwrap());
        fs::create_dir_all(layout.assets_root.join("Definitions")).unwrap();
        fs::create_dir_all(layout.assets_root.join("Plugins")).unwrap();
        fs::write(&layout.executable, b"fixture Cavalry executable").unwrap();
        fs::write(layout.root.join("Qt6Core.dll"), b"fixture Qt").unwrap();
        fs::write(
            layout.root.join("qwindows.dll"),
            super::fake_x64_pe(b"fixture vendor QPA"),
        )
        .unwrap();
        fs::write(&layout.language_marker, b"zh-Hans\n").unwrap();

        let state_dir = temp.path().join("state");
        let current_source = temp.path().join("source-zh-Hans");
        for (language_relative, _) in CORE_MAP {
            copy_file(
                &package_root.join("languages/en").join(language_relative),
                &state_dir.join("en").join(language_relative),
            );
            copy_file(
                &package_root
                    .join("languages/zh-Hans")
                    .join(language_relative),
                &current_source.join(language_relative),
            );
        }
        let current_pairs = patch::build_overlay_pairs(
            &current_source,
            &state_dir.join("en"),
            &layout.root,
            &temp.path().join("current-overlay"),
        )
        .unwrap();
        assert_eq!(current_pairs.len(), CORE_MAP.len());
        for pair in &current_pairs {
            copy_file(&pair.src, &pair.dst);
        }

        let staging_root = state_dir.join("staging");
        fs::create_dir_all(&staging_root).unwrap();
        let worker_executable = temp.path().join("switcher.exe");
        fs::write(&worker_executable, b"fixture switcher").unwrap();
        Self {
            _temp: temp,
            package_root,
            layout,
            state_dir,
            staging_root,
            worker_executable,
        }
    }

    fn prepare(&self, language: Language) -> super::super::PreparedParentPlan {
        let source_dir = if language == Language::English {
            self.state_dir.join("en")
        } else {
            let source = self
                ._temp
                .path()
                .join(format!("source-{}", language.as_str()));
            for (language_relative, _) in CORE_MAP {
                copy_file(
                    &self
                        .package_root
                        .join("languages")
                        .join(language.as_str())
                        .join(language_relative),
                    &source.join(language_relative),
                );
            }
            source
        };
        let target_pairs = if language == Language::English {
            patch::build_copy_pairs_checked(&source_dir, &self.layout.root).unwrap()
        } else {
            patch::build_overlay_pairs(
                &source_dir,
                &self.state_dir.join("en"),
                &self.layout.root,
                &self
                    ._temp
                    .path()
                    .join(format!("target-overlay-{}", language.as_str())),
            )
            .unwrap()
        };
        assert_eq!(target_pairs.len(), CORE_MAP.len());
        let request = ParentApplyRequest {
            repo_root: &self.package_root,
            resource_dir: &self.package_root,
            state_dir: &self.state_dir,
            layout: &self.layout,
            language: language.as_str(),
            cavalry_version: "2.7.2",
            staging_root: &self.staging_root,
            overlay_pairs: &target_pairs,
        };
        let classified = classify_overlay_pairs(&self.layout, &target_pairs).unwrap();
        let runtime_sources = RuntimeSources {
            generic: {
                self.package_root
                    .join("injector/windows/generic/cavalryi18n.dll")
            },
            proxy: self.package_root.join("injector/windows/qpa/qwindows.dll"),
        };
        prepare_parent_plan(
            &request,
            language,
            &self.worker_executable,
            &runtime_sources,
            classified,
            &mut synthetic_transition,
        )
        .unwrap()
    }
}

fn copy_file(source: &Path, destination: &Path) {
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::copy(source, destination).unwrap();
}
