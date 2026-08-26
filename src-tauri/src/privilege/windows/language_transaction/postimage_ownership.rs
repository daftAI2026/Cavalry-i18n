/**
 * [INPUT]: 依赖 storage journal entry、统一路径/摘要准入及 Applying phase 持久化。
 * [OUTPUT]: 提供首次外部写入前的逐目标精确 postimage 所有权登记，并以单次 durable manifest 更新提交。
 * [POS]: language_transaction/storage 的外部状态机所有权适配层；不采样写后状态、不执行目标文件变更。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
use std::path::PathBuf;

use super::{snapshot_hash, DurableJournal, StorageError};
use crate::privilege::windows::language_transaction::{
    journal_manifest::JournalPhase,
    path_validation::{validate_destination, validate_optional_hash},
};

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ResolvedPostimage {
    pub(crate) destination: PathBuf,
    pub(crate) expected_sha256: Option<String>,
}

impl DurableJournal {
    pub(crate) fn record_expected_postimages(
        &mut self,
        postimages: &[ResolvedPostimage],
    ) -> Result<(), StorageError> {
        for postimage in postimages {
            validate_destination(&self.install_root, &postimage.destination)?;
            validate_optional_hash(
                postimage.expected_sha256.as_deref(),
                "expected transaction postimage",
            )?;
            self.entry_index(&postimage.destination)?;
        }
        for postimage in postimages {
            let index = self.entry_index(&postimage.destination)?;
            self.entries[index]
                .owned_postimages
                .insert(postimage.expected_sha256.clone());
        }
        self.persist_manifest(JournalPhase::Applying)
            .map_err(StorageError::new)
    }

    pub(crate) fn verify_expected_postimages(&self, paths: &[PathBuf]) -> Result<(), StorageError> {
        for path in paths {
            validate_destination(&self.install_root, path)?;
            let index = self.entry_index(path)?;
            let observed = snapshot_hash(path)?;
            if !self.entries[index].owned_postimages.contains(&observed) {
                return Err(StorageError::new(format!(
                    "QPA postimage was not declared before mutation: {}",
                    path.display()
                )));
            }
        }
        Ok(())
    }
}
