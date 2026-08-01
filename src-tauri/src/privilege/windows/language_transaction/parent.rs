/**
 * [INPUT]: 依赖 OS-known Program Files、固定 JSON 映射、Windows runtime 打包源、QPA transition 合同与 same-EXE RunAs launcher。
 * [OUTPUT]: 提供 Program Files 早分流、严格 payload staging、English cleanup 的当前 generic 所有权输入、已证明 Noop 快路与单次 UAC typed 结果。
 * [POS]: language_transaction 的非提权父进程；只准备 hash-locked 计划并等待 worker，绝不关闭 Cavalry、写状态、重启或直接修改安装根。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::{
    fmt, fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
    time::{SystemTime, UNIX_EPOCH},
};

use crate::{
    install::{InstallLayout, InstallPlatform},
    patch::CopyPair,
    windows_qpa::{
        self, ActivationRequest, QpaDeploymentState, QpaNoopReason, QpaTransitionPlan,
        RestoreReason, RestoreRequest, GENERIC_PLUGIN_RELATIVE_PATH,
    },
    windows_runtime,
};

use super::{
    contract::{
        serialize_plan, ElevatedLanguagePlan, Language, PayloadKind, WorkerTransport,
        FINAL_MARKER_ID, GENERIC_PLUGIN_ID, PENDING_MARKER_ID, PLAN_SCHEMA_VERSION,
        QPA_PROXY_SOURCE_ID, WORKER_EXIT_CAVALRY_STILL_RUNNING, WORKER_EXIT_COMMITTED_CLEAN,
        WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL,
        WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN, WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN,
    },
    launcher::{launch_elevated_worker, LaunchError, LaunchFailurePhase},
};
use crate::privilege::windows::known_folders::{
    ensure_no_reparse_points, metadata_is_reparse_point, path_is_within,
    trusted_root_for_destination, windows_trusted_program_files_roots,
};

#[path = "parent_mapping.rs"]
mod mapping;
use mapping::{classify_overlay_pairs, ClassifiedPair};
#[path = "parent_storage.rs"]
mod parent_storage;
use parent_storage::{
    cleanup_directory, cleanup_outer_staging, hex_digest, sha256_file, snapshot_hash,
    stage_bytes_payload, stage_file_payload, write_new_file, StagedPayload,
};

const PENDING_MARKER_BYTES: &[u8] = b"pending\n";
const PLAN_FILE_NAME: &str = "plan.json";

static PLAN_NONCE_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Debug, Clone, Copy)]
pub(crate) struct ParentApplyRequest<'a> {
    pub(crate) repo_root: &'a Path,
    pub(crate) resource_dir: &'a Path,
    pub(crate) state_dir: &'a Path,
    pub(crate) layout: &'a InstallLayout,
    pub(crate) language: &'a str,
    pub(crate) cavalry_version: &'a str,
    pub(crate) staging_root: &'a Path,
    pub(crate) overlay_pairs: &'a [CopyPair],
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ParentApplyOutcome {
    NotApplicable,
    Applied {
        worker_cleanup_residual: bool,
        staging_cleanup_warning: Option<String>,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum ParentApplyError {
    PermissionRequired {
        code: u32,
        staging_cleanup_warning: Option<String>,
    },
    Rejected(String),
    WorkerRolledBack {
        staging_cleanup_warning: Option<String>,
    },
    CavalryStillRunning {
        staging_cleanup_warning: Option<String>,
    },
    WorkerStateUncertain {
        staging_cleanup_warning: Option<String>,
    },
    UnexpectedWorkerExit {
        code: u32,
        staging_cleanup_warning: Option<String>,
    },
}

impl fmt::Display for ParentApplyError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::PermissionRequired {
                code,
                staging_cleanup_warning,
            } => write_with_cleanup(
                formatter,
                format!(
                    "Windows administrator consent is required to update this Program Files installation ({code})."
                ),
                staging_cleanup_warning,
            ),
            Self::Rejected(message) => formatter.write_str(message),
            Self::WorkerRolledBack {
                staging_cleanup_warning,
            } => write_with_cleanup(
                formatter,
                "The elevated Windows language transaction failed and restored its exact preimage.",
                staging_cleanup_warning,
            ),
            Self::CavalryStillRunning {
                staging_cleanup_warning,
            } => write_with_cleanup(
                formatter,
                "Cavalry is still running. Save your work, close Cavalry, and try again. The Cavalry installation was not changed.",
                staging_cleanup_warning,
            ),
            Self::WorkerStateUncertain {
                staging_cleanup_warning,
            } => write_with_cleanup(
                formatter,
                "The elevated Windows language transaction could not prove a complete rollback; Cavalry was not restarted.",
                staging_cleanup_warning,
            ),
            Self::UnexpectedWorkerExit {
                code,
                staging_cleanup_warning,
            } => write_with_cleanup(
                formatter,
                format!(
                    "The elevated Windows language worker returned an unknown exit code ({code}); Cavalry was not restarted."
                ),
                staging_cleanup_warning,
            ),
        }
    }
}

impl std::error::Error for ParentApplyError {}

#[derive(Debug)]
struct PreparedParentPlan {
    directory: PathBuf,
    plan_path: PathBuf,
    plan: ElevatedLanguagePlan,
    payloads: Vec<StagedPayload>,
}

struct RuntimeSources {
    generic: PathBuf,
    proxy: PathBuf,
}

pub(crate) fn apply_if_program_files(
    request: ParentApplyRequest<'_>,
) -> Result<ParentApplyOutcome, ParentApplyError> {
    if request.layout.platform != InstallPlatform::Windows {
        return Ok(ParentApplyOutcome::NotApplicable);
    }
    let trusted_roots = match windows_trusted_program_files_roots() {
        Ok(roots) => roots,
        Err(error) => {
            return finalize_outer_cleanup(Err(rejected(error)), &request);
        }
    };
    if trusted_root_for_destination(&request.layout.root, &trusted_roots).is_none() {
        return Ok(ParentApplyOutcome::NotApplicable);
    }

    let result = (|| {
        let language = parse_language(request.language)?;
        let sources = RuntimeSources {
            generic: windows_runtime::resolve_plugin_source(
                request.resource_dir,
                request.repo_root,
            )
            .map_err(rejected)?,
            proxy: windows_runtime::resolve_qpa_proxy_source(
                request.resource_dir,
                request.repo_root,
            )
            .map_err(rejected)?,
        };
        let current_exe = std::env::current_exe()
            .map_err(|error| rejected(format!("Could not resolve current executable: {error}")))?;

        apply_with_dependencies(
            request,
            language,
            &trusted_roots,
            &current_exe,
            sources,
            |language, layout, cavalry_version, proxy, generic| {
                build_qpa_transition(language, layout, cavalry_version, proxy, generic)
            },
            |exe, token| launch_elevated_worker(exe, token),
            verify_qpa_postcondition,
        )
    })();
    finalize_outer_cleanup(result, &request)
}

fn apply_with_dependencies<B, L, V>(
    request: ParentApplyRequest<'_>,
    language: Language,
    trusted_roots: &[PathBuf],
    current_exe: &Path,
    runtime_sources: RuntimeSources,
    mut build_transition: B,
    mut launch: L,
    verify_qpa: V,
) -> Result<ParentApplyOutcome, ParentApplyError>
where
    B: FnMut(
        Language,
        &InstallLayout,
        &str,
        &Path,
        Option<&Path>,
    ) -> Result<QpaTransitionPlan, String>,
    L: FnMut(&Path, &str) -> Result<u32, LaunchError>,
    V: Fn(&InstallLayout, Language, &QpaTransitionPlan) -> Result<(), String>,
{
    if trusted_root_for_destination(&request.layout.root, trusted_roots).is_none() {
        return Ok(ParentApplyOutcome::NotApplicable);
    }
    validate_program_files_layout(request.layout, trusted_roots)?;
    validate_staging_boundary(request.state_dir, request.staging_root, request.layout)?;
    let classified = classify_overlay_pairs(request.layout, request.overlay_pairs)?;
    validate_install_write_surface(request.layout, &classified, trusted_roots)?;
    let prepared = prepare_parent_plan(
        &request,
        language,
        current_exe,
        &runtime_sources,
        classified,
        &mut build_transition,
    )?;

    if matches!(prepared.plan.qpa_transition, QpaTransitionPlan::Noop(_))
        && verify_payload_postconditions(&prepared.payloads).is_ok()
    {
        verify_qpa(request.layout, language, &prepared.plan.qpa_transition)
            .map_err(|error| cleanup_rejected(request.staging_root, &prepared.directory, error))?;
        let staging_cleanup_warning =
            cleanup_directory(request.staging_root, &prepared.directory).err();
        return Ok(ParentApplyOutcome::Applied {
            worker_cleanup_residual: false,
            staging_cleanup_warning,
        });
    }

    let serialized = serialize_plan(&prepared.plan, &prepared.plan_path).map_err(|error| {
        cleanup_rejected(request.staging_root, &prepared.directory, error.to_string())
    })?;
    write_new_file(&prepared.plan_path, &serialized.bytes)
        .map_err(|error| cleanup_rejected(request.staging_root, &prepared.directory, error))?;
    let transport = WorkerTransport::for_serialized_plan(
        prepared.plan_path.clone(),
        &prepared.plan,
        &serialized,
    )
    .map_err(|error| {
        cleanup_rejected(request.staging_root, &prepared.directory, error.to_string())
    })?;
    let token = transport.encode().map_err(|error| {
        cleanup_rejected(request.staging_root, &prepared.directory, error.to_string())
    })?;

    let exit_code = match launch(current_exe, &token) {
        Ok(code) => code,
        Err(LaunchError::Cancelled(code)) => {
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            return Err(ParentApplyError::PermissionRequired {
                code,
                staging_cleanup_warning,
            });
        }
        Err(error) if error.failure_phase() == LaunchFailurePhase::PostLaunchUncertain => {
            return Err(ParentApplyError::WorkerStateUncertain {
                staging_cleanup_warning: Some(format!(
                    "Elevated staging was retained at {} because worker completion could not be proven: {error}",
                    prepared.directory.display()
                )),
            });
        }
        Err(error) => {
            return Err(cleanup_rejected(
                request.staging_root,
                &prepared.directory,
                error.to_string(),
            ));
        }
    };

    match exit_code {
        WORKER_EXIT_COMMITTED_CLEAN | WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL => {
            if let Err(error) = verify_payload_postconditions(&prepared.payloads)
                .and_then(|_| verify_qpa(request.layout, language, &prepared.plan.qpa_transition))
            {
                return Err(cleanup_rejected(
                    request.staging_root,
                    &prepared.directory,
                    error,
                ));
            }
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            Ok(ParentApplyOutcome::Applied {
                worker_cleanup_residual: exit_code == WORKER_EXIT_COMMITTED_WITH_CLEANUP_RESIDUAL,
                staging_cleanup_warning,
            })
        }
        WORKER_EXIT_ROLLED_BACK_OR_ZERO_MUTATION_CLEAN => {
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            Err(ParentApplyError::WorkerRolledBack {
                staging_cleanup_warning,
            })
        }
        WORKER_EXIT_CAVALRY_STILL_RUNNING => {
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            Err(ParentApplyError::CavalryStillRunning {
                staging_cleanup_warning,
            })
        }
        WORKER_EXIT_STATE_OR_CLEANUP_UNCERTAIN => {
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            Err(ParentApplyError::WorkerStateUncertain {
                staging_cleanup_warning,
            })
        }
        code => {
            let staging_cleanup_warning =
                cleanup_directory(request.staging_root, &prepared.directory).err();
            Err(ParentApplyError::UnexpectedWorkerExit {
                code,
                staging_cleanup_warning,
            })
        }
    }
}

fn prepare_parent_plan<B>(
    request: &ParentApplyRequest<'_>,
    language: Language,
    current_exe: &Path,
    runtime_sources: &RuntimeSources,
    classified: Vec<ClassifiedPair>,
    build_transition: &mut B,
) -> Result<PreparedParentPlan, ParentApplyError>
where
    B: FnMut(
        Language,
        &InstallLayout,
        &str,
        &Path,
        Option<&Path>,
    ) -> Result<QpaTransitionPlan, String>,
{
    let worker_hash = sha256_file(current_exe).map_err(rejected)?;
    let nonce = next_plan_nonce(current_exe, request.staging_root, &worker_hash);
    let directory = request
        .staging_root
        .join(format!("elevated-language-{nonce}"));
    let payload_directory = directory.join("payloads");
    fs::create_dir_all(&payload_directory).map_err(|error| {
        rejected(format!(
            "Could not create elevated language staging directory {}: {error}",
            payload_directory.display()
        ))
    })?;
    let plan_path = directory.join(PLAN_FILE_NAME);

    let result = (|| {
        let mut payloads = Vec::with_capacity(classified.len() + 4);
        let marker_preimage = snapshot_hash(&request.layout.language_marker)?;
        stage_bytes_payload(
            &plan_path,
            &mut payloads,
            PENDING_MARKER_ID,
            PayloadKind::PendingMarker,
            PENDING_MARKER_BYTES,
            Some(request.layout.language_marker.clone()),
            marker_preimage,
        )?;
        for pair in classified {
            let preimage = snapshot_hash(&pair.destination)?;
            stage_file_payload(
                &plan_path,
                &mut payloads,
                &pair.id,
                pair.kind,
                &pair.source,
                Some(pair.destination),
                preimage,
            )?;
        }

        let mut staged_generic = None;
        let mut staged_proxy = None;
        if language != Language::English {
            let generic = runtime_sources.generic.as_path();
            let generic_destination = request.layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH);
            let generic_preimage = snapshot_hash(&generic_destination)?;
            staged_generic = Some(stage_file_payload(
                &plan_path,
                &mut payloads,
                GENERIC_PLUGIN_ID,
                PayloadKind::GenericPlugin,
                generic,
                Some(generic_destination),
                generic_preimage,
            )?);
            staged_proxy = Some(stage_file_payload(
                &plan_path,
                &mut payloads,
                QPA_PROXY_SOURCE_ID,
                PayloadKind::QpaProxySource,
                &runtime_sources.proxy,
                None,
                None,
            )?);
        }

        let final_bytes = format!("{}\n", language.as_str()).into_bytes();
        stage_bytes_payload(
            &plan_path,
            &mut payloads,
            FINAL_MARKER_ID,
            PayloadKind::FinalMarker,
            &final_bytes,
            Some(request.layout.language_marker.clone()),
            Some(hex_digest(PENDING_MARKER_BYTES)),
        )?;

        let proxy_for_plan = staged_proxy
            .as_deref()
            .unwrap_or(runtime_sources.proxy.as_path());
        let transition = build_transition(
            language,
            request.layout,
            request.cavalry_version,
            proxy_for_plan,
            staged_generic
                .as_deref()
                .or(Some(runtime_sources.generic.as_path())),
        )?;
        let plan = ElevatedLanguagePlan {
            schema_version: PLAN_SCHEMA_VERSION,
            install_root: request.layout.root.to_string_lossy().to_string(),
            language,
            nonce,
            expected_worker_exe_sha256: worker_hash,
            payloads: payloads
                .iter()
                .map(|payload| payload.record.clone())
                .collect(),
            qpa_transition: transition,
        };
        Ok(PreparedParentPlan {
            directory: directory.clone(),
            plan_path,
            plan,
            payloads,
        })
    })();

    result.map_err(|error: String| cleanup_rejected(request.staging_root, &directory, error))
}

fn build_qpa_transition(
    language: Language,
    layout: &InstallLayout,
    cavalry_version: &str,
    proxy_source: &Path,
    generic_source: Option<&Path>,
) -> Result<QpaTransitionPlan, String> {
    if language == Language::English {
        return windows_qpa::build_english_transition(RestoreRequest {
            layout,
            proxy_source,
            generic_source: generic_source.ok_or_else(|| {
                "English QPA cleanup is missing its trusted generic source.".to_string()
            })?,
            reason: RestoreReason::EnglishSelection,
        });
    }
    let generic_source = generic_source.ok_or_else(|| {
        "Translated QPA activation is missing its staged generic source.".to_string()
    })?;
    windows_qpa::build_activation_plan_with_generic_source(
        ActivationRequest {
            layout,
            cavalry_version,
            proxy_source,
        },
        generic_source,
    )
    .map(QpaTransitionPlan::Activate)
}

fn verify_qpa_postcondition(
    layout: &InstallLayout,
    language: Language,
    transition: &QpaTransitionPlan,
) -> Result<(), String> {
    let inspection = windows_qpa::inspect(layout)?;
    match (language, transition) {
        (Language::English, QpaTransitionPlan::Noop(plan))
            if plan.reason == QpaNoopReason::VendorUpdatePreserved =>
        {
            Err("An unrecognized vendor qwindows.dll was preserved; refusing to report a proven English runtime.".to_string())
        }
        (Language::English, _) if inspection.state == QpaDeploymentState::Stock => Ok(()),
        (Language::English, _) => Err(format!(
            "English selection did not leave the vendor QPA active: {}",
            inspection.detail
        )),
        (_, QpaTransitionPlan::Activate(_)) if inspection.state == QpaDeploymentState::Active => {
            Ok(())
        }
        (_, _) => Err(format!(
            "Translated selection did not leave the QPA proxy ACTIVE: {}",
            inspection.detail
        )),
    }
}

fn verify_payload_postconditions(payloads: &[StagedPayload]) -> Result<(), String> {
    for payload in payloads {
        if matches!(
            payload.record.kind,
            PayloadKind::PendingMarker | PayloadKind::QpaProxySource
        ) {
            continue;
        }
        let destination = payload.destination.as_deref().ok_or_else(|| {
            format!(
                "Committed payload has no derived destination: {}",
                payload.record.id
            )
        })?;
        let installed = snapshot_hash(destination)?;
        if installed.as_deref() != Some(payload.record.source_sha256.as_str()) {
            return Err(format!(
                "Elevated language postcondition failed for {} at {}.",
                payload.record.id,
                destination.display()
            ));
        }
    }
    Ok(())
}

fn validate_program_files_layout(
    layout: &InstallLayout,
    trusted_roots: &[PathBuf],
) -> Result<(), ParentApplyError> {
    let trusted_root =
        trusted_root_for_destination(&layout.root, trusted_roots).ok_or_else(|| {
            rejected(format!(
                "Cavalry root is outside OS-known Program Files: {}",
                layout.root.display()
            ))
        })?;
    ensure_no_reparse_points(trusted_root, &layout.root).map_err(rejected)?;
    let metadata = fs::symlink_metadata(&layout.root).map_err(|error| {
        rejected(format!(
            "Could not inspect Cavalry install root {}: {error}",
            layout.root.display()
        ))
    })?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(rejected(format!(
            "Cavalry install root must be an ordinary Program Files directory: {}",
            layout.root.display()
        )));
    }
    layout.validate().map_err(rejected)
}

fn validate_install_write_surface(
    layout: &InstallLayout,
    classified: &[ClassifiedPair],
    trusted_roots: &[PathBuf],
) -> Result<(), ParentApplyError> {
    let trusted_root = trusted_root_for_destination(&layout.root, trusted_roots)
        .ok_or_else(|| rejected("Cavalry root left OS-known Program Files before staging."))?;
    let mut destinations = classified
        .iter()
        .map(|pair| pair.destination.as_path())
        .collect::<Vec<_>>();
    destinations.push(&layout.language_marker);
    let generic = layout.root.join(GENERIC_PLUGIN_RELATIVE_PATH);
    destinations.push(&generic);
    let qpa_surface = windows_qpa::managed_write_surface(layout);
    destinations.extend(qpa_surface.iter().map(PathBuf::as_path));
    for destination in destinations {
        ensure_no_reparse_points(trusted_root, destination).map_err(rejected)?;
    }
    Ok(())
}

fn validate_staging_boundary(
    state_dir: &Path,
    staging_root: &Path,
    layout: &InstallLayout,
) -> Result<(), ParentApplyError> {
    let staging = absolute_lexical(staging_root)?;
    let state = absolute_lexical(state_dir)?;
    let temp = absolute_lexical(&std::env::temp_dir())?;
    if path_is_within(&staging, &layout.root) {
        return Err(rejected(
            "Elevated language staging must not be inside the Cavalry install root.",
        ));
    }
    if !path_is_within(&staging, &state) && !path_is_within(&staging, &temp) {
        return Err(rejected(format!(
            "Elevated language staging must stay under the app state or temporary directory: {}",
            staging.display()
        )));
    }
    let allowed_root = if path_is_within(&staging, &state) {
        &state
    } else {
        &temp
    };
    ensure_no_reparse_points(allowed_root, &staging).map_err(rejected)?;
    if !staging.exists() {
        fs::create_dir(&staging).map_err(|error| {
            rejected(format!(
                "Could not create elevated staging root {}: {error}",
                staging.display()
            ))
        })?;
    }
    let metadata = fs::symlink_metadata(&staging).map_err(|error| {
        rejected(format!(
            "Could not inspect elevated staging root {}: {error}",
            staging.display()
        ))
    })?;
    if !metadata.is_dir() || metadata_is_reparse_point(&metadata) {
        return Err(rejected(format!(
            "Elevated staging root must be an ordinary directory: {}",
            staging.display()
        )));
    }
    Ok(())
}

fn parse_language(language: &str) -> Result<Language, ParentApplyError> {
    match language {
        "en" => Ok(Language::English),
        "zh-Hans" => Ok(Language::SimplifiedChinese),
        "zh-Hant" => Ok(Language::TraditionalChinese),
        "ja_JP" => Ok(Language::Japanese),
        _ => Err(rejected(format!(
            "Unsupported Windows elevated language: {language}"
        ))),
    }
}

fn next_plan_nonce(current_exe: &Path, staging_root: &Path, worker_hash: &str) -> String {
    let sequence = PLAN_NONCE_COUNTER.fetch_add(1, Ordering::Relaxed);
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_nanos();
    let material = format!(
        "{}|{}|{}|{}|{}|{}",
        std::process::id(),
        timestamp,
        sequence,
        current_exe.display(),
        staging_root.display(),
        worker_hash
    );
    hex_digest(material.as_bytes())
}

fn absolute_lexical(path: &Path) -> Result<PathBuf, ParentApplyError> {
    let path = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| rejected(error.to_string()))?
            .join(path)
    };
    Ok(path)
}

fn cleanup_rejected(
    staging_root: &Path,
    path: &Path,
    message: impl Into<String>,
) -> ParentApplyError {
    let message = message.into();
    match cleanup_directory(staging_root, path) {
        Ok(()) => rejected(message),
        Err(cleanup) => rejected(format!("{message} {cleanup}")),
    }
}

fn rejected(message: impl Into<String>) -> ParentApplyError {
    ParentApplyError::Rejected(message.into())
}

fn finalize_outer_cleanup(
    result: Result<ParentApplyOutcome, ParentApplyError>,
    request: &ParentApplyRequest<'_>,
) -> Result<ParentApplyOutcome, ParentApplyError> {
    if matches!(result, Ok(ParentApplyOutcome::NotApplicable)) {
        return result;
    }
    let overlay_sources = request
        .overlay_pairs
        .iter()
        .map(|pair| pair.src.clone())
        .collect::<Vec<_>>();
    let warning =
        cleanup_outer_staging(request.staging_root, &overlay_sources, request.language).err();
    match result {
        Ok(ParentApplyOutcome::Applied {
            worker_cleanup_residual,
            staging_cleanup_warning,
        }) => Ok(ParentApplyOutcome::Applied {
            worker_cleanup_residual,
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::PermissionRequired {
            code,
            staging_cleanup_warning,
        }) => Err(ParentApplyError::PermissionRequired {
            code,
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::WorkerRolledBack {
            staging_cleanup_warning,
        }) => Err(ParentApplyError::WorkerRolledBack {
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::CavalryStillRunning {
            staging_cleanup_warning,
        }) => Err(ParentApplyError::CavalryStillRunning {
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::WorkerStateUncertain {
            staging_cleanup_warning,
        }) => Err(ParentApplyError::WorkerStateUncertain {
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::UnexpectedWorkerExit {
            code,
            staging_cleanup_warning,
        }) => Err(ParentApplyError::UnexpectedWorkerExit {
            code,
            staging_cleanup_warning: merge_warnings(staging_cleanup_warning, warning),
        }),
        Err(ParentApplyError::Rejected(message)) => Err(ParentApplyError::Rejected(
            merge_warnings(Some(message), warning).unwrap_or_default(),
        )),
        Ok(ParentApplyOutcome::NotApplicable) => Ok(ParentApplyOutcome::NotApplicable),
    }
}

fn merge_warnings(left: Option<String>, right: Option<String>) -> Option<String> {
    match (left, right) {
        (Some(left), Some(right)) => Some(format!("{left} {right}")),
        (Some(value), None) | (None, Some(value)) => Some(value),
        (None, None) => None,
    }
}

fn write_with_cleanup(
    formatter: &mut fmt::Formatter<'_>,
    message: impl AsRef<str>,
    cleanup: &Option<String>,
) -> fmt::Result {
    formatter.write_str(message.as_ref())?;
    if let Some(cleanup) = cleanup {
        write!(formatter, " {cleanup}")?;
    }
    Ok(())
}

#[cfg(test)]
#[path = "parent_tests.rs"]
mod tests;
