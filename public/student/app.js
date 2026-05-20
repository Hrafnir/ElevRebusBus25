(function () {
  let session = null;
  let config = null;
  let mode = 'local';
  let supabase = null;
  let studentMap = null;
  let studentMarker = null;
  let targetMarker = null;
  let taskMarkers = [];
  let currentCoords = null;
  let lastGateKey = '';
  let lastUploadReceipt = null;
  let activeStudentTab = 'task';
  let locationWatchId = null;
  let messagePollId = null;
  let organizations = [];
  const seenAdminMessageIds = new Set();
  const seenScoreAdjustmentIds = new Set();

  const $ = id => document.getElementById(id);

  async function api(path, options = {}) {
    const isFormData = options.body instanceof FormData;
    const response = await fetch(path, {
      ...options,
      headers: {
        ...(isFormData ? {} : { 'content-type': 'application/json' }),
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
        ...(options.headers || {})
      }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API-feil');
    return data;
  }

  async function login() {
    if (mode === 'supabase') {
      const { data, error } = await supabase.rpc('student_login', {
        target_organization_id: $('organization-select').value || null,
        rebus_code_value: $('rebus-code').value.trim(),
        student_username: $('username').value.trim(),
        student_password: $('password').value
      });
      if (error) throw error;
      if (!data) throw new Error('Feil organisasjon, rebuskode, brukernavn eller kode. Rebusen må også være aktiv.');
      session = data;
    } else {
      session = await api('/api/student/login', {
        method: 'POST',
        body: JSON.stringify({
          username: $('username').value.trim(),
          password: $('password').value
        })
      });
    }
    localStorage.setItem('studentSessionToken', session.token);
    markKnownSessionEvents();
    renderSession();
    startLocationSending();
    startMessagePolling();
  }

  async function restoreSession() {
    const token = localStorage.getItem('studentSessionToken');
    if (!token) return;
    if (mode === 'supabase') {
      const { data, error } = await supabase.rpc('student_get_session', { raw_token: token });
      if (error || !data) {
        localStorage.removeItem('studentSessionToken');
        return;
      }
      session = data;
    } else {
      const response = await fetch(`/api/student/session/${token}`);
      if (!response.ok) return;
      session = await response.json();
    }
    markKnownSessionEvents();
    renderSession();
    startLocationSending();
    startMessagePolling();
  }

  function renderSession() {
    $('login-panel').hidden = true;
    $('app-panel').hidden = false;
    $('rebus-title').textContent = session.rebus.title;
    $('student-name').textContent = `${session.student.displayName}${session.student.teamName ? ` · ${session.student.teamName}` : ''}`;
    renderStudentScore();
    renderStudentMessages();
    renderStudentLog();

    const sortedTasks = [...(session.tasks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    $('task-list').innerHTML = renderCurrentTask(sortedTasks);
    renderStudentMapState(sortedTasks);
    switchStudentTab(activeStudentTab);

    document.querySelectorAll('[data-submit-task]').forEach(button => {
      button.addEventListener('click', () => submitTask(button.dataset.submitTask).catch(error => showTaskError(button.dataset.submitTask, error)));
    });
    document.querySelectorAll('[data-upload-task]').forEach(button => {
      button.addEventListener('click', () => submitFileTask(button.dataset.uploadTask).catch(error => showUploadError(button.dataset.uploadTask, error)));
    });
    document.querySelectorAll('[data-skip-task]').forEach(button => {
      button.addEventListener('click', () => skipTask(button.dataset.skipTask).catch(error => showTaskError(button.dataset.skipTask, error)));
    });
    document.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', logout);
    });
    document.querySelectorAll('[data-student-tab]').forEach(button => {
      button.addEventListener('click', () => switchStudentTab(button.dataset.studentTab));
    });
  }

  function markKnownSessionEvents() {
    (session.messages || []).forEach(message => {
      if (message.senderType === 'admin' || message.sender_type === 'admin') seenAdminMessageIds.add(message.id);
    });
    (session.scoreAdjustments || []).forEach(item => seenScoreAdjustmentIds.add(item.id));
  }

  function renderStudentMessages() {
    const panel = $('student-messages');
    if (!panel) return;
    const messages = session.messages || [];
    panel.innerHTML = `
      <div class="builder-heading">
        <h3>Meldinger</h3>
      </div>
      <div class="message-thread">
        ${messages.length ? messages.slice(-5).map(renderStudentMessage).join('') : '<p class="muted">Ingen meldinger ennå.</p>'}
      </div>
      <div class="message-composer">
        <input id="student-message-input" placeholder="Skriv melding til læreren">
        <button id="send-student-message-button" type="button">Send</button>
      </div>
    `;
    $('send-student-message-button')?.addEventListener('click', () => sendStudentMessage().catch(error => alert(error.message)));
  }

  function renderStudentScore() {
    const panel = $('student-score-panel');
    if (!panel) return;
    if (session.rebus?.showLiveScore === false || session.rebus?.show_live_score === false) {
      panel.innerHTML = '<p class="muted">Poengsum vises av lærer etter rebusen.</p>';
      return;
    }
    const score = visibleStudentScore();
    const completed = (session.progress || []).filter(item => item.correct !== false).length;
    panel.innerHTML = `
      <div class="mini-stats student-score-grid">
        <div><span>Foreløpig poengsum</span><strong>${score}</strong></div>
        <div><span>Levert</span><strong>${completed}/${(session.tasks || []).length}</strong></div>
      </div>
      <p class="muted">Mediaoppgaver og lærervurderte oppgaver kan få poeng senere.</p>
    `;
  }

  function visibleStudentScore() {
    const tasksById = new Map((session.tasks || []).map(task => [task.id, task]));
    const progressScore = (session.progress || []).reduce((sum, item) => {
      const task = tasksById.get(item.taskId || item.task_id);
      if (['photo', 'video', 'audio', 'teacher_approved'].includes(task?.type)) return sum;
      return sum + Number(item.pointsAwarded ?? item.points_awarded ?? 0);
    }, 0);
    const adjustmentScore = (session.scoreAdjustments || []).reduce((sum, item) => sum + Number(item.points || 0), 0);
    return progressScore + adjustmentScore;
  }

  function renderStudentLog() {
    const panel = $('student-log');
    if (!panel) return;
    const rows = studentLogEntries();
    panel.innerHTML = rows.length
      ? rows.map(entry => `
        <article class="log-entry ${entry.kind}">
          <strong>${escapeHtml(entry.title)}</strong>
          <p>${escapeHtml(entry.body)}</p>
          <small>${formatTime(entry.createdAt)}</small>
        </article>
      `).join('')
      : '<p class="muted">Loggen fylles opp når dere leverer svar, får meldinger eller får poengjusteringer.</p>';
  }

  function studentLogEntries() {
    const tasksById = new Map((session.tasks || []).map(task => [task.id, task]));
    const progressEntries = (session.progress || []).map(item => {
      const task = tasksById.get(item.taskId || item.task_id);
      const answer = String(item.answer || '');
      const skipped = answer.startsWith('[GITT_OPP]');
      const found = answer.startsWith('[FUNNET_FREM]');
      const media = answer.startsWith('[MEDIA_LEVERT]');
      return {
        kind: skipped ? 'penalty-line' : 'submitted',
        createdAt: item.createdAt || item.created_at,
        title: found ? `Kom frem til ${task?.title || 'post'}` : skipped ? `Ga opp ${task?.title || 'oppgave'}` : `Leverte ${task?.title || 'oppgave'}`,
        body: media ? 'Media er levert og venter på lærervurdering.' : skipped ? 'Dere gikk videre uten poeng fra denne posten.' : formatPlainAnswer(answer)
      };
    });
    const messageEntries = (session.messages || []).map(message => {
      const mine = message.senderType === 'student' || message.sender_type === 'student';
      return {
        kind: mine ? 'message-student' : 'message-admin',
        createdAt: message.createdAt || message.created_at,
        title: mine ? 'Melding sendt til lærer' : `Melding fra ${message.senderLabel || message.sender_label || 'Lærer'}`,
        body: message.body || ''
      };
    });
    const adjustmentEntries = (session.scoreAdjustments || []).map(item => ({
      kind: Number(item.points || 0) > 0 ? 'reward-line' : 'penalty-line',
      createdAt: item.createdAt || item.created_at,
      title: `${Number(item.points || 0) > 0 ? 'Belønning' : 'Trekk'} ${signedNumber(item.points)} poeng`,
      body: item.reason || 'Ingen begrunnelse.'
    }));
    return [...progressEntries, ...messageEntries, ...adjustmentEntries]
      .filter(entry => entry.createdAt)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  function formatPlainAnswer(answer) {
    const value = String(answer || '');
    if (!value) return 'Oppgaven er levert.';
    if (value.startsWith('[FUNNET_FREM]')) return 'Dere fant riktig sted.';
    return `Svar: ${value}`;
  }

  function renderStudentMessage(message) {
    const mine = message.senderType === 'student' || message.sender_type === 'student';
    const sender = mine ? 'Dere' : (message.senderLabel || message.sender_label || 'Lærer');
    return `
      <div class="message-bubble ${mine ? 'message-student' : 'message-admin'}">
        <strong>${escapeHtml(sender)}</strong>
        <p>${escapeHtml(message.body)}</p>
        <small>${formatTime(message.createdAt || message.created_at)}</small>
      </div>
    `;
  }

  function switchStudentTab(tab) {
    activeStudentTab = tab || 'task';
    document.querySelectorAll('[data-student-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.studentTab === activeStudentTab);
    });
    document.querySelectorAll('.student-tab').forEach(panel => {
      panel.hidden = panel.id !== `student-tab-${activeStudentTab}`;
    });
  }

  function renderCurrentTask(tasks) {
    if (!tasks.length) {
      return '<p class="muted">Læreren har ikke lagt inn oppgaver ennå.</p>';
    }

    const progressByTaskId = new Map((session.progress || []).map(item => [item.taskId, item]));
    const currentIndex = tasks.findIndex(task => !isTaskComplete(progressByTaskId.get(task.id)));
    if (currentIndex === -1) {
      return `
        <div class="student-topline">
          <p class="muted">${tasks.length} av ${tasks.length} oppgaver fullført.</p>
          <button class="ghost compact" type="button" data-logout>Logg ut</button>
        </div>
        <section class="task-group">
          <p class="eyebrow">Mål</p>
          <h3>Rebus fullført</h3>
          <p>Alle poster er levert. Bra jobbet.</p>
        </section>
      `;
    }

    const task = { ...tasks[currentIndex], globalIndex: currentIndex };
    const progress = progressByTaskId.get(task.id);
    const locationState = taskLocationState(task);
    const title = taskTitlePrefix(currentIndex, tasks.length);
    const isFindTask = isFindDestinationTask(task);
    return `
      <div class="student-topline">
        <p class="muted">${progressByTaskId.size} av ${tasks.length} oppgaver levert.</p>
        <button class="ghost compact" type="button" data-logout>Logg ut</button>
      </div>
      ${renderUploadReceipt()}
      <section class="task-group">
        <p class="eyebrow">${title}</p>
        <h3>${escapeHtml(locationTitle(task))}</h3>
        ${locationState.location && !isFindTask ? `<p class="muted">Gå til markøren på kartet. Radius: ${locationState.radius} meter.</p>` : ''}
        ${locationState.location && isFindTask ? renderFindDestinationNotice(task, locationState) : ''}
        ${locationState.location && !locationState.inside && !isFindTask ? `
          <p class="notice">Oppgaven åpnes når dere er innenfor geofence. ${locationState.distanceText}</p>
        ` : renderTask(task, tasks.length, progress)}
      </section>
    `;
  }

  function renderTask(task, taskCount, progress) {
    const titlePrefix = taskTitlePrefix(task.globalIndex, taskCount);
    return `
      <article class="task-card">
        <div class="task-card-header">
          <div>
            <strong>${titlePrefix}: ${escapeHtml(task.title)}</strong>
            <p class="muted">${taskTypeLabel(task.type)} · ${Number(task.points || 0)} poeng</p>
          </div>
          ${progress ? renderProgressBadge(progress) : ''}
        </div>
        ${task.prompt || task.description ? `<p>${escapeHtml(task.prompt || task.description)}</p>` : ''}
        ${task.location && !isFindDestinationTask(task) ? `<p class="muted">Presis lokasjon: ${escapeHtml(task.location.label || '')} ${formatCoordinate(task.location.lat)}, ${formatCoordinate(task.location.lng)}</p>` : ''}
        ${renderAssets(task.assets || [])}
        ${renderHints(task.hints || [])}
        ${progress && progress.correct !== false ? renderProgressDetails(progress) : `${progress ? renderRetryDetails(progress) : ''}${taskForm(task)}${skipTaskBox(task)}`}
      </article>
    `;
  }

  function skipTaskBox(task) {
    return `
      <details class="skip-task-box">
        <summary>Vi gir opp denne oppgaven</summary>
        <p class="notice">Hvis dere gir opp, sendes dere videre til neste post. Dere får 0 poeng for denne posten, og kan ikke samle poeng fra den etterpå.</p>
        <label><span>Skriv HOPP for å bekrefte</span><input id="skip-confirm-${task.id}" autocomplete="off" placeholder="HOPP"></label>
        <button class="danger" type="button" data-skip-task="${task.id}">Gi opp og gå videre</button>
        <p id="skip-status-${task.id}" class="muted"></p>
      </details>
    `;
  }

  function taskForm(task) {
    if (task.type === 'multiple_choice') {
      return `
        <fieldset class="choice-list">
          <legend>Velg ett svar</legend>
          ${renderOptions(task, 'radio')}
        </fieldset>
        <button data-submit-task="${task.id}">Lever</button>
        <p id="task-status-${task.id}" class="muted"></p>
      `;
    }

    if (task.type === 'multi_select') {
      return `
        <fieldset class="choice-list">
          <legend>Velg ett eller flere svar</legend>
          ${renderOptions(task, 'checkbox')}
        </fieldset>
        <button data-submit-task="${task.id}">Lever</button>
        <p id="task-status-${task.id}" class="muted"></p>
      `;
    }

    if (task.type === 'number') {
      return `
        <label><span>Tall-svar</span><input id="answer-${task.id}" type="number" inputmode="decimal" step="any" placeholder="Skriv et tall"></label>
        <button data-submit-task="${task.id}">Lever</button>
        <p id="task-status-${task.id}" class="muted"></p>
      `;
    }

    if (isFindDestinationTask(task)) {
      return `
        <button data-submit-task="${task.id}">Vi er fremme</button>
        <p id="task-status-${task.id}" class="muted"></p>
      `;
    }

    if (task.type === 'photo' || task.type === 'video' || task.type === 'audio') {
      const accept = task.type === 'photo' ? 'image/*' : task.type === 'audio' ? 'audio/*' : 'video/*';
      return `
        <label><span>${taskTypeLabel(task.type)}</span><input id="file-${task.id}" type="file" accept="${accept}"></label>
        <label><span>Kommentar</span><input id="note-${task.id}" placeholder="Valgfri kommentar"></label>
        <button data-upload-task="${task.id}">Bekreft at alle filer er levert, gå til neste oppgave</button>
        <p id="upload-status-${task.id}" class="muted"></p>
      `;
    }

    return `
      <label><span>Svar</span><input id="answer-${task.id}" placeholder="Skriv svar"></label>
      <button data-submit-task="${task.id}">Lever</button>
      <p id="task-status-${task.id}" class="muted"></p>
    `;
  }

  function renderOptions(task, inputType) {
    const options = task.options || [];
    if (!options.length) return '<p class="muted">Denne oppgaven mangler svaralternativer.</p>';
    return options.map(option => `
      <label class="choice-option">
        <input type="${inputType}" name="option-${task.id}" value="${escapeHtml(option.id)}">
        <span>${escapeHtml(option.label)}</span>
      </label>
    `).join('');
  }

  function renderAssets(assets) {
    if (!assets.length) return '';
    return `
      <div class="asset-list">
        ${assets.map(asset => `
          <a class="asset-link" href="${escapeAttribute(asset.url)}" target="_blank" rel="noreferrer">
            ${escapeHtml(asset.title || mediaTypeLabel(asset.type))}
            <span>${mediaTypeLabel(asset.type)}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  function renderHints(hints) {
    if (!hints.length) return '';
    return `
      <details class="hint-box">
        <summary>Vis hint</summary>
        <ol>
          ${hints.map(hint => `<li>${escapeHtml(hint.body)}</li>`).join('')}
        </ol>
      </details>
    `;
  }

  function renderProgressBadge(progress) {
    const className = progress.correct === true ? 'success' : progress.correct === false ? 'retry' : 'submitted';
    const label = progress.correct === true ? 'Riktig' : progress.correct === false ? 'Prøv igjen' : 'Levert';
    return `<span class="status-pill ${className}">${label}</span>`;
  }

  function renderProgressDetails(progress) {
    const points = Number(progress.pointsAwarded || 0);
    const answer = progress.answer ? `<p class="muted">Ditt svar: ${escapeHtml(progress.answer)}</p>` : '';
    return `
      <div class="submitted-box">
        <strong>${points} poeng registrert</strong>
        ${answer}
      </div>
    `;
  }

  function renderUploadReceipt() {
    if (!lastUploadReceipt) return '';
    return `
      <p class="notice success-notice">
        Innleveringen er registrert: ${escapeHtml(lastUploadReceipt.fileName)}. Dere er sendt videre til neste oppgave.
      </p>
    `;
  }

  function isTaskComplete(progress) {
    return Boolean(progress && progress.correct !== false);
  }

  function renderRetryDetails(progress) {
    const answer = progress.answer ? ` Siste svar: ${escapeHtml(progress.answer)}.` : '';
    return `<p class="notice">Ikke helt riktig ennå.${answer} Prøv en gang til.</p>`;
  }

  async function submitTask(taskId) {
    const task = (session.tasks || []).find(item => item.id === taskId);
    const status = document.getElementById(`task-status-${taskId}`);
    const locationState = taskLocationState(task);
    if (locationState.location && !locationState.inside) {
      if (status) status.textContent = 'Dere er ikke innenfor geofence ennå.';
      return;
    }
    const payload = { taskId };

    if (task?.type === 'multiple_choice' || task?.type === 'multi_select') {
      payload.optionIds = Array.from(document.querySelectorAll(`[name="option-${cssEscape(taskId)}"]:checked`)).map(input => input.value);
      if (!payload.optionIds.length) {
        if (status) status.textContent = 'Velg minst ett svar først.';
        return;
      }
    } else {
      const input = document.getElementById(`answer-${taskId}`);
      payload.answer = isFindDestinationTask(task) ? 'Fremme' : (input ? input.value : '');
      if (!String(payload.answer).trim() && task?.type !== 'teacher_approved' && !isFindDestinationTask(task)) {
        if (status) status.textContent = 'Skriv inn et svar først.';
        return;
      }
    }

    if (status) status.textContent = 'Leverer...';
    const progress = mode === 'supabase'
      ? await recordSupabaseProgress(payload)
      : (await api('/api/student/progress', {
        method: 'POST',
        body: JSON.stringify(payload)
      })).progress;
    session.progress = [...(session.progress || []).filter(item => item.taskId !== taskId), progress];
    renderSession();
  }

  function showTaskError(taskId, error) {
    const status = document.getElementById(`task-status-${taskId}`);
    if (status) status.textContent = error.message || 'Kunne ikke levere svar.';
    else alert(error.message || 'Kunne ikke levere svar.');
  }

  function showUploadError(taskId, error) {
    const status = document.getElementById(`upload-status-${taskId}`);
    if (status) status.textContent = error.message || 'Kunne ikke levere.';
    else alert(error.message || 'Kunne ikke levere.');
  }

  async function submitFileTask(taskId) {
    const fileInput = document.getElementById(`file-${taskId}`);
    const noteInput = document.getElementById(`note-${taskId}`);
    const status = document.getElementById(`upload-status-${taskId}`);
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    if (!file) {
      if (status) status.textContent = 'Velg en fil først.';
      return;
    }

    if (status) status.textContent = mode === 'supabase' ? 'Laster opp og registrerer innlevering...' : 'Laster opp...';
    if (mode === 'supabase') {
      const uploadName = `${Date.now()}-${safeUploadName(file.name)}`;
      const storagePath = [
        session.rebus.id,
        session.student.id,
        taskId,
        uploadName
      ].join('/');
      const contentType = file.type || 'application/octet-stream';
      const { error: uploadError } = await supabase.storage
        .from('submissions')
        .upload(storagePath, file, { contentType, upsert: false });
      if (uploadError) throw uploadError;

      const { data, error } = await supabase.rpc('student_record_submission', {
        raw_token: session.token,
        target_task_id: taskId,
        storage_path_value: storagePath,
        original_name_value: file.name,
        content_type_value: contentType,
        size_bytes_value: file.size,
        note_value: noteInput ? noteInput.value : ''
      });
      if (error) throw error;
      if (!data) throw new Error('Kunne ikke registrere innleveringen.');
      session.progress = [...(session.progress || []).filter(item => item.taskId !== taskId), data.progress];
      session.submissions = session.submissions || [];
      session.submissions.push(data.submission);
      lastUploadReceipt = { taskId, fileName: file.name };
    } else {
      const formData = new FormData();
      formData.append('taskId', taskId);
      formData.append('note', noteInput ? noteInput.value : '');
      formData.append('file', file);

      const data = await api('/api/student/submissions', {
        method: 'POST',
        body: formData
      });
      session.progress = [...(session.progress || []).filter(item => item.taskId !== taskId), data.progress];
      session.submissions = session.submissions || [];
      session.submissions.push(data.submission);
      lastUploadReceipt = { taskId, fileName: file.name };
    }
    renderSession();
  }

  function safeUploadName(name) {
    return String(name || 'innlevering')
      .normalize('NFKD')
      .replace(/[^\w.\-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 90) || 'innlevering';
  }

  async function recordSupabaseProgress(payload) {
    const { data, error } = await supabase.rpc('student_record_progress', {
      raw_token: session.token,
      target_task_id: payload.taskId,
      answer_text: payload.answer || '',
      selected_option_ids: payload.optionIds || []
    });
    if (error) throw error;
    if (!data) throw new Error('Kunne ikke levere svar.');
    return data;
  }

  async function skipTask(taskId) {
    const task = (session.tasks || []).find(item => item.id === taskId);
    const status = document.getElementById(`skip-status-${taskId}`);
    const locationState = taskLocationState(task);
    if (locationState.location && !locationState.inside) {
      if (status) status.textContent = 'Dere må være innenfor geofence før dere kan gi opp denne posten.';
      return;
    }
    const confirmation = document.getElementById(`skip-confirm-${taskId}`)?.value || '';
    if (confirmation.trim().toLowerCase() !== 'hopp') {
      if (status) status.textContent = 'Skriv HOPP for å bekrefte.';
      return;
    }
    if (status) status.textContent = 'Hopper over...';
    if (mode !== 'supabase') throw new Error('Hopp over krever Supabase-modus.');
    const { data, error } = await supabase.rpc('student_skip_task', {
      raw_token: session.token,
      target_task_id: taskId,
      confirmation_text: confirmation
    });
    if (error) throw error;
    if (!data) throw new Error('Kunne ikke hoppe over oppgaven.');
    session.progress = [...(session.progress || []).filter(item => item.taskId !== taskId), data];
    renderSession();
  }

  async function sendStudentMessage() {
    const input = $('student-message-input');
    const body = input?.value.trim();
    if (!body) return alert('Skriv en melding først.');
    if (mode !== 'supabase') return alert('Meldinger krever Supabase.');
    const { error } = await supabase.rpc('student_send_message', {
      raw_token: session.token,
      message_body: body
    });
    if (error) throw error;
    input.value = '';
    await refreshSession({ notify: false });
    showNotification('Melding sendt', 'Læreren får varsel i admin.');
  }

  function startMessagePolling() {
    if (messagePollId) clearInterval(messagePollId);
    if (mode !== 'supabase') return;
    messagePollId = setInterval(() => refreshSession({ notify: true }).catch(() => {}), 6000);
  }

  async function refreshSession({ notify = false } = {}) {
    if (!session?.token) return;
    const previousSignature = sessionSignature();
    if (mode === 'supabase') {
      const { data, error } = await supabase.rpc('student_get_session', { raw_token: session.token });
      if (error || !data) return;
      session = data;
    } else {
      const response = await fetch(`/api/student/session/${session.token}`);
      if (!response.ok) return;
      session = await response.json();
    }
    const unreadAdminMessages = (session.messages || []).filter(message =>
      (message.senderType === 'admin' || message.sender_type === 'admin') &&
      !(message.readByStudentAt || message.read_by_student_at) &&
      !seenAdminMessageIds.has(message.id)
    );
    const newAdjustments = (session.scoreAdjustments || []).filter(item => !seenScoreAdjustmentIds.has(item.id));
    unreadAdminMessages.forEach(message => {
      seenAdminMessageIds.add(message.id);
      if (notify) {
        showNotification('Ny melding fra lærer', message.body);
        playNotificationSound();
      }
    });
    newAdjustments.forEach(item => {
      seenScoreAdjustmentIds.add(item.id);
      if (notify) {
        showScoreNotification(Number(item.points || 0), item.reason || '');
        playNotificationSound();
      }
    });
    if (unreadAdminMessages.length && mode === 'supabase') {
      await supabase.rpc('student_mark_messages_read', { raw_token: session.token });
    }
    if (sessionSignature() !== previousSignature || unreadAdminMessages.length || newAdjustments.length) renderSession();
  }

  function sessionSignature() {
    if (!session) return '';
    return JSON.stringify({
      tasks: (session.tasks || []).map(task => task.id),
      progress: (session.progress || []).map(item => `${item.taskId}:${item.correct}:${item.pointsAwarded}`),
      messages: (session.messages || []).map(message => `${message.id}:${message.readByStudentAt || message.read_by_student_at || ''}`),
      adjustments: (session.scoreAdjustments || []).map(item => `${item.id}:${item.points}`)
    });
  }

  function logout() {
    localStorage.removeItem('studentSessionToken');
    session = null;
    lastGateKey = '';
    currentCoords = null;
    seenAdminMessageIds.clear();
    seenScoreAdjustmentIds.clear();
    if (messagePollId) {
      clearInterval(messagePollId);
      messagePollId = null;
    }
    if (locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(locationWatchId);
      locationWatchId = null;
    }
    if (targetMarker) targetMarker.setMap(null);
    targetMarker = null;
    $('login-panel').hidden = false;
    $('app-panel').hidden = true;
  }

  function startLocationSending() {
    if (!navigator.geolocation) {
      setLocationStatus('Denne nettleseren støtter ikke posisjon.');
      return;
    }
    initStudentMap().catch(() => {});
    if (locationWatchId !== null) {
      navigator.geolocation.clearWatch(locationWatchId);
    }
    locationWatchId = navigator.geolocation.watchPosition(position => {
      currentCoords = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      updateStudentPosition(position.coords.latitude, position.coords.longitude);
      const gateKey = currentGateKey();
      if (gateKey !== lastGateKey) {
        lastGateKey = gateKey;
        renderSession();
      } else {
        renderStudentMapState([...(session.tasks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
      }
      if (mode === 'supabase') {
        supabase.rpc('student_record_location', {
          raw_token: session.token,
          latitude_value: position.coords.latitude,
          longitude_value: position.coords.longitude,
          accuracy_value: position.coords.accuracy
        }).then(({ error }) => {
          if (error) setLocationStatus(`Posisjon ikke sendt: ${error.message}`);
          else setLocationStatus(`Posisjon sendt ${new Date().toLocaleTimeString('no-NO')}.`);
        }).catch(error => setLocationStatus(`Posisjon ikke sendt: ${error.message}`));
      } else {
        api('/api/student/location', {
          method: 'POST',
          body: JSON.stringify({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy
          })
        }).then(() => setLocationStatus(`Posisjon sendt ${new Date().toLocaleTimeString('no-NO')}.`))
          .catch(error => setLocationStatus(`Posisjon ikke sendt: ${error.message}`));
      }
    }, error => {
      setLocationStatus(error.code === 1 ? 'Posisjon ble ikke tillatt på denne enheten.' : 'Kunne ikke hente posisjon.');
    }, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
  }

  async function initStudentMap() {
    const mapsKey = currentStudentMapsKey();
    if (!mapsKey || studentMap || !window.google?.maps) {
      if (mapsKey && !window.google?.maps) {
        await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}`);
      } else if (!mapsKey) {
        return;
      }
    }
    const element = $('student-map');
    element.classList.add('is-live');
    element.textContent = '';
    studentMap = new google.maps.Map(element, {
      center: { lat: 60.795, lng: 10.67 },
      zoom: 15,
      mapTypeControl: false,
      streetViewControl: false
    });
    renderStudentMapState([...(session.tasks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0)));
  }

  function currentStudentMapsKey() {
    if (mode === 'supabase') {
      return session?.rebus?.googleMapsApiKey || session?.rebus?.google_maps_api_key || '';
    }
    return config.googleMapsApiKey || '';
  }

  function updateStudentPosition(lat, lng) {
    if (!studentMap || !window.google?.maps) return;
    const position = { lat, lng };
    if (!studentMarker) {
      studentMarker = new google.maps.Marker({
        map: studentMap,
        position,
        title: 'Min posisjon',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#1f6feb',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2
        }
      });
    }
    studentMarker.setPosition(position);
    studentMap.panTo(position);
  }

  function renderStudentMapState(tasks) {
    if (!studentMap || !window.google?.maps) return;
    taskMarkers.forEach(marker => marker.setMap(null));
    taskMarkers = [];
    const progressByTaskId = new Map((session.progress || []).map(item => [item.taskId, item]));
    const currentIndex = tasks.findIndex(task => !isTaskComplete(progressByTaskId.get(task.id)));
    if (currentIndex === -1) {
      if (targetMarker) targetMarker.setMap(null);
      targetMarker = null;
      return;
    }
    const task = tasks[currentIndex];
    const location = taskTargetLocation(task);
    if (!location) return;
    if (isFindDestinationTask(task)) {
      if (targetMarker) targetMarker.setMap(null);
      targetMarker = null;
      return;
    }
    if (!targetMarker) {
      targetMarker = new google.maps.Marker({
        map: studentMap,
        position: location,
        label: String(currentIndex + 1),
        title: task.title
      });
    }
    targetMarker.setMap(studentMap);
    targetMarker.setPosition(location);
    targetMarker.setLabel(String(currentIndex + 1));
    targetMarker.setTitle(task.title);
    if (!currentCoords) {
      studentMap.panTo(location);
      studentMap.setZoom(16);
    }
  }

  function taskLocationState(task) {
    const location = taskTargetLocation(task);
    const radius = Number(task?.geofenceRadiusMeters || task?.geofence_radius_meters || 30);
    if (!location) return { location: null, radius, inside: true, distance: 0, distanceText: '' };
    if (!currentCoords) return { location, radius, inside: false, distance: null, distanceText: 'Venter på GPS-posisjon.' };
    const distance = distanceMeters(currentCoords, location);
    return {
      location,
      radius,
      inside: distance <= radius,
      distance,
      distanceText: `Avstand: ca. ${Math.round(distance)} meter.`
    };
  }

  function renderFindDestinationNotice(task, locationState) {
    if (locationState.inside) {
      return `<p class="notice success-notice">Dere er innenfor området. Bekreft når dere er klare til å gå videre.</p>`;
    }
    if (task.config?.findDestination?.showDistance === false) {
      return '<p class="notice">Finn riktig sted. Oppgaven kan leveres når dere er innenfor området.</p>';
    }
    return `<p class="notice">Finn riktig sted. ${locationState.distanceText || 'Venter på GPS-posisjon.'}</p>`;
  }

  function isFindDestinationTask(task) {
    return task?.type === 'find_destination';
  }

  function currentGateKey() {
    if (!session) return '';
    const tasks = [...(session.tasks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    const progressByTaskId = new Map((session.progress || []).map(item => [item.taskId, item]));
    const currentIndex = tasks.findIndex(task => !isTaskComplete(progressByTaskId.get(task.id)));
    if (currentIndex === -1) return 'done';
    const state = taskLocationState(tasks[currentIndex]);
    return `${tasks[currentIndex].id}:${state.inside ? 'inside' : 'outside'}`;
  }

  function taskTargetLocation(task) {
    return task?.location || task?.stop?.location || null;
  }

  function locationTitle(task) {
    if (isFindDestinationTask(task)) return task?.title || 'Finn frem!';
    const location = taskTargetLocation(task);
    return location?.label || task?.stop?.title || task?.title || 'Neste post';
  }

  function distanceMeters(from, to) {
    const earthRadius = 6371000;
    const lat1 = degreesToRadians(from.lat);
    const lat2 = degreesToRadians(to.lat);
    const deltaLat = degreesToRadians(to.lat - from.lat);
    const deltaLng = degreesToRadians(to.lng - from.lng);
    const a = Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function degreesToRadians(value) {
    return Number(value) * Math.PI / 180;
  }

  function setLocationStatus(message) {
    const element = $('location-status');
    if (element) element.textContent = message;
  }

  function groupLabel(index, total) {
    if (index === 0) return 'Start';
    if (index === total - 1) return 'Mål';
    return `Stopp ${index + 1}`;
  }

  function taskTitlePrefix(index, total) {
    if (index === 0) return 'Start';
    if (index === total - 1) return 'Mål';
    return `Oppgave ${index + 1}`;
  }

  function taskTypeLabel(type) {
    const labels = {
      text: 'Tekstsvar',
      find_destination: 'Finn frem!',
      number: 'Tall-svar',
      multiple_choice: 'Ett riktig svar',
      multi_select: 'Flere riktige svar',
      photo: 'Bilde',
      video: 'Video',
      audio: 'Lyd',
      teacher_approved: 'Lærergodkjent',
      ordering: 'Rekkefølge',
      matching: 'Koble sammen',
      qr_code: 'QR-kode'
    };
    return labels[type] || 'Oppgave';
  }

  function mediaTypeLabel(type) {
    const labels = {
      image: 'Bilde',
      video: 'Video',
      audio: 'Lyd',
      document: 'Lenke'
    };
    return labels[type] || 'Ressurs';
  }

  function formatCoordinate(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number.toFixed(5) : '';
  }

  function formatTime(value) {
    if (!value) return '';
    return new Date(value).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' });
  }

  function signedNumber(value) {
    const number = Number(value || 0);
    return number > 0 ? `+${number}` : String(number);
  }

  function showNotification(title, body) {
    const stack = $('notification-stack');
    if (!stack) return alert(`${title}\n${body}`);
    const item = document.createElement('div');
    item.className = 'app-notification';
    item.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(body)}</p>`;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 9000);
  }

  function showScoreNotification(points, reason) {
    const stack = $('notification-stack');
    const positive = Number(points) > 0;
    const title = `${positive ? 'Belønning' : 'Straff'} ${positive ? '+' : ''}${points} poeng!`;
    if (!stack) return alert(`${title}\n${reason}`);
    const item = document.createElement('div');
    item.className = `app-notification score-popup ${positive ? 'reward-popup' : 'penalty-popup'}`;
    item.innerHTML = `<strong>${escapeHtml(title)}</strong><p>${escapeHtml(reason || 'Ingen begrunnelse')}</p>`;
    stack.appendChild(item);
    setTimeout(() => item.remove(), 12000);
  }

  function playNotificationSound() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      const audio = new AudioContext();
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(740, audio.currentTime);
      oscillator.frequency.setValueAtTime(990, audio.currentTime + 0.12);
      gain.gain.setValueAtTime(0.0001, audio.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, audio.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.35);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start();
      oscillator.stop(audio.currentTime + 0.36);
    } catch (_error) {
      // Browsers may block sound until the page has had a user gesture.
    }
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[char]));
  }

  function escapeAttribute(value) {
    const url = String(value || '');
    if (!/^https?:\/\//i.test(url)) return '#';
    return escapeHtml(url);
  }

  function escapeAttributeValue(value) {
    return escapeHtml(String(value || ''));
  }

  async function boot() {
    config = await loadConfig();
    mode = config.supabaseUrl && config.supabaseAnonKey ? 'supabase' : 'local';
    if (mode === 'supabase') {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      supabase = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
      $('username').value = '';
      $('password').value = '';
      $('username').placeholder = 'gruppe-1';
      $('password').placeholder = 'Kode fra læreren';
      $('organization-select-label').hidden = false;
      $('rebus-code-label').hidden = false;
      await loadStudentOrganizations();
    }
    $('login-button').addEventListener('click', () => login().catch(error => alert(error.message)));
    restoreSession().catch(() => {});
  }

  async function loadStudentOrganizations() {
    const select = $('organization-select');
    const { data, error } = await supabase.rpc('student_public_organizations');
    if (error) throw error;
    organizations = data || [];
    select.innerHTML = organizations.length
      ? organizations.map(org => `<option value="${escapeAttributeValue(org.id)}">${escapeHtml(org.name)}</option>`).join('')
      : '<option value="">Ingen organisasjoner med rebuser</option>';
  }

  async function loadConfig() {
    if (window.REBUS_CONFIG) return normalizeConfig(window.REBUS_CONFIG);
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) return normalizeConfig(await response.json());
    } catch (_error) {
      // GitHub Pages has no local API.
    }
    return normalizeConfig({});
  }

  function normalizeConfig(value) {
    return {
      supabaseUrl: value.supabaseUrl || '',
      supabaseAnonKey: value.supabaseAnonKey || '',
      googleMapsApiKey: value.googleMapsApiKey || ''
    };
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  boot().catch(error => alert(error.message));
})();
