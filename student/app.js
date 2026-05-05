(function () {
  let session = null;
  let config = null;
  let mode = 'local';
  let supabase = null;
  let studentMap = null;
  let studentMarker = null;
  let taskMarkers = [];

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
        student_username: $('username').value.trim(),
        student_password: $('password').value
      });
      if (error) throw error;
      if (!data) throw new Error('Feil brukernavn eller kode.');
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
    renderSession();
    startLocationSending();
  }

  async function restoreSession() {
    const token = localStorage.getItem('studentSessionToken');
    if (!token) return;
    if (mode === 'supabase') {
      const { data, error } = await supabase.rpc('student_get_session', { raw_token: token });
      if (error || !data) return;
      session = data;
    } else {
      const response = await fetch(`/api/student/session/${token}`);
      if (!response.ok) return;
      session = await response.json();
    }
    renderSession();
    startLocationSending();
  }

  function renderSession() {
    $('login-panel').hidden = true;
    $('app-panel').hidden = false;
    $('rebus-title').textContent = session.rebus.title;
    $('student-name').textContent = `${session.student.displayName}${session.student.teamName ? ` · ${session.student.teamName}` : ''}`;

    const progressByTaskId = new Map((session.progress || []).map(item => [item.taskId, item]));
    const sortedTasks = [...(session.tasks || [])].sort((a, b) => Number(a.order || 0) - Number(b.order || 0));
    $('task-list').innerHTML = renderTaskGroups(sortedTasks, progressByTaskId);

    document.querySelectorAll('[data-submit-task]').forEach(button => {
      button.addEventListener('click', () => submitTask(button.dataset.submitTask).catch(error => showTaskError(button.dataset.submitTask, error)));
    });
    document.querySelectorAll('[data-upload-task]').forEach(button => {
      button.addEventListener('click', () => submitFileTask(button.dataset.uploadTask).catch(error => showUploadError(button.dataset.uploadTask, error)));
    });
    document.querySelectorAll('[data-logout]').forEach(button => {
      button.addEventListener('click', logout);
    });
  }

  function renderTaskGroups(tasks, progressByTaskId) {
    if (!tasks.length) {
      return '<p class="muted">Læreren har ikke lagt inn oppgaver ennå.</p>';
    }

    const grouped = [];
    tasks.forEach((task, index) => {
      const key = task.stopId || task.id;
      let group = grouped.find(item => item.key === key);
      if (!group) {
        group = {
          key,
          stop: task.stop,
          title: task.stop?.title || task.location?.label || task.title || `Stopp ${grouped.length + 1}`,
          tasks: []
        };
        grouped.push(group);
      }
      group.tasks.push({ ...task, globalIndex: index });
    });

    let previousGroupsComplete = true;
    grouped.forEach(group => {
      group.unlocked = previousGroupsComplete;
      group.complete = group.tasks.every(task => isTaskComplete(progressByTaskId.get(task.id)));
      previousGroupsComplete = previousGroupsComplete && group.complete;
    });

    return `
      <div class="student-topline">
        <p class="muted">${progressByTaskId.size} av ${tasks.length} oppgaver levert.</p>
        <button class="ghost compact" type="button" data-logout>Logg ut</button>
      </div>
      ${grouped.map((group, groupIndex) => `
        <section class="task-group">
          <div>
            <p class="eyebrow">${groupLabel(groupIndex, grouped.length)}</p>
            <h3>${escapeHtml(group.title)}</h3>
            ${group.stop?.location ? `<p class="muted">Lokasjon: ${escapeHtml(group.stop.location.label || '')} ${formatCoordinate(group.stop.location.lat)}, ${formatCoordinate(group.stop.location.lng)}</p>` : ''}
          </div>
          ${group.unlocked
            ? group.tasks.map(task => renderTask(task, tasks.length, progressByTaskId.get(task.id))).join('')
            : '<p class="notice">Dette stoppet åpnes når forrige stopp er fullført.</p>'}
        </section>
      `).join('')}
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
        ${task.location ? `<p class="muted">Presis lokasjon: ${escapeHtml(task.location.label || '')} ${formatCoordinate(task.location.lat)}, ${formatCoordinate(task.location.lng)}</p>` : ''}
        ${renderAssets(task.assets || [])}
        ${renderHints(task.hints || [])}
        ${progress && progress.correct !== false ? renderProgressDetails(progress) : `${progress ? renderRetryDetails(progress) : ''}${taskForm(task)}`}
      </article>
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

    if (task.type === 'photo' || task.type === 'video' || task.type === 'audio') {
      const accept = task.type === 'photo' ? 'image/*' : task.type === 'audio' ? 'audio/*' : 'video/*';
      return `
        <label><span>${taskTypeLabel(task.type)}</span><input id="file-${task.id}" type="file" accept="${accept}"></label>
        <label><span>Kommentar</span><input id="note-${task.id}" placeholder="Valgfri kommentar"></label>
        <button data-upload-task="${task.id}">Last opp</button>
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
    const payload = { taskId };

    if (task?.type === 'multiple_choice' || task?.type === 'multi_select') {
      payload.optionIds = Array.from(document.querySelectorAll(`[name="option-${cssEscape(taskId)}"]:checked`)).map(input => input.value);
      if (!payload.optionIds.length) {
        if (status) status.textContent = 'Velg minst ett svar først.';
        return;
      }
    } else {
      const input = document.getElementById(`answer-${taskId}`);
      payload.answer = input ? input.value : '';
      if (!String(payload.answer).trim() && task?.type !== 'teacher_approved') {
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

    if (status) status.textContent = mode === 'supabase' ? 'Registrerer innlevering...' : 'Laster opp...';
    if (mode === 'supabase') {
      const note = [noteInput?.value || '', file.name].filter(Boolean).join(' · ');
      const progress = await recordSupabaseProgress({ taskId, answer: note });
      session.progress = [...(session.progress || []).filter(item => item.taskId !== taskId), progress];
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
    }
    renderSession();
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

  function logout() {
    localStorage.removeItem('studentSessionToken');
    session = null;
    $('login-panel').hidden = false;
    $('app-panel').hidden = true;
  }

  function startLocationSending() {
    if (!navigator.geolocation) {
      setLocationStatus('Denne nettleseren støtter ikke posisjon.');
      return;
    }
    initStudentMap().catch(() => {});
    navigator.geolocation.watchPosition(position => {
      updateStudentPosition(position.coords.latitude, position.coords.longitude);
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
    if (!config.googleMapsApiKey || studentMap || !window.google?.maps) {
      if (config.googleMapsApiKey && !window.google?.maps) {
        await loadScript(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(config.googleMapsApiKey)}`);
      } else if (!config.googleMapsApiKey) {
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
    taskMarkers.forEach(marker => marker.setMap(null));
    taskMarkers = (session.tasks || [])
      .filter(task => task.location || task.stop?.location)
      .map((task, index) => {
        const position = task.location || task.stop.location;
        return new google.maps.Marker({
          map: studentMap,
          position,
          label: String(index + 1),
          title: task.title
        });
      });
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
    }
    $('login-button').addEventListener('click', () => login().catch(error => alert(error.message)));
    restoreSession().catch(() => {});
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
