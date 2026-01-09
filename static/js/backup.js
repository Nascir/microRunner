let currentBackupProject = null;

function openBackupModal(projectSlug) {
  currentBackupProject = projectSlug;
  document.getElementById('backup-modal').style.display = 'flex';
  loadBackupList();
}

function closeBackupModal() {
  document.getElementById('backup-modal').style.display = 'none';
  currentBackupProject = null;
}

document.getElementById('backup-modal').addEventListener('click', function(e) {
  if (e.target === this) closeBackupModal();
});

async function loadBackupList() {
  if (!currentBackupProject) return;

  const listEl = document.getElementById('backup-list');
  listEl.innerHTML = '<div class="loading">Loading backups...</div>';

  try {
    const res = await fetch(`/api/project/${currentBackupProject}/backups`);
    const backups = await res.json();

    if (backups.length === 0) {
      listEl.innerHTML = '<div class="empty-backups">No backups found. Create your first backup!</div>';
      return;
    }

    listEl.innerHTML = backups.map(backup => {
      const date = new Date(backup.created);
      const dateStr = date.toLocaleDateString();
      const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const sizeKB = (backup.size / 1024).toFixed(1);

      return `
        <div class="backup-item" data-file="${backup.fileName}">
          <div class="backup-info">
            <div class="backup-name">${backup.fileName}</div>
            <div class="backup-meta">
              <span class="backup-meta-item"><i class="far fa-calendar-alt"></i> ${dateStr}</span>
              <span class="backup-meta-item"><i class="far fa-clock"></i> ${timeStr}</span>
              <span class="backup-meta-item"><i class="fa fa-database"></i> ${sizeKB} KB</span>
            </div>
          </div>
          <div class="backup-actions-row">
            <button class="btn-icon note-indicator" onclick="toggleBackupNote('${backup.fileName}', this)" title="View/Edit Note">
              <i class="fa fa-sticky-note-o"></i>
            </button>
            <button class="btn-icon expand-btn" onclick="toggleBackupNote('${backup.fileName}', this)" title="Expand">
              <i class="fa fa-chevron-down"></i>
            </button>
            <button class="btn-icon" onclick="downloadBackup('${backup.fileName}')" title="Download">
              <i class="fa fa-download"></i>
            </button>
            <button class="btn-icon" onclick="confirmRestore('${backup.fileName}')" title="Restore">
              <i class="fa fa-undo"></i>
            </button>
            <button class="btn-icon danger" onclick="confirmDeleteBackup('${backup.fileName}')" title="Delete">
              <i class="fa fa-trash"></i>
            </button>
          </div>
          <div class="backup-note-section" style="display: none;">
            <textarea placeholder="Add a note to this backup..."></textarea>
            <div class="note-actions">
              <button class="btn btn-secondary btn-sm" onclick="clearBackupNote('${backup.fileName}', this.closest('.backup-note-section'))">
                <i class="fa fa-trash"></i> Clear
              </button>
              <button class="btn btn-primary btn-sm" onclick="saveBackupNote('${backup.fileName}', this.closest('.backup-note-section'))">
                <i class="fa fa-check"></i> Save
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  } catch (e) {
    listEl.innerHTML = '<div class="error">Failed to load backups</div>';
    console.error('Failed to load backups:', e);
  }
}

async function createBackup() {
  if (!currentBackupProject) return;

  const btn = document.getElementById('create-backup-btn');
  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Creating...';

  try {
    const res = await fetch(`/api/project/${currentBackupProject}/backup`, {
      method: 'POST'
    });

    const result = await res.json();

    if (result.success) {
      loadBackupList();
    } else {
      showError('Failed to create backup: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    showError('Failed to create backup: ' + e.message);
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

function downloadBackup(fileName) {
  const link = document.createElement('a');
  link.href = `/api/project/${currentBackupProject}/backups/${fileName}/download`;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function confirmDeleteBackup(fileName) {
  showDialog(
    'Delete Backup?',
    `Are you sure you want to delete backup "<strong>${fileName}</strong>"? This cannot be undone.`,
    'Cancel',
    'Delete',
    () => deleteBackup(fileName)
  );
}

async function deleteBackup(fileName) {
  try {
    const res = await fetch(`/api/project/${currentBackupProject}/backups/${fileName}`, {
      method: 'DELETE'
    });

    const result = await res.json();

    if (result.success) {
      loadBackupList();
    } else {
      showError('Failed to delete backup: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    showError('Failed to delete backup: ' + e.message);
  }
}

function confirmRestore(backupFileName) {
  const projectPath = `/projects/${currentBackupProject}`;
  const preRestoreName = `${currentBackupProject}_pre_restore_backup.zip`;

  showDialog(
    'Restore Backup?',
    `Current project at <code>${projectPath}</code> will be backed up to <code>archive/${currentBackupProject}/${preRestoreName}</code> before restoring from <code>${backupFileName}</code>. Continue?`,
    'Cancel',
    'Continue with Backup',
    () => restoreBackup(backupFileName)
  );
}

async function restoreBackup(backupFileName) {
  try {
    const res = await fetch(`/api/project/${currentBackupProject}/restore`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        backupFile: backupFileName,
        createPreRestoreBackup: true
      })
    });

    const result = await res.json();

    if (result.success) {
      closeBackupModal();
      if (typeof loadProjects === 'function') {
        loadProjects();
      }
      showNotification('Project restored successfully!', 'success');
    } else {
      showError('Failed to restore backup: ' + (result.error || 'Unknown error'));
    }
  } catch (e) {
    showError('Failed to restore backup: ' + e.message);
  }
}

function uploadBackupFromDisk(input) {
  const file = input.files[0];
  if (!file) return;

  if (!file.name.endsWith('.zip')) {
    showModal('Upload Error', 'Please select a ZIP file', 'error');
    input.value = '';
    return;
  }

  const btn = input.parentElement;
  const originalText = btn.innerHTML;
  btn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Uploading...';
  btn.disabled = true;

  const formData = new FormData();
  formData.append('file', file);

  fetch(`/api/project/${currentBackupProject}/backups/upload`, {
    method: 'POST',
    body: formData
  })
  .then(res => res.json())
  .then(result => {
    if (result.success) {
      input.value = '';
      loadBackupList();
      showModal('Backup Uploaded', `Backup "${result.fileName}" has been added to the list.`, 'success');
    } else {
      showModal('Upload Failed', result.error || 'Unknown error', 'error');
    }
  })
  .catch(e => {
    showModal('Upload Failed', e.message, 'error');
  })
  .finally(() => {
    btn.innerHTML = originalText;
    btn.disabled = false;
    input.value = '';
  });
}

function openBackupModalFromConfig() {
  if (currentProject && currentProject.slug) {
    closeConfigModal();
    setTimeout(() => openBackupModal(currentProject.slug), 100);
  }
}

function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fa ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
    ${message}
  `;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.add('fade-out');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function showError(message) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <div class="dialog-header">
        <h3><i class="fa fa-exclamation-circle"></i> Error</h3>
      </div>
      <div class="dialog-body">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-primary" id="dialog-ok">OK</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('dialog-ok').onclick = () => overlay.remove();
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

function showDialog(title, message, cancelText, confirmText, onConfirm) {
  const overlay = document.createElement('div');
  overlay.className = 'dialog-overlay';
  overlay.innerHTML = `
    <div class="dialog">
      <div class="dialog-header">
        <h3>${title}</h3>
      </div>
      <div class="dialog-body">
        <p>${message}</p>
      </div>
      <div class="dialog-footer">
        <button class="btn btn-secondary" id="dialog-cancel">${cancelText}</button>
        <button class="btn btn-primary" id="dialog-confirm">${confirmText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('dialog-cancel').onclick = () => {
    overlay.remove();
  };
  document.getElementById('dialog-confirm').onclick = () => {
    overlay.remove();
    onConfirm();
  };
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
}

async function toggleBackupNote(backupFileName, button) {
  const item = button.closest('.backup-item');
  const noteSection = item.querySelector('.backup-note-section');
  const isExpanded = noteSection.style.display === 'block';

  if (!isExpanded && !noteSection.dataset.loaded) {
    await loadBackupNote(backupFileName, noteSection);
    noteSection.dataset.loaded = 'true';
  }

  noteSection.style.display = isExpanded ? 'none' : 'block';
  button.closest('.backup-actions-row').querySelector('.expand-btn i').className = isExpanded ? 'fa fa-chevron-down' : 'fa fa-chevron-up';
}

async function loadBackupNote(backupFileName, noteSection) {
  try {
    const res = await fetch(`/api/project/${currentBackupProject}/backups/${backupFileName}/note`);
    const data = await res.json();
    noteSection.querySelector('textarea').value = data.note || '';
    noteSection.dataset.hasNote = data.note ? 'true' : 'false';
    updateNoteIndicator(noteSection);
  } catch (e) {
    console.error('Failed to load note:', e);
  }
}

async function saveBackupNote(backupFileName, noteSection) {
  const note = noteSection.querySelector('textarea').value;
  try {
    await fetch(`/api/project/${currentBackupProject}/backups/${backupFileName}/note`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    noteSection.dataset.hasNote = note ? 'true' : 'false';
    updateNoteIndicator(noteSection);
    showNotification('Note saved!', 'success');
  } catch (e) {
    showError('Failed to save note: ' + e.message);
  }
}

async function clearBackupNote(backupFileName, noteSection) {
  noteSection.querySelector('textarea').value = '';
  await saveBackupNote(backupFileName, noteSection);
}

function updateNoteIndicator(noteSection) {
  const indicator = noteSection.closest('.backup-item').querySelector('.note-indicator i');
  const hasNote = noteSection.dataset.hasNote === 'true';
  if (hasNote) {
    indicator.classList.remove('fa-sticky-note-o');
    indicator.classList.add('fa-sticky-note');
    indicator.parentElement.style.color = 'var(--color-accent)';
  } else {
    indicator.classList.remove('fa-sticky-note');
    indicator.classList.add('fa-sticky-note-o');
    indicator.parentElement.style.color = '';
  }
}
