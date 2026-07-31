/**
 * [INPUT]: 依赖 Adjacent write-once ready/ack/done schema、三语 oracle、producer PNG 与 GuardedTempRoot
 * [OUTPUT]: 在父测试模块内提供 Tag/Assets 双逻辑点、三截图的身份/动态 stem/像素封存与 done 终态验证
 * [POS]: src-tauri/tests/support 的 Adjacent 协议分片；消费 acceptance-only plugin 证据，不承载产品运行时代码
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
    fn adjacent_oracle(language: &str, key: &str, stem: &str) -> Option<String> {
        let value = match (language, key) {
            ("zh-Hans", "tagAdd") => "添加标签：".to_string(),
            ("zh-Hans", "tagAssign") => "为所选内容分配标签：".to_string(),
            ("zh-Hans", "replace") => "替换…".to_string(),
            ("zh-Hans", "create") => format!("基于 {stem} 创建合成"),
            ("zh-Hans", "createTemplate") => "基于 %1 创建合成".to_string(),
            ("zh-Hant", "tagAdd") => "新增標籤：".to_string(),
            ("zh-Hant", "tagAssign") => "為所選內容分配標籤：".to_string(),
            ("zh-Hant", "replace") => "取代…".to_string(),
            ("zh-Hant", "create") => format!("根據 {stem} 建立合成"),
            ("zh-Hant", "createTemplate") => "根據 %1 建立合成".to_string(),
            ("ja_JP", "tagAdd") => "タグを追加：".to_string(),
            ("ja_JP", "tagAssign") => "選択範囲にタグを割り当て：".to_string(),
            ("ja_JP", "replace") => "置換…".to_string(),
            ("ja_JP", "create") => format!("{stem} を基にコンポジションを作成"),
            ("ja_JP", "createTemplate") => "%1 を基にコンポジションを作成".to_string(),
            _ => return None,
        };
        Some(value)
    }

    fn wait_for_adjacent_ready(
        evidence_root: &GuardedTempRoot,
        acceptance_directory: &Path,
        language: &str,
        process_id: u32,
        sequence: usize,
        surface: &str,
    ) -> Result<AdjacentCaptureReady, String> {
        let ready_path = acceptance_directory.join(format!("{sequence:02}-{surface}.ready.json"));
        evidence_root.assert_write_target(&ready_path)?;
        let deadline = Instant::now() + Duration::from_millis(PROCESS_TIMEOUT_MILLISECONDS.into());
        let (_wait_sender, wait_receiver) = mpsc::channel::<()>();
        while Instant::now() < deadline {
            let done_path = acceptance_directory.join("done.json");
            if let Ok(payload) = fs::read_to_string(&done_path) {
                let done = serde_json::from_str::<AdjacentDone>(&payload).map_err(|error| {
                    format!(
                        "invalid early Adjacent done JSON {}: {error}: {payload}",
                        done_path.display()
                    )
                })?;
                if done.status == "ERROR" {
                    return Err(format!(
                        "Adjacent runtime failed before capture {sequence}/{surface}: {}",
                        done.reason
                    ));
                }
            }
            if let Ok(payload) = fs::read_to_string(&ready_path) {
                let ready =
                    serde_json::from_str::<AdjacentCaptureReady>(&payload).map_err(|error| {
                        format!(
                            "invalid Adjacent capture-ready JSON {}: {error}: {payload}",
                            ready_path.display()
                        )
                    })?;
                if ready.schema != "cavalry-i18n.windows-adjacent.capture-ready/v1"
                    || ready.language != language
                    || ready.pid != process_id
                    || ready.sequence != sequence
                    || ready.surface != surface
                    || ready.target.window_handle == "0"
                    || ready
                        .target
                        .window_handle
                        .parse::<u64>()
                        .ok()
                        .filter(|value| *value != 0)
                        .is_none()
                {
                    return Err(format!(
                        "Adjacent capture-ready identity mismatch: {payload}"
                    ));
                }
                return Ok(ready);
            }
            let _ = wait_receiver.recv_timeout(Duration::from_millis(50));
        }
        Err(format!(
            "timed out waiting for Adjacent capture-ready {sequence}/{surface}"
        ))
    }

    fn acknowledge_adjacent_capture(
        evidence_root: &GuardedTempRoot,
        acceptance_directory: &Path,
        ready: &AdjacentCaptureReady,
    ) -> Result<(), String> {
        let acknowledgement =
            acceptance_directory.join(format!("{:02}-{}.ack.json", ready.sequence, ready.surface));
        let temporary = acceptance_directory.join(format!(
            ".{:02}-{}.ack.tmp-{}",
            ready.sequence,
            ready.surface,
            std::process::id()
        ));
        evidence_root.assert_write_target(&acknowledgement)?;
        evidence_root.assert_write_target(&temporary)?;
        let payload = serde_json::json!({
            "schema": "cavalry-i18n.windows-adjacent.capture-ack/v1",
            "status": "CAPTURED",
            "language": ready.language,
            "pid": ready.pid,
            "sequence": ready.sequence,
            "surface": ready.surface,
        });
        let mut file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| {
                format!(
                    "could not create Adjacent acknowledgement temp {}: {error}",
                    temporary.display()
                )
            })?;
        file.write_all(format!("{payload}\n").as_bytes())
            .map_err(|error| {
                format!(
                    "could not write Adjacent acknowledgement {}: {error}",
                    temporary.display()
                )
            })?;
        file.sync_all().map_err(|error| {
            format!(
                "could not flush Adjacent acknowledgement temp {}: {error}",
                temporary.display()
            )
        })?;
        drop(file);
        fs::rename(&temporary, &acknowledgement).map_err(|error| {
            format!(
                "could not atomically publish Adjacent acknowledgement {} -> {}: {error}",
                temporary.display(),
                acknowledgement.display()
            )
        })
    }

    fn wait_for_adjacent_done(
        evidence_root: &GuardedTempRoot,
        acceptance_directory: &Path,
        language: &str,
        process_id: u32,
    ) -> Result<AdjacentDone, String> {
        let done_path = acceptance_directory.join("done.json");
        evidence_root.assert_write_target(&done_path)?;
        let deadline = Instant::now() + Duration::from_millis(PROCESS_TIMEOUT_MILLISECONDS.into());
        let (_wait_sender, wait_receiver) = mpsc::channel::<()>();
        while Instant::now() < deadline {
            if let Ok(payload) = fs::read_to_string(&done_path) {
                let done = serde_json::from_str::<AdjacentDone>(&payload).map_err(|error| {
                    format!(
                        "invalid Adjacent done JSON {}: {error}: {payload}",
                        done_path.display()
                    )
                })?;
                if done.status == "ERROR" {
                    return Err(format!(
                        "Adjacent runtime rejected the live gate: {}",
                        done.reason
                    ));
                }
                if done.schema != "cavalry-i18n.windows-adjacent.done/v1"
                    || done.status != "OK"
                    || done.language != language
                    || done.pid != process_id
                    || done.logical_result_count != 2
                    || done.capture_count != 3
                    || done.logical_results.len() != 2
                    || done.captures.len() != 3
                    || done.logical_results[0]["surface"] != "tag"
                    || done.logical_results[0]["owner"] != "cavalry::TagHeader"
                    || done.logical_results[0]["producerResult"] != "PopOverView"
                    || done.logical_results[0]["ownerExternalUnchanged"] != true
                    || done.logical_results[1]["surface"] != "assets"
                    || done.logical_results[1]["owner"] != "assets::Window"
                    || done.logical_results[1]["ownerExternalUnchanged"] != true
                {
                    return Err(format!(
                        "Adjacent terminal completeness/identity mismatch: {payload}"
                    ));
                }
                let expected_stem_prefixes = ["replace-source-", "dynamic-proof-two-"];
                let variants = done.logical_results[1]["variants"]
                    .as_array()
                    .ok_or_else(|| format!("Adjacent Assets variants are missing: {payload}"))?;
                if variants.len() != expected_stem_prefixes.len() {
                    return Err(format!(
                        "Adjacent Assets dual-stem completeness mismatch: {payload}"
                    ));
                }
                for (variant, stem_prefix) in variants.iter().zip(expected_stem_prefixes) {
                    let stem = variant["stem"]
                        .as_str()
                        .filter(|stem| stem.starts_with(stem_prefix))
                        .ok_or_else(|| {
                            format!(
                                "Adjacent Assets fixture stem lacks run nonce prefix {stem_prefix}: {payload}"
                            )
                        })?;
                    let expected_replace =
                        adjacent_oracle(language, "replace", stem).expect("known language");
                    let expected_create =
                        adjacent_oracle(language, "create", stem).expect("known language");
                    if variant["beforeExactVisibleRows"] != 0
                        || variant["afterExactVisibleRows"] != 1
                        || variant["dropDelivered"] != true
                        || variant["dropAccepted"] != true
                        || variant["contextDelivered"] != true
                        || variant["contextAccepted"] != true
                        || variant["producerOwnerClass"] != "assets::Window"
                        || variant["replaceObserved"] != expected_replace
                        || variant["createObserved"] != expected_create
                    {
                        return Err(format!(
                            "Adjacent Assets real producer postcondition mismatch stem={stem}: {payload}"
                        ));
                    }
                }
                return Ok(done);
            }
            let _ = wait_receiver.recv_timeout(Duration::from_millis(50));
        }
        Err("timed out waiting for Adjacent terminal result".to_string())
    }

    fn accept_adjacent_driver_capture(
        evidence_root: &GuardedTempRoot,
        acceptance_directory: &Path,
        ready: &AdjacentCaptureReady,
        output: &Path,
        language: &str,
        scenario: &str,
        interaction_evidence: String,
    ) -> Result<ScreenshotEvidence, String> {
        let source = PathBuf::from(&ready.target.capture_path);
        evidence_root.assert_write_target(&source)?;
        evidence_root.assert_write_target(output)?;
        if ready.target.capture_method
            != "qt-widget-grab-exact-producer+pid-hwnd-anchor"
            || ready
                .target
                .window_handle
                .parse::<u64>()
                .ok()
                .filter(|value| *value != 0)
                .is_none()
            || !source.is_file()
            || !fs::symlink_metadata(&source)
                .map_err(|error| {
                    format!(
                        "could not inspect Adjacent producer PNG {}: {error}",
                        source.display()
                    )
                })?
                .file_type()
                .is_file()
            || source
                .parent()
                .is_none_or(|parent| !path_is_same(parent, acceptance_directory))
            || output.exists()
        {
            return Err(format!(
                "Adjacent producer PNG identity is invalid: target={:?} output={}",
                ready.target,
                output.display()
            ));
        }
        let png = fs::read(&source).map_err(|error| {
            format!(
                "could not read Adjacent producer PNG {}: {error}",
                source.display()
            )
        })?;
        if png.len() < 24 || !png.starts_with(PNG_SIGNATURE) || &png[12..16] != b"IHDR" {
            return Err(format!(
                "Adjacent producer evidence is not a valid PNG header: {}",
                source.display()
            ));
        }
        let width = u32::from_be_bytes(png[16..20].try_into().expect("four width bytes"));
        let height = u32::from_be_bytes(png[20..24].try_into().expect("four height bytes"));
        if width == 0 || height == 0 {
            return Err(format!(
                "Adjacent producer PNG has empty dimensions: {}",
                source.display()
            ));
        }
        let mut output_file = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(output)
            .map_err(|error| {
                format!(
                    "could not create sealed Adjacent PNG {}: {error}",
                    output.display()
                )
            })?;
        output_file.write_all(&png).map_err(|error| {
            format!(
                "could not seal Adjacent producer PNG bytes into {}: {error}",
                output.display()
            )
        })?;
        output_file.sync_all().map_err(|error| {
            format!(
                "could not flush sealed Adjacent PNG {}: {error}",
                output.display()
            )
        })?;
        drop(output_file);
        let sealed = fs::read(output).map_err(|error| {
            format!(
                "could not read sealed Adjacent PNG {}: {error}",
                output.display()
            )
        })?;
        if sealed != png {
            return Err(format!(
                "sealed Adjacent PNG differs from producer bytes: {}",
                output.display()
            ));
        }
        Ok(ScreenshotEvidence {
            language: language.to_string(),
            scenario: scenario.to_string(),
            path: output.to_path_buf(),
            sha256: format!("{:x}", Sha256::digest(&sealed)),
            width,
            height,
            interaction_evidence,
        })
    }

    fn capture_adjacent_producers(
        evidence_root: &GuardedTempRoot,
        run_root: &Path,
        process_id: u32,
        acceptance_directory: &Path,
        language: &str,
    ) -> Result<Vec<ScreenshotEvidence>, String> {
        let expected = [
            (1usize, "tag-add-assign", "AdjacentTag", ""),
            (
                2usize,
                "assets-replace-source",
                "AdjacentAssetsReplaceSource",
                "replace-source",
            ),
            (
                3usize,
                "assets-dynamic-proof-two",
                "AdjacentAssetsDynamicProofTwo",
                "dynamic-proof-two",
            ),
        ];
        let mut evidence = Vec::with_capacity(expected.len());
        for (sequence, surface, scenario, stem) in expected {
            let ready = wait_for_adjacent_ready(
                evidence_root,
                acceptance_directory,
                language,
                process_id,
                sequence,
                surface,
            )?;
            let logical_surface = ready.result["logicalSurface"].as_str();
            let observed = ready.result["observedTexts"]
                .as_array()
                .ok_or_else(|| format!("Adjacent observedTexts are missing: {:?}", ready.result))?;
            let expected_texts = if sequence == 1 {
                vec![
                    adjacent_oracle(language, "tagAdd", "").expect("known language"),
                    adjacent_oracle(language, "tagAssign", "").expect("known language"),
                ]
            } else {
                let actual_stem = ready.result["fixtureStem"]
                    .as_str()
                    .filter(|value| value.starts_with(&format!("{stem}-")))
                    .ok_or_else(|| {
                        format!(
                            "Adjacent fixture stem lacks unique {stem}- prefix: {:?}",
                            ready.result
                        )
                    })?;
                vec![
                    adjacent_oracle(language, "replace", actual_stem).expect("known language"),
                    adjacent_oracle(language, "create", actual_stem).expect("known language"),
                ]
            };
            if observed
                != &expected_texts
                    .iter()
                    .cloned()
                    .map(serde_json::Value::String)
                    .collect::<Vec<_>>()
                || (sequence == 1
                    && (logical_surface != Some("tag")
                        || ready.target.widget_class != "PopOverView"
                        || ready.result["ownerClass"] != "PopOverView"
                        || ready.result["producerClass"] != "cavalry::TagHeader"
                        || ready.result["ownerExternalUnchanged"] != true))
                || (sequence > 1
                    && (logical_surface != Some("assets")
                        || ready.target.widget_class != "ContextMenu"
                        || ready.result["ownerClass"] != "assets::Window"
                        || !ready.result["fixtureStem"]
                            .as_str()
                            .is_some_and(|value| value.starts_with(&format!("{stem}-")))
                        || ready.result["ownerExternalUnchanged"] != true
                        || ready.result["dropDelivered"] != true
                        || ready.result["dropAccepted"] != true))
            {
                return Err(format!(
                    "Adjacent producer ready postcondition mismatch: {:?}",
                    ready.result
                ));
            }
            let output = run_root.join(format!("{language}-{surface}.png"));
            let screenshot = accept_adjacent_driver_capture(
                evidence_root,
                acceptance_directory,
                &ready,
                &output,
                language,
                scenario,
                format!(
                "logical={};surface={surface};sequence={sequence}/3;stem={stem};observed={};qt-semantics=TagHeader/PopOverView-or-QDropEvent/ContextMenu;capture=qt-widget-grab-exact-producer+pid-hwnd-anchor;path-pixels=manual-review-required",
                    logical_surface.unwrap_or("<missing>"),
                    expected_texts.join("|")
                ),
            );
            evidence.push(screenshot?);
            acknowledge_adjacent_capture(evidence_root, acceptance_directory, &ready)?;
        }
        wait_for_adjacent_done(evidence_root, acceptance_directory, language, process_id)?;
        Ok(evidence)
    }
