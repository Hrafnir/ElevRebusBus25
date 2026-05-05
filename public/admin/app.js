(function () {
  const state = {
    config: null,
    mode: 'local',
    supabase: null,
    session: null,
    user: null,
    teacherEmail: localStorage.getItem('teacherEmail') || 'teacher@example.com',
    teacher: null,
    organizations: [],
    selectedOrganization: null,
    projectSettings: null,
    rebuses: [],
    selectedRebus: null,
    selectedStopId: '',
    editingTaskId: null,
    map: null,
    marker: null,
    liveMap: null,
    liveMarkers: new Map(),
    autocomplete: null,
    loadedMapsKey: '',
    optionRows: [],
    assetRows: [],
    hintRows: [],
    numberBands: [],
    lastSuggestedGroupName: '',
    lastSuggestedGroupUsername: '',
    activeAdminTab: 'tasks',
    organizationPickerOpen: false
  };

  const $ = id => document.getElementById(id);
  const localHeaders = () => ({
    'content-type': 'application/json',
    'x-teacher-email': state.teacherEmail,
    ...(state.teacher ? { 'x-teacher-id': state.teacher.id } : {})
  });

  async function boot() {
    state.config = await loadConfig();
    state.mode = state.config.supabaseUrl && state.config.supabaseAnonKey ? 'supabase' : 'local';
    $('teacher-email').value = state.teacherEmail;
    configureAuthUi();

    if (state.mode === 'supabase') {
      await bootSupabase();
    } else {
      configureMapsUi();
      await devLogin();
    }
    resetTaskBuilder();
    updateTaskTypeUi();
    seedGroupPassword();
  }

  async function bootSupabase() {
    await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    state.supabase = window.supabase.createClient(state.config.supabaseUrl, state.config.supabaseAnonKey);
    $('auth-status').textContent = 'Sjekker innlogging...';
    const { data } = await state.supabase.auth.getSession();
    if (data.session) {
      await setSupabaseSession(data.session);
      cleanAuthUrl();
    } else {
      updateAuthStatus();
    }
    state.supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setSupabaseSession(session).catch(error => alert(error.message));
      else clearSupabaseSession();
    });
  }

  function configureAuthUi() {
    const usingSupabase = state.mode === 'supabase';
    $('supabase-login-button').hidden = !usingSupabase;
    $('logout-button').hidden = true;
    $('google-login-slot').hidden = usingSupabase;
    $('login-button').hidden = usingSupabase || !state.config.allowDevAuth;
    $('teacher-email').hidden = usingSupabase || !state.config.allowDevAuth;
    updateAuthStatus();

    if (!usingSupabase && state.config.googleClientId) {
      $('login-button').hidden = true;
      $('teacher-email').hidden = true;
      loadScript('https://accounts.google.com/gsi/client')
        .then(() => {
          google.accounts.id.initialize({
            client_id: state.config.googleClientId,
            callback: handleGoogleCredential
          });
          google.accounts.id.renderButton($('google-login-slot'), {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            locale: 'no'
          });
        })
        .catch(() => {
          $('login-button').hidden = false;
          $('teacher-email').hidden = false;
        });
    }
  }

  async function signInWithSupabaseGoogle() {
    const { error } = await state.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: appUrl('admin/') }
    });
    if (error) throw error;
  }

  async function setSupabaseSession(session) {
    state.session = session;
    state.user = session.user;
    state.teacherEmail = state.user.email;
    localStorage.setItem('teacherEmail', state.teacherEmail);
    $('logout-button').hidden = false;
    $('supabase-login-button').hidden = true;
    updateAuthStatus();
    await loadOrganizations();
    await loadLive();
  }

  function clearSupabaseSession() {
    state.session = null;
    state.user = null;
    state.organizations = [];
    state.selectedOrganization = null;
    state.projectSettings = null;
    state.rebuses = [];
    state.selectedRebus = null;
    $('logout-button').hidden = true;
    $('supabase-login-button').hidden = false;
    updateAuthStatus();
    state.organizationPickerOpen = false;
    renderOrganizations();
    renderRebusList();
    renderEmptyRebus();
  }

  async function logout() {
    if (state.supabase) await state.supabase.auth.signOut();
    clearSupabaseSession();
  }

  async function localApi(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...localHeaders(), ...(options.headers || {}) }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API-feil');
    return data;
  }

  async function handleGoogleCredential(response) {
    const data = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    }).then(async result => {
      const payload = await result.json();
      if (!result.ok) throw new Error(payload.error || 'Google-login feilet.');
      return payload;
    });
    setLocalTeacher(data.teacher);
    await loadRebuses();
    await loadLive();
  }

  async function devLogin() {
    if (!state.config.allowDevAuth || state.config.googleClientId) return;
    state.teacherEmail = $('teacher-email').value.trim() || 'teacher@example.com';
    const response = await fetch('/api/auth/google/dev', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: state.teacherEmail })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Dev-login feilet.');
    setLocalTeacher(data.teacher);
    await loadRebuses();
    await loadLive();
  }

  function setLocalTeacher(teacher) {
    state.teacher = teacher;
    state.teacherEmail = teacher.email;
    localStorage.setItem('teacherEmail', teacher.email);
    $('teacher-email').value = teacher.email;
    updateAuthStatus();
  }

  function updateAuthStatus() {
    const status = $('auth-status');
    if (!status) return;
    const signedInEmail = state.user?.email || state.teacher?.email || '';
    if (signedInEmail) {
      const name = state.user?.user_metadata?.full_name || state.user?.user_metadata?.name || state.teacher?.name || signedInEmail;
      status.textContent = `Innlogget: ${name}`;
      status.title = signedInEmail;
      status.classList.add('signed-in');
    } else {
      status.textContent = state.mode === 'supabase' ? 'Ikke innlogget' : 'Dev-modus';
      status.title = '';
      status.classList.remove('signed-in');
    }
  }

  function cleanAuthUrl() {
    if (window.location.hash || window.location.search.includes('code=')) {
      history.replaceState(null, document.title, window.location.pathname);
    }
  }

  async function loadOrganizations() {
    if (state.mode !== 'supabase') return;
    const { data, error } = await state.supabase
      .from('organizations')
      .select('id, name, created_at, project_settings(*)')
      .order('created_at', { ascending: true });
    if (error) throw error;
    state.organizations = data || [];
    if (!state.selectedOrganization && state.organizations.length) {
      await selectOrganization(state.organizations[0].id);
    } else {
      renderOrganizations();
    }
  }

  async function createOrganization() {
    if (state.mode !== 'supabase') return alert('Organisasjoner krever Supabase-modus.');
    const name = $('organization-name').value.trim();
    if (!name) return;
    const { error } = await state.supabase
      .from('organizations')
      .insert({ name, created_by: state.user.id });
    if (error) throw error;
    $('organization-name').value = '';
    state.selectedOrganization = null;
    state.organizationPickerOpen = false;
    await loadOrganizations();
  }

  async function selectOrganization(id) {
    state.selectedOrganization = state.organizations.find(org => org.id === id) || null;
    state.organizationPickerOpen = false;
    await loadProjectSettings();
    await loadRebuses();
    renderOrganizations();
    configureMapsUi();
  }

  function renderOrganizations() {
    $('selected-organization-card').innerHTML = state.selectedOrganization
      ? `<strong>${escapeHtml(state.selectedOrganization.name)}</strong><p class="muted">Aktiv organisasjon</p>`
      : '<p class="muted">Ingen organisasjon valgt.</p>';
    $('toggle-organization-picker-button').textContent = state.selectedOrganization ? 'Bytt org' : 'Velg eller lag org';
    $('organization-picker').hidden = !state.organizationPickerOpen;
    $('organization-list').innerHTML = state.organizations.length
      ? state.organizations.map(org => `
        <button class="ghost" data-org-id="${escapeHtml(org.id)}">
          ${state.selectedOrganization?.id === org.id ? '✓ ' : ''}${escapeHtml(org.name)}
        </button>
      `).join('')
      : '<p class="muted">Ingen organisasjoner ennå.</p>';

    document.querySelectorAll('[data-org-id]').forEach(button => {
      button.addEventListener('click', () => selectOrganization(button.dataset.orgId).catch(error => alert(error.message)));
    });
  }

  function toggleOrganizationPicker() {
    state.organizationPickerOpen = !state.organizationPickerOpen;
    renderOrganizations();
  }

  async function loadProjectSettings() {
    if (state.mode !== 'supabase' || !state.selectedOrganization) return;
    const { data, error } = await state.supabase
      .from('project_settings')
      .select('*')
      .eq('organization_id', state.selectedOrganization.id)
      .maybeSingle();
    if (error) throw error;
    state.projectSettings = data;
    $('org-maps-key').value = data?.google_maps_api_key || '';
  }

  async function saveProjectSettings() {
    if (state.mode !== 'supabase' || !state.selectedOrganization) return alert('Velg organisasjon først.');
    const { data, error } = await state.supabase
      .from('project_settings')
      .upsert({
        organization_id: state.selectedOrganization.id,
        google_maps_api_key: $('org-maps-key').value.trim() || null
      })
      .select()
      .single();
    if (error) throw error;
    state.projectSettings = data;
    configureMapsUi(true);
  }

  function currentMapsKey() {
    return state.projectSettings?.google_maps_api_key || state.config.googleMapsApiKey || '';
  }

  function configureMapsUi(forceReload = false) {
    const mapsKey = currentMapsKey();
    if (!mapsKey) {
      $('maps-status').textContent = 'Google Maps API-nøkkel mangler. Legg inn nøkkel på organisasjonen, eller fyll koordinater manuelt.';
      return;
    }
    if (state.loadedMapsKey === mapsKey && !forceReload) return;

    const mapsUrl = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(mapsKey)}&libraries=places`;
    loadScript(mapsUrl, forceReload ? 'google-maps-script' : null)
      .then(() => {
        state.loadedMapsKey = mapsKey;
        initMapPicker();
      })
      .catch(() => {
        $('maps-status').textContent = 'Kunne ikke laste Google Maps. Manuell koordinatmodus er aktiv.';
      });
  }

  function initMapPicker() {
    const fallbackCenter = { lat: 60.79823355219047, lng: 10.674827839521527 };
    const existingLocation = currentLocationFields();
    const initialCenter = existingLocation || fallbackCenter;
    const mapElement = $('task-map');
    mapElement.classList.add('is-live');
    mapElement.textContent = '';

    state.map = new google.maps.Map(mapElement, {
      center: initialCenter,
      zoom: 15,
      mapTypeControl: true,
      streetViewControl: false,
      fullscreenControl: true
    });

    state.marker = new google.maps.Marker({
      map: state.map,
      position: initialCenter,
      draggable: true
    });
    if (existingLocation) {
      setPickedLocation(existingLocation.lat, existingLocation.lng, $('task-location-label').value);
      focusMapOnLocation(existingLocation.lat, existingLocation.lng);
    } else {
      setLocationFields(fallbackCenter.lat, fallbackCenter.lng, 'Fastland');
    }

    state.map.addListener('click', event => {
      setPickedLocation(event.latLng.lat(), event.latLng.lng(), $('task-location-label').value);
    });
    state.marker.addListener('dragend', event => {
      setPickedLocation(event.latLng.lat(), event.latLng.lng(), $('task-location-label').value);
    });

    if (google.maps.places && google.maps.places.Autocomplete) {
      state.autocomplete = new google.maps.places.Autocomplete($('place-search'), {
        fields: ['geometry', 'name', 'formatted_address']
      });
      state.autocomplete.addListener('place_changed', () => {
        const place = state.autocomplete.getPlace();
        if (!place.geometry || !place.geometry.location) return;
        const label = place.name || place.formatted_address || '';
        setPickedLocation(place.geometry.location.lat(), place.geometry.location.lng(), label);
        state.map.panTo(place.geometry.location);
        state.map.setZoom(17);
      });
    }

    $('maps-status').textContent = 'Kartvelger aktiv. Søk etter sted, klikk i kartet eller dra markøren.';
  }

  function setPickedLocation(lat, lng, label) {
    setLocationFields(lat, lng, label);
    if (state.marker) state.marker.setPosition({ lat, lng });
  }

  function focusMapOnLocation(lat, lng) {
    if (!state.map || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    state.map.panTo({ lat, lng });
    state.map.setZoom(17);
    if (state.marker) state.marker.setPosition({ lat, lng });
  }

  function setLocationFields(lat, lng, label) {
    $('task-lat').value = Number(lat).toFixed(7);
    $('task-lng').value = Number(lng).toFixed(7);
    if (label) $('task-location-label').value = label;
  }

  function currentLocationFields() {
    const lat = parseCoordinate($('task-lat').value);
    const lng = parseCoordinate($('task-lng').value);
    return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
  }

  function parseCoordinate(value) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) return NaN;
    return Number(trimmed);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return alert('Nettleseren støtter ikke posisjon.');
    navigator.geolocation.getCurrentPosition(position => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      setPickedLocation(lat, lng, 'Min posisjon');
      if (state.map) {
        state.map.panTo({ lat, lng });
        state.map.setZoom(17);
      }
    }, () => alert('Kunne ikke hente posisjonen din.'), { enableHighAccuracy: true, timeout: 12000 });
  }

  async function loadRebuses() {
    if (state.mode === 'supabase') return loadSupabaseRebuses();
    const data = await localApi('/api/admin/rebuses');
    state.rebuses = data.rebuses || [];
    $('rebus-count').textContent = String(state.rebuses.length);
    renderRebusList();
  }

  async function loadSupabaseRebuses() {
    if (!state.selectedOrganization) {
      state.rebuses = [];
      renderRebusList();
      return;
    }
    const { data, error } = await state.supabase
      .from('rebuses')
      .select('*, tasks(id), students(id)')
      .eq('organization_id', state.selectedOrganization.id)
      .order('created_at', { ascending: true });
    if (error) throw error;
    state.rebuses = (data || []).map(rebus => ({
      ...rebus,
      taskCount: rebus.tasks?.length || 0,
      studentCount: rebus.students?.length || 0
    }));
    $('rebus-count').textContent = String(state.rebuses.length);
    renderRebusList();
  }

  async function selectRebus(id) {
    if (state.mode === 'supabase') {
      const { data, error } = await state.supabase
        .from('rebuses')
        .select('*, rebus_stops(*), tasks(*, task_options(*), task_assets(*), task_hints(*)), students(id, display_name, username, password_hash, team_name, created_at)')
        .eq('id', id)
        .single();
      if (error) throw error;
      state.selectedRebus = normalizeSupabaseRebus(data);
    } else {
      const data = await localApi(`/api/admin/rebuses/${id}`);
      state.selectedRebus = data.rebus;
    }
    renderSelectedRebus();
    renderStopSelect();
  }

  function normalizeSupabaseRebus(rebus) {
    return {
      ...rebus,
      title: rebus.title,
      description: rebus.description,
      stops: (rebus.rebus_stops || []).sort((a, b) => a.sort_order - b.sort_order),
      tasks: (rebus.tasks || []).sort((a, b) => a.sort_order - b.sort_order).map(task => ({
        ...task,
        order: task.sort_order,
        geofenceRadiusMeters: task.geofence_radius_meters,
        options: (task.task_options || []).sort((a, b) => a.sort_order - b.sort_order),
        assets: (task.task_assets || []).sort((a, b) => a.sort_order - b.sort_order),
        hints: (task.task_hints || []).sort((a, b) => a.sort_order - b.sort_order),
        location: Number.isFinite(task.latitude) && Number.isFinite(task.longitude)
          ? { lat: task.latitude, lng: task.longitude, label: task.location_label }
          : null
      })),
      students: (rebus.students || []).map(student => ({
        ...student,
        displayName: student.display_name,
        teamName: student.team_name,
        password: visiblePassword(student.password_hash)
      }))
    };
  }

  function renderRebusList() {
    $('rebus-list').innerHTML = state.rebuses.length
      ? state.rebuses.map(rebus => `
        <button class="ghost" data-rebus-id="${escapeHtml(rebus.id)}">
          ${escapeHtml(rebus.title)} (${rebus.taskCount || 0} oppgaver, ${rebus.studentCount || 0} elever)
        </button>
      `).join('')
      : '<p class="muted">Ingen rebuser ennå.</p>';

    document.querySelectorAll('[data-rebus-id]').forEach(button => {
      button.addEventListener('click', () => selectRebus(button.dataset.rebusId).catch(error => alert(error.message)));
    });
  }

  function renderSelectedRebus() {
    const rebus = state.selectedRebus;
    if (!rebus) return;
    $('selected-title').textContent = rebus.title;
    $('selected-description').textContent = rebus.description || 'Ingen beskrivelse.';
    $('rebus-settings').hidden = false;
    $('edit-rebus-title').value = rebus.title || '';
    $('edit-rebus-description').value = rebus.description || '';
    $('task-list').innerHTML = rebus.tasks.length
      ? renderTasksGroupedByStop(rebus)
      : '<p class="muted">Ingen oppgaver ennå. Trykk “Ny oppgave” for å lage den første. Første oppgave blir start, siste blir mål.</p>';
    renderGroupList();
    setDefaultGroupFields();
    bindTaskListActions();
  }

  function renderEmptyRebus() {
    $('selected-title').textContent = 'Velg en rebus';
    $('selected-description').textContent = 'Når en rebus er valgt kan du legge til oppgaver, grupper og se live status.';
    $('rebus-settings').hidden = true;
    $('task-list').innerHTML = '';
    $('group-list').innerHTML = '';
    $('live-body').innerHTML = '<tr><td colspan="5" class="muted">Velg en rebus først.</td></tr>';
    renderStopSelect();
  }

  function renderGroupList() {
    const students = state.selectedRebus?.students || [];
    $('group-list').innerHTML = students.length
      ? students.map(student => {
        const groupName = groupDisplayName(student);
        const username = student.username || '';
        const password = groupPassword(student);
        const suggestedPassword = password || generateAccessCode();
        return `
          <article class="task-card group-card ${password ? '' : 'missing-code'}">
            <div>
              <label><span>Gruppenavn</span><input data-group-name="${escapeHtml(student.id)}" value="${escapeHtml(groupName)}"></label>
              <label><span>Brukernavn</span><input data-group-username="${escapeHtml(student.id)}" value="${escapeHtml(username)}"></label>
              <dl class="group-login-details">
                <div><dt>Brukernavn</dt><dd><code>${escapeHtml(username || '-')}</code></dd></div>
                <div><dt>Kode</dt><dd><code>${escapeHtml(password || suggestedPassword)}</code></dd></div>
              </dl>
              ${password ? '' : '<p class="notice compact-notice">Denne gruppen manglet kode. Ny kode er foreslått i feltet til høyre. Trykk “Lagre kode”.</p>'}
            </div>
            <div class="group-password-tools">
              <input data-group-password="${escapeHtml(student.id)}" value="${password ? '' : escapeHtml(suggestedPassword)}" placeholder="Ny kode">
              <button class="ghost compact" type="button" data-generate-password="${escapeHtml(student.id)}">Generer</button>
              <button class="compact" type="button" data-save-password="${escapeHtml(student.id)}">Lagre kode</button>
              <button class="ghost compact" type="button" data-copy-login="${escapeHtml(student.id)}">Kopier</button>
              <button class="ghost compact" type="button" data-save-group="${escapeHtml(student.id)}">Lagre gruppe</button>
              <button class="danger compact" type="button" data-delete-group="${escapeHtml(student.id)}">Slett</button>
            </div>
          </article>
        `;
      }).join('')
      : '<p class="muted">Ingen grupper ennå.</p>';

    document.querySelectorAll('[data-generate-password]').forEach(button => {
      button.addEventListener('click', () => {
        const input = document.querySelector(`[data-group-password="${cssEscape(button.dataset.generatePassword)}"]`);
        if (input) input.value = generateAccessCode();
      });
    });
    document.querySelectorAll('[data-save-password]').forEach(button => {
      button.addEventListener('click', () => updateGroupPassword(button.dataset.savePassword).catch(error => alert(error.message)));
    });
    document.querySelectorAll('[data-copy-login]').forEach(button => {
      button.addEventListener('click', () => copyGroupLogin(button.dataset.copyLogin).catch(error => alert(error.message)));
    });
    document.querySelectorAll('[data-save-group]').forEach(button => {
      button.addEventListener('click', () => updateGroup(button.dataset.saveGroup).catch(error => alert(error.message)));
    });
    document.querySelectorAll('[data-delete-group]').forEach(button => {
      button.addEventListener('click', () => deleteGroup(button.dataset.deleteGroup).catch(error => alert(error.message)));
    });
  }

  async function copyGroupLogin(studentId) {
    const student = state.selectedRebus?.students?.find(item => item.id === studentId);
    if (!student) return;
    const input = document.querySelector(`[data-group-password="${cssEscape(studentId)}"]`);
    const password = groupPassword(student) || input?.value || '';
    const text = `${groupDisplayName(student)}\nBrukernavn: ${student.username || ''}\nKode: ${password}`;
    await navigator.clipboard.writeText(text);
    alert('Innlogging kopiert.');
  }

  function exportGroups() {
    const groups = sortedGroups();
    if (!groups.length) return alert('Ingen grupper å eksportere.');
    const rows = [
      ['Gruppe', 'Brukernavn', 'Kode'],
      ...groups.map(group => [groupDisplayName(group), group.username || '', groupPassword(group)])
    ];
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${slugify(state.selectedRebus?.title || 'rebus')}-grupper.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  }

  function printGroups() {
    const groups = sortedGroups();
    if (!groups.length) return alert('Ingen grupper å printe.');
    const title = state.selectedRebus?.title || 'Rebus';
    const rows = groups.map(group => `
      <tr>
        <td>${escapeHtml(groupDisplayName(group))}</td>
        <td>${escapeHtml(group.username || '')}</td>
        <td>${escapeHtml(groupPassword(group))}</td>
      </tr>
    `).join('');
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return alert('Nettleseren blokkerte utskriftsvinduet.');
    printWindow.document.write(`
      <!doctype html>
      <html lang="no">
      <head>
        <meta charset="utf-8">
        <title>${escapeHtml(title)} - grupper</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 32px; color: #172033; }
          h1 { margin: 0 0 20px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cfd8e3; padding: 10px; text-align: left; font-size: 16px; }
          th { background: #eef3f8; }
          td:last-child { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 700; }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(title)} - grupper</h1>
        <table>
          <thead><tr><th>Gruppe</th><th>Brukernavn</th><th>Kode</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function sortedGroups() {
    return [...(state.selectedRebus?.students || [])].sort((a, b) => groupDisplayName(a).localeCompare(groupDisplayName(b), 'no', { numeric: true }));
  }

  function groupDisplayName(student) {
    return student.teamName || student.team_name || student.displayName || student.display_name || student.username || 'Gruppe uten navn';
  }

  function groupPassword(student) {
    return student.password || visiblePassword(student.password_hash) || '';
  }

  function visiblePassword(passwordHash) {
    const value = String(passwordHash || '');
    return value.startsWith('plain:') ? value.slice(6) : '';
  }

  function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
  }

  function renderTasksGroupedByStop(rebus) {
    const stops = rebus.stops || [];
    const stopById = new Map(stops.map(stop => [stop.id, stop]));
    const groups = stops.map(stop => ({
      stop,
      tasks: rebus.tasks.filter(task => task.stop_id === stop.id)
    }));
    const looseTasks = rebus.tasks.filter(task => !task.stop_id || !stopById.has(task.stop_id));
    if (looseTasks.length) groups.push({ stop: null, tasks: looseTasks });

    return groups
      .filter(group => group.tasks.length)
      .map(group => `
        <section class="task-group">
          <h3>${group.stop ? escapeHtml(group.stop.title) : 'Uten stopp'}</h3>
          ${group.stop ? `<p class="muted">${escapeHtml(group.stop.location_label || '')} ${group.stop.latitude ? `${group.stop.latitude}, ${group.stop.longitude}` : ''}</p>` : ''}
          ${group.tasks.map(renderTaskCard).join('')}
        </section>
      `).join('');
  }

  function renderTaskCard(task) {
    const orderedTasks = state.selectedRebus.tasks;
    const index = orderedTasks.findIndex(item => item.id === task.id);
    const badge = index === 0 ? 'Start' : index === orderedTasks.length - 1 ? 'Mål' : `Oppgave ${index + 1}`;
    return `
      <article class="task-card">
        <div class="task-card-header">
          <strong>${badge}: ${escapeHtml(task.title)}</strong>
          <span class="toolbar">
            <button class="ghost compact" type="button" data-move-task="${escapeHtml(task.id)}" data-direction="up" ${index === 0 ? 'disabled' : ''}>Opp</button>
            <button class="ghost compact" type="button" data-move-task="${escapeHtml(task.id)}" data-direction="down" ${index === orderedTasks.length - 1 ? 'disabled' : ''}>Ned</button>
            <button class="ghost compact" type="button" data-edit-task="${escapeHtml(task.id)}">Rediger</button>
          </span>
        </div>
        <p>${escapeHtml(task.prompt || task.description || 'Ingen oppgavetekst.')}</p>
        <small>${escapeHtml(task.type)} · ${task.points} poeng · ${task.location ? `${task.location.lat}, ${task.location.lng}` : 'Ingen egen lokasjon'}</small>
        ${task.options?.length ? `<p><strong>Alternativer:</strong> ${task.options.map(option => `${option.is_correct ? '✓ ' : ''}${escapeHtml(option.label)}`).join(' · ')}</p>` : ''}
        ${task.config?.numberRules ? `<p><strong>Tall:</strong> Riktig ${escapeHtml(task.config.numberRules.correctValue)}${task.config.numberRules.useTolerance ? ` · ${task.config.numberRules.bands.map(band => `±${band.maxDeviation}: ${band.points}p`).join(' · ')}` : ''}</p>` : ''}
        ${task.assets?.length ? `<p><strong>Media:</strong> ${task.assets.map(asset => `<a href="${escapeHtml(asset.url || '#')}" target="_blank" rel="noreferrer">${escapeHtml(asset.title || asset.type)}</a>`).join(' · ')}</p>` : ''}
        ${task.hints?.length ? `<p><strong>Hint:</strong> ${task.hints.map(hint => escapeHtml(hint.body)).join(' · ')}</p>` : ''}
      </article>
    `;
  }

  function bindTaskListActions() {
    document.querySelectorAll('[data-edit-task]').forEach(button => {
      button.addEventListener('click', () => openTaskEditor(button.dataset.editTask));
    });
    document.querySelectorAll('[data-move-task]').forEach(button => {
      button.addEventListener('click', () => moveTask(button.dataset.moveTask, button.dataset.direction).catch(error => alert(error.message)));
    });
  }

  function renderStopSelect() {
    const select = $('task-stop-select');
    const stops = state.selectedRebus?.stops || [];
    select.innerHTML = '<option value="">Ingen stopp valgt</option>' + stops.map(stop => `<option value="${escapeHtml(stop.id)}">${escapeHtml(stop.title)}</option>`).join('');
    if (state.selectedStopId && stops.some(stop => stop.id === state.selectedStopId)) {
      select.value = state.selectedStopId;
    } else {
      state.selectedStopId = '';
      select.value = '';
    }
  }

  async function createRebus() {
    if (state.mode === 'supabase') {
      if (!state.selectedOrganization) return alert('Opprett eller velg en organisasjon først.');
      const { error } = await state.supabase.from('rebuses').insert({
        organization_id: state.selectedOrganization.id,
        title: $('rebus-title').value.trim() || 'Ny rebus',
        description: $('rebus-description').value.trim(),
        created_by: state.user.id
      });
      if (error) throw error;
    } else {
      await localApi('/api/admin/rebuses', {
        method: 'POST',
        body: JSON.stringify({
          title: $('rebus-title').value.trim(),
          description: $('rebus-description').value.trim()
        })
      });
    }
    $('rebus-title').value = '';
    $('rebus-description').value = '';
    await loadRebuses();
  }

  async function updateRebus() {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const title = $('edit-rebus-title').value.trim() || 'Ny rebus';
    const description = $('edit-rebus-description').value.trim();

    if (state.mode === 'supabase') {
      const { error } = await state.supabase
        .from('rebuses')
        .update({ title, description })
        .eq('id', state.selectedRebus.id);
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, description })
      });
    }

    await selectRebus(state.selectedRebus.id);
    await loadRebuses();
  }

  async function deleteRebus() {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const title = state.selectedRebus.title;
    const confirmed = confirm(`Slette "${title}"? Dette fjerner rebusen, oppgaver, grupper og progresjon.`);
    if (!confirmed) return;

    if (state.mode === 'supabase') {
      const { error } = await state.supabase
        .from('rebuses')
        .delete()
        .eq('id', state.selectedRebus.id);
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}`, {
        method: 'DELETE'
      });
    }

    state.selectedRebus = null;
    state.selectedStopId = '';
    renderEmptyRebus();
    await loadRebuses();
    await loadLive();
  }

  async function createTask() {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const lat = parseCoordinate($('task-lat').value);
    const lng = parseCoordinate($('task-lng').value);
    const location = Number.isFinite(lat) && Number.isFinite(lng)
      ? { lat, lng, label: $('task-location-label').value.trim() || $('task-title').value.trim() }
      : null;
    const nextOrder = state.editingTaskId
      ? (state.selectedRebus.tasks.find(task => task.id === state.editingTaskId)?.sort_order || state.selectedRebus.tasks.find(task => task.id === state.editingTaskId)?.order || 1)
      : (state.selectedRebus.tasks?.length || 0) + 1;

    if (state.mode === 'supabase') {
      const payload = {
        rebus_id: state.selectedRebus.id,
        title: $('task-title').value.trim() || 'Ny oppgave',
        type: $('task-type').value,
        prompt: $('task-prompt').value.trim(),
        answer: $('task-answer').value.trim() || null,
        stop_id: state.selectedStopId || null,
        points: Number($('task-points').value || 0),
        sort_order: nextOrder,
        max_attempts: $('task-max-attempts').value ? Number($('task-max-attempts').value) : null,
        geofence_radius_meters: Number($('task-radius').value || 30),
        location_label: location?.label || null,
        latitude: location?.lat || null,
        longitude: location?.lng || null,
        config: {
          answerMode: $('task-type').value,
          createdInBuilder: true,
          hasTeacherMedia: state.assetRows.length > 0,
          ...(buildNumberRules() ? { numberRules: buildNumberRules() } : {})
        }
      };
      if (state.editingTaskId) {
        const { data: updatedTask, error } = await state.supabase
          .from('tasks')
          .update(payload)
          .eq('id', state.editingTaskId)
          .select()
          .single();
        if (error) throw error;
        await replaceRichTaskChildren(updatedTask.id);
      } else {
        const { data: insertedTask, error } = await state.supabase.from('tasks').insert(payload).select().single();
      if (error) throw error;
      await createRichTaskChildren(insertedTask.id);
      }
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}/tasks`, {
        method: 'POST',
        body: JSON.stringify({
          title: $('task-title').value.trim(),
          type: $('task-type').value,
          prompt: $('task-prompt').value.trim(),
          answer: $('task-answer').value.trim(),
          points: Number($('task-points').value || 0),
          maxAttempts: $('task-max-attempts').value ? Number($('task-max-attempts').value) : null,
          geofenceRadiusMeters: Number($('task-radius').value || 30),
          location
        })
      });
    }
    clearTaskForm();
    closeTaskEditor();
    await selectRebus(state.selectedRebus.id);
    await loadRebuses();
  }

  function clearTaskForm() {
    $('task-title').value = '';
    $('task-prompt').value = '';
    $('task-answer').value = '';
    $('task-max-attempts').value = '';
    resetTaskBuilder();
    updateTaskTypeUi();
  }

  function openTaskEditor(taskId = null) {
    state.editingTaskId = taskId;
    $('task-editor').hidden = false;
    $('task-editor-title').textContent = taskId ? 'Rediger oppgave' : 'Ny oppgave';
    $('create-task-button').textContent = taskId ? 'Lagre endringer' : 'Lagre oppgave';
    if (!taskId) {
      clearTaskForm();
      return;
    }
    const task = state.selectedRebus.tasks.find(item => item.id === taskId);
    if (!task) return;
    fillTaskForm(task);
  }

  function closeTaskEditor() {
    state.editingTaskId = null;
    $('task-editor').hidden = true;
  }

  function fillTaskForm(task) {
    const lat = task.latitude ?? task.location?.lat ?? task.stop?.location?.lat ?? '';
    const lng = task.longitude ?? task.location?.lng ?? task.stop?.location?.lng ?? '';
    const label = task.location_label || task.location?.label || task.stop?.location?.label || '';
    $('task-title').value = task.title || '';
    $('task-type').value = task.type || 'text';
    $('task-points').value = task.points || 0;
    $('task-max-attempts').value = task.max_attempts || '';
    $('task-lat').value = lat;
    $('task-lng').value = lng;
    $('task-location-label').value = label;
    $('task-radius').value = task.geofence_radius_meters || 30;
    $('task-prompt').value = task.prompt || '';
    $('task-answer').value = task.answer || '';
    state.selectedStopId = task.stop_id || '';
    renderStopSelect();
    state.optionRows = task.options?.length ? task.options.map(option => ({
      id: crypto.randomUUID(),
      label: option.label,
      isCorrect: option.is_correct
    })) : state.optionRows;
    state.assetRows = task.assets?.map(asset => ({
      id: crypto.randomUUID(),
      type: asset.type,
      title: asset.title || '',
      url: asset.url || '',
      fileName: ''
    })) || [];
    state.hintRows = task.hints?.map(hint => ({
      id: crypto.randomUUID(),
      body: hint.body
    })) || [];
    if (task.config?.numberRules) {
      $('number-correct-value').value = task.config.numberRules.correctValue;
      $('number-use-tolerance').checked = Boolean(task.config.numberRules.useTolerance);
      state.numberBands = task.config.numberRules.bands.map(band => ({
        id: crypto.randomUUID(),
        maxDeviation: band.maxDeviation,
        points: band.points
      }));
    }
    renderOptionRows();
    renderAssetRows();
    renderHintRows();
    renderNumberBands();
    updateTaskTypeUi();
    const parsedLat = parseCoordinate(lat);
    const parsedLng = parseCoordinate(lng);
    if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
      focusMapOnLocation(parsedLat, parsedLng);
    }
  }

  async function replaceRichTaskChildren(taskId) {
    await Promise.all([
      state.supabase.from('task_options').delete().eq('task_id', taskId),
      state.supabase.from('task_assets').delete().eq('task_id', taskId),
      state.supabase.from('task_hints').delete().eq('task_id', taskId)
    ]);
    await createRichTaskChildren(taskId);
  }

  async function moveTask(taskId, direction) {
    const tasks = [...state.selectedRebus.tasks].sort((a, b) => a.sort_order - b.sort_order);
    const index = tasks.findIndex(task => task.id === taskId);
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || targetIndex < 0 || targetIndex >= tasks.length) return;
    const current = tasks[index];
    const target = tasks[targetIndex];
    const { error: firstError } = await state.supabase.from('tasks').update({ sort_order: target.sort_order }).eq('id', current.id);
    if (firstError) throw firstError;
    const { error: secondError } = await state.supabase.from('tasks').update({ sort_order: current.sort_order }).eq('id', target.id);
    if (secondError) throw secondError;
    await selectRebus(state.selectedRebus.id);
  }

  async function createRichTaskChildren(taskId) {
    const options = collectOptions(taskId);
    const assets = collectAssets(taskId);
    const hints = collectHints(taskId);

    if (options.length) {
      const { error } = await state.supabase.from('task_options').insert(options);
      if (error) throw error;
    }
    if (assets.length) {
      const { error } = await state.supabase.from('task_assets').insert(assets);
      if (error) throw error;
    }
    if (hints.length) {
      const { error } = await state.supabase.from('task_hints').insert(hints);
      if (error) throw error;
    }
  }

  function resetTaskBuilder() {
    state.optionRows = [
      { id: crypto.randomUUID(), label: '', isCorrect: true },
      { id: crypto.randomUUID(), label: '', isCorrect: false },
      { id: crypto.randomUUID(), label: '', isCorrect: false }
    ];
    state.assetRows = [];
    state.hintRows = [];
    state.numberBands = [
      { id: crypto.randomUUID(), maxDeviation: 0, points: Number($('task-points').value || 5) },
      { id: crypto.randomUUID(), maxDeviation: 1, points: Math.max(0, Number($('task-points').value || 5) - 1) },
      { id: crypto.randomUUID(), maxDeviation: 2, points: Math.max(0, Number($('task-points').value || 5) - 2) }
    ];
    renderOptionRows();
    renderAssetRows();
    renderHintRows();
    renderNumberBands();
  }

  function updateTaskTypeUi() {
    const type = $('task-type').value;
    const usesOptions = type === 'multiple_choice' || type === 'multi_select';
    $('options-builder').hidden = !usesOptions;
    $('number-builder').hidden = type !== 'number';
    $('task-answer').closest('label').hidden = usesOptions || ['number', 'photo', 'video', 'audio', 'teacher_approved'].includes(type);
    if (usesOptions && state.optionRows.length < 3) {
      while (state.optionRows.length < 3) addOptionRow(false);
      renderOptionRows();
    }
  }

  function addOptionRow(shouldRender = true) {
    state.optionRows.push({ id: crypto.randomUUID(), label: '', isCorrect: false });
    if (shouldRender) renderOptionRows();
  }

  function addAssetRow() {
    state.assetRows.push({ id: crypto.randomUUID(), type: 'image', title: '', url: '', fileName: '' });
    renderAssetRows();
  }

  function addHintRow() {
    state.hintRows.push({ id: crypto.randomUUID(), body: '' });
    renderHintRows();
  }

  function addNumberBand() {
    const last = state.numberBands[state.numberBands.length - 1];
    state.numberBands.push({
      id: crypto.randomUUID(),
      maxDeviation: last ? Number(last.maxDeviation) + 1 : 0,
      points: last ? Math.max(0, Number(last.points) - 1) : 0
    });
    renderNumberBands();
  }

  function renderOptionRows() {
    $('option-rows').innerHTML = state.optionRows.map((row, index) => `
      <div class="builder-row" data-option-id="${row.id}">
        <label class="check-label"><input type="checkbox" data-option-correct ${row.isCorrect ? 'checked' : ''}> Riktig</label>
        <label><span>Alternativ ${index + 1}</span><input data-option-label value="${escapeHtml(row.label)}" placeholder="Skriv svaralternativ"></label>
        <button class="ghost" type="button" data-remove-option ${state.optionRows.length <= 2 ? 'disabled' : ''}>Fjern</button>
      </div>
    `).join('');
    bindOptionRows();
  }

  function renderAssetRows() {
    $('asset-rows').innerHTML = state.assetRows.length ? state.assetRows.map((row, index) => `
      <div class="builder-row media" data-asset-id="${row.id}">
        <label><span>Type</span><select data-asset-type><option value="image" ${row.type === 'image' ? 'selected' : ''}>Bilde</option><option value="audio" ${row.type === 'audio' ? 'selected' : ''}>Lyd</option><option value="video" ${row.type === 'video' ? 'selected' : ''}>Video</option><option value="link" ${row.type === 'link' ? 'selected' : ''}>Lenke</option><option value="document" ${row.type === 'document' ? 'selected' : ''}>Dokument</option></select></label>
        <label><span>Tittel</span><input data-asset-title value="${escapeHtml(row.title)}" placeholder="F.eks. Lydklipp"></label>
        <label><span>URL</span><input data-asset-url value="${escapeHtml(row.url)}" placeholder="https://..."></label>
        <button class="ghost" type="button" data-remove-asset>Fjern</button>
        <label class="file-note"><span>Fil fra maskinen</span><input data-asset-file type="file" accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.ppt,.pptx"></label>
      </div>
    `).join('') : '<p class="muted">Ingen media lagt til. Oppgaven kan fortsatt ha bare tekst.</p>';
    bindAssetRows();
  }

  function renderHintRows() {
    $('hint-rows').innerHTML = state.hintRows.length ? state.hintRows.map((row, index) => `
      <div class="builder-row hint" data-hint-id="${row.id}">
        <label><span>Hint ${index + 1}</span><input data-hint-body value="${escapeHtml(row.body)}" placeholder="Skriv et hint"></label>
        <button class="ghost" type="button" data-remove-hint>Fjern</button>
      </div>
    `).join('') : '<p class="muted">Ingen hint lagt til.</p>';
    bindHintRows();
  }

  function renderNumberBands() {
    $('number-band-rows').innerHTML = state.numberBands.map((row, index) => `
      <div class="builder-row number-band" data-number-band-id="${row.id}">
        <label><span>Avvik maks</span><input data-band-deviation type="number" min="0" step="any" value="${escapeHtml(row.maxDeviation)}"></label>
        <label><span>Poeng</span><input data-band-points type="number" min="0" step="any" value="${escapeHtml(row.points)}"></label>
        <button class="ghost" type="button" data-remove-band ${state.numberBands.length <= 1 ? 'disabled' : ''}>Fjern</button>
        ${index === 0 ? '<p class="file-note">Avvik 0 betyr helt riktig. Avvik 1 betyr ett unna, for eksempel 23 eller 25 når riktig svar er 24.</p>' : ''}
      </div>
    `).join('');
    bindNumberBands();
  }

  function bindOptionRows() {
    document.querySelectorAll('[data-option-id]').forEach(element => {
      const row = state.optionRows.find(item => item.id === element.dataset.optionId);
      element.querySelector('[data-option-label]').addEventListener('input', event => {
        row.label = event.target.value;
      });
      element.querySelector('[data-option-correct]').addEventListener('change', event => {
        row.isCorrect = event.target.checked;
        if ($('task-type').value === 'multiple_choice' && row.isCorrect) {
          state.optionRows.forEach(item => {
            if (item.id !== row.id) item.isCorrect = false;
          });
          renderOptionRows();
        }
      });
      element.querySelector('[data-remove-option]').addEventListener('click', () => {
        state.optionRows = state.optionRows.filter(item => item.id !== row.id);
        renderOptionRows();
      });
    });
  }

  function bindAssetRows() {
    document.querySelectorAll('[data-asset-id]').forEach(element => {
      const row = state.assetRows.find(item => item.id === element.dataset.assetId);
      element.querySelector('[data-asset-type]').addEventListener('change', event => {
        row.type = event.target.value;
      });
      element.querySelector('[data-asset-title]').addEventListener('input', event => {
        row.title = event.target.value;
      });
      element.querySelector('[data-asset-url]').addEventListener('input', event => {
        row.url = event.target.value;
      });
      element.querySelector('[data-asset-file]').addEventListener('change', event => {
        const file = event.target.files && event.target.files[0];
        row.fileName = file ? file.name : '';
        if (file && !row.title) row.title = file.name;
        if (file && !row.url) row.url = `local-file://${file.name}`;
        renderAssetRows();
      });
      element.querySelector('[data-remove-asset]').addEventListener('click', () => {
        state.assetRows = state.assetRows.filter(item => item.id !== row.id);
        renderAssetRows();
      });
    });
  }

  function bindHintRows() {
    document.querySelectorAll('[data-hint-id]').forEach(element => {
      const row = state.hintRows.find(item => item.id === element.dataset.hintId);
      element.querySelector('[data-hint-body]').addEventListener('input', event => {
        row.body = event.target.value;
      });
      element.querySelector('[data-remove-hint]').addEventListener('click', () => {
        state.hintRows = state.hintRows.filter(item => item.id !== row.id);
        renderHintRows();
      });
    });
  }

  function bindNumberBands() {
    document.querySelectorAll('[data-number-band-id]').forEach(element => {
      const row = state.numberBands.find(item => item.id === element.dataset.numberBandId);
      element.querySelector('[data-band-deviation]').addEventListener('input', event => {
        row.maxDeviation = event.target.value;
      });
      element.querySelector('[data-band-points]').addEventListener('input', event => {
        row.points = event.target.value;
      });
      element.querySelector('[data-remove-band]').addEventListener('click', () => {
        state.numberBands = state.numberBands.filter(item => item.id !== row.id);
        renderNumberBands();
      });
    });
  }

  function collectOptions(taskId) {
    const rows = state.optionRows
      .map(row => ({ ...row, label: row.label.trim() }))
      .filter(row => row.label);
    if (!['multiple_choice', 'multi_select'].includes($('task-type').value)) return [];
    return rows.map((row, index) => ({
      task_id: taskId,
      label: row.label,
      is_correct: row.isCorrect,
      sort_order: index + 1
    }));
  }

  function collectAssets(taskId) {
    return state.assetRows
      .map(row => ({
        ...row,
        title: row.title.trim(),
        url: row.url.trim()
      }))
      .filter(row => row.url || row.fileName)
      .map((row, index) => ({
        task_id: taskId,
        type: row.type,
        title: row.title || row.fileName || row.type,
        url: row.url || null,
        sort_order: index + 1
      }));
  }

  function collectHints(taskId) {
    return state.hintRows
      .map(row => row.body.trim())
      .filter(Boolean)
      .map((body, index) => ({
        task_id: taskId,
        body,
        sort_order: index + 1
      }));
  }

  function buildNumberRules() {
    if ($('task-type').value !== 'number') return null;
    const correctValue = Number($('number-correct-value').value);
    if (!Number.isFinite(correctValue)) return null;
    const useTolerance = $('number-use-tolerance').checked;
    const bands = state.numberBands
      .map(row => ({
        maxDeviation: Number(row.maxDeviation),
        points: Number(row.points)
      }))
      .filter(row => Number.isFinite(row.maxDeviation) && Number.isFinite(row.points))
      .sort((a, b) => a.maxDeviation - b.maxDeviation);
    return {
      correctValue,
      useTolerance,
      bands: useTolerance ? bands : [{ maxDeviation: 0, points: Number($('task-points').value || 0) }]
    };
  }

  async function createStudent() {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const groupName = $('group-name').value.trim();
    const username = ($('group-username').value.trim() || slugify(groupName)).toLowerCase();
    const password = $('group-password').value || generateAccessCode();
    if (!groupName) return alert('Skriv inn gruppenavn først.');
    if (!username) return alert('Skriv inn brukernavn først.');
    if (state.mode === 'supabase') {
      const { error } = await state.supabase.from('students').insert({
        rebus_id: state.selectedRebus.id,
        display_name: groupName,
        username,
        password_hash: `plain:${password}`,
        team_name: groupName
      });
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}/students`, {
        method: 'POST',
        body: JSON.stringify({
          displayName: groupName,
          username,
          password,
          teamName: groupName
        })
      });
    }
    $('group-name').value = '';
    $('group-username').value = '';
    $('group-password').value = generateAccessCode();
    state.lastSuggestedGroupName = '';
    state.lastSuggestedGroupUsername = '';
    await selectRebus(state.selectedRebus.id);
    await loadRebuses();
  }

  async function updateGroupPassword(studentId) {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const input = document.querySelector(`[data-group-password="${cssEscape(studentId)}"]`);
    const password = input?.value || '';
    if (!password) return alert('Skriv inn eller generer en ny kode først.');

    if (state.mode === 'supabase') {
      const { error } = await state.supabase
        .from('students')
        .update({ password_hash: `plain:${password}` })
        .eq('id', studentId)
        .eq('rebus_id', state.selectedRebus.id);
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}/students/${studentId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password })
      });
    }

    input.value = '';
    const student = state.selectedRebus.students.find(item => item.id === studentId);
    if (student) {
      student.password = password;
      student.password_hash = `plain:${password}`;
    }
    renderGroupList();
    alert('Koden er oppdatert.');
  }

  async function updateGroup(studentId) {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const name = document.querySelector(`[data-group-name="${cssEscape(studentId)}"]`)?.value.trim();
    const username = document.querySelector(`[data-group-username="${cssEscape(studentId)}"]`)?.value.trim().toLowerCase();
    if (!name || !username) return alert('Gruppenavn og brukernavn må fylles ut.');

    if (state.mode === 'supabase') {
      const { error } = await state.supabase
        .from('students')
        .update({ display_name: name, team_name: name, username })
        .eq('id', studentId)
        .eq('rebus_id', state.selectedRebus.id);
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}/students/${studentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ displayName: name, teamName: name, username })
      });
    }

    await selectRebus(state.selectedRebus.id);
  }

  async function deleteGroup(studentId) {
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const student = state.selectedRebus.students.find(item => item.id === studentId);
    const name = student ? groupDisplayName(student) : 'gruppen';
    if (!confirm(`Slette ${name}? Dette fjerner gruppen og progresjonen deres.`)) return;

    if (state.mode === 'supabase') {
      const { error } = await state.supabase
        .from('students')
        .delete()
        .eq('id', studentId)
        .eq('rebus_id', state.selectedRebus.id);
      if (error) throw error;
    } else {
      await localApi(`/api/admin/rebuses/${state.selectedRebus.id}/students/${studentId}`, {
        method: 'DELETE'
      });
    }

    await selectRebus(state.selectedRebus.id);
    await loadLive();
  }

  async function createStopFromCurrentLocation() {
    if (state.mode !== 'supabase') return alert('Stopp krever Supabase-modus.');
    if (!state.selectedRebus) return alert('Velg en rebus først.');
    const lat = parseCoordinate($('task-lat').value);
    const lng = parseCoordinate($('task-lng').value);
    const nextOrder = (state.selectedRebus.stops?.length || 0) + 1;
    const { data, error } = await state.supabase.from('rebus_stops').insert({
      rebus_id: state.selectedRebus.id,
      title: $('stop-title').value.trim() || $('task-location-label').value.trim() || `Stopp ${nextOrder}`,
      sort_order: nextOrder,
      location_label: $('task-location-label').value.trim() || null,
      latitude: Number.isFinite(lat) ? lat : null,
      longitude: Number.isFinite(lng) ? lng : null,
      geofence_radius_meters: Number($('task-radius').value || 30)
    }).select().single();
    if (error) throw error;
    state.selectedStopId = data.id;
    $('stop-title').value = '';
    await selectRebus(state.selectedRebus.id);
  }

  async function loadLive() {
    if (state.mode === 'supabase') return loadSupabaseLive();
    if (!state.teacher) return;
    const data = await localApi('/api/admin/live');
    renderLive(data.participants || [], data.events || []);
  }

  async function loadSupabaseLive() {
    if (!state.selectedOrganization) return;
    const rebusIds = state.rebuses.map(rebus => rebus.id);
    if (!rebusIds.length) return renderLive([], []);
    const { data: students, error } = await state.supabase
      .from('students')
      .select('id, display_name, username, team_name, rebus_id, progress(points_awarded, correct, task_id, created_at), locations(latitude, longitude, accuracy, created_at), submissions(original_name, content_type, storage_path, storage_bucket, created_at)')
      .in('rebus_id', rebusIds);
    if (error) throw error;
    const participants = (students || []).map(student => {
      const progress = student.progress || [];
      const locations = [...(student.locations || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const submissions = [...(student.submissions || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const latestSubmission = submissions[submissions.length - 1] || null;
      return {
        id: student.id,
        displayName: student.display_name,
        username: student.username,
        score: progress.reduce((sum, item) => sum + (item.points_awarded || 0), 0),
        completedCount: progress.filter(item => item.correct !== false).length,
        latestLocation: locations.length ? {
          lat: locations[locations.length - 1].latitude,
          lng: locations[locations.length - 1].longitude
        } : null,
        latestSubmission: latestSubmission ? {
          originalName: latestSubmission.original_name || latestSubmission.storage_path,
          contentType: latestSubmission.content_type || '',
          url: '#'
        } : null
      };
    });
    renderLive(participants, []);
  }

  function renderLive(participants, events) {
    $('participant-count').textContent = String(participants.length);
    $('event-count').textContent = String(events.length);
    $('live-body').innerHTML = participants.length
      ? participants.map(participant => {
        const loc = participant.latestLocation;
        const locText = loc ? `<a href="https://www.google.com/maps?q=${loc.lat},${loc.lng}" target="_blank" rel="noreferrer">${Number(loc.lat).toFixed(5)}, ${Number(loc.lng).toFixed(5)}</a>` : '-';
        const submission = participant.latestSubmission;
        const submissionText = submission ? `<a href="${escapeHtml(submission.url)}" target="_blank" rel="noreferrer">${escapeHtml(submission.originalName)}</a><br><small>${escapeHtml(submission.contentType)}</small>` : '-';
        return `<tr><td>${escapeHtml(participant.displayName)}</td><td>${participant.score}</td><td>${participant.completedCount}</td><td>${locText}</td><td>${submissionText}</td></tr>`;
      }).join('')
      : '<tr><td colspan="5" class="muted">Ingen aktive elever ennå.</td></tr>';
    renderLiveMap(participants);
  }

  function renderLiveMap(participants) {
    const mapElement = $('live-map');
    if (!mapElement) return;
    const positioned = participants.filter(participant => participant.latestLocation);
    if (!positioned.length) {
      if (!state.liveMap) mapElement.textContent = 'Live-kart vises når grupper sender posisjon.';
      state.liveMarkers.forEach(marker => marker.setMap(null));
      state.liveMarkers.clear();
      return;
    }
    if (!window.google?.maps) {
      mapElement.textContent = 'Kartet lastes når Google Maps er klart.';
      return;
    }
    mapElement.classList.add('is-live');
    if (!state.liveMap) {
      state.liveMap = new google.maps.Map(mapElement, {
        center: positioned[0].latestLocation,
        zoom: 15,
        mapTypeControl: true,
        streetViewControl: false
      });
    }

    const bounds = new google.maps.LatLngBounds();
    const activeIds = new Set();
    positioned.forEach((participant, index) => {
      const id = participant.id || participant.displayName || String(index);
      activeIds.add(id);
      const position = participant.latestLocation;
      bounds.extend(position);
      const label = participant.displayName || `Gruppe ${index + 1}`;
      let marker = state.liveMarkers.get(id);
      if (!marker) {
        marker = new google.maps.Marker({
          map: state.liveMap,
          position,
          label: String(index + 1),
          title: label
        });
        state.liveMarkers.set(id, marker);
      }
      marker.setPosition(position);
      marker.setTitle(label);
      marker.setLabel(String(index + 1));
    });
    state.liveMarkers.forEach((marker, id) => {
      if (!activeIds.has(id)) {
        marker.setMap(null);
        state.liveMarkers.delete(id);
      }
    });
    if (positioned.length === 1) {
      state.liveMap.setCenter(positioned[0].latestLocation);
      state.liveMap.setZoom(16);
    } else {
      state.liveMap.fitBounds(bounds);
    }
  }

  function loadScript(src, id = null) {
    return new Promise((resolve, reject) => {
      if (id) document.getElementById(id)?.remove();
      if (!id && document.querySelector(`script[src="${src}"]`)) return resolve();
      const script = document.createElement('script');
      if (id) script.id = id;
      script.src = src;
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function loadConfig() {
    if (window.REBUS_CONFIG) return normalizeConfig(window.REBUS_CONFIG);
    try {
      const response = await fetch('/api/config', { cache: 'no-store' });
      if (response.ok) return normalizeConfig(await response.json());
    } catch (_error) {
      // GitHub Pages has no local API. Fall back to local demo mode.
    }
    return normalizeConfig({});
  }

  function normalizeConfig(config) {
    return {
      supabaseUrl: config.supabaseUrl || '',
      supabaseAnonKey: config.supabaseAnonKey || '',
      googleClientId: config.googleClientId || '',
      googleMapsApiKey: config.googleMapsApiKey || '',
      allowDevAuth: config.allowDevAuth !== false,
      basePath: config.basePath || ''
    };
  }

  function appUrl(path = '') {
    const basePath = String(state.config?.basePath || '').replace(/\/$/, '');
    const cleanPath = String(path || '').replace(/^\//, '');
    return `${window.location.origin}${basePath}/${cleanPath}`;
  }

  function syncGroupUsername() {
    const suggested = slugify($('group-name').value);
    const current = $('group-username').value.trim();
    if (!current || current === state.lastSuggestedGroupUsername) {
      $('group-username').value = suggested;
      state.lastSuggestedGroupUsername = suggested;
    }
  }

  function setDefaultGroupFields() {
    if (!state.selectedRebus || !$('group-name')) return;
    const suggestedName = nextGroupName();
    const currentName = $('group-name').value.trim();
    if (!currentName || currentName === state.lastSuggestedGroupName) {
      $('group-name').value = suggestedName;
      state.lastSuggestedGroupName = suggestedName;
    }
    syncGroupUsername();
    seedGroupPassword();
  }

  function nextGroupName() {
    const existingNumbers = (state.selectedRebus?.students || [])
      .map(student => student.team_name || student.display_name || '')
      .map(name => String(name).match(/^gruppe\s+(\d+)$/i))
      .filter(Boolean)
      .map(match => Number(match[1]))
      .filter(Number.isFinite);
    const nextNumber = existingNumbers.length ? Math.max(...existingNumbers) + 1 : (state.selectedRebus?.students?.length || 0) + 1;
    return `Gruppe ${nextNumber}`;
  }

  function switchAdminTab(tab) {
    state.activeAdminTab = tab;
    document.querySelectorAll('[data-admin-tab]').forEach(button => {
      button.classList.toggle('active', button.dataset.adminTab === tab);
    });
    document.querySelectorAll('.admin-tab').forEach(panel => {
      panel.hidden = panel.id !== `tab-${tab}`;
    });
    if (tab === 'groups') setDefaultGroupFields();
  }

  function seedGroupPassword() {
    if (!$('group-password').value) $('group-password').value = generateAccessCode();
  }

  function generateAccessCode() {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    const numbers = '23456789';
    const specials = '!?#%';
    const all = `${letters}${numbers}${specials}`;
    const chars = [
      randomChar(letters),
      randomChar(numbers),
      randomChar(specials)
    ];
    while (chars.length < 6) chars.push(randomChar(all));
    return shuffle(chars).join('');
  }

  function randomChar(chars) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return chars[array[0] % chars.length];
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const swapIndex = array[0] % (index + 1);
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function slugify(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/æ/g, 'ae')
      .replace(/ø/g, 'o')
      .replace(/å/g, 'a')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function cssEscape(value) {
    if (window.CSS?.escape) return window.CSS.escape(value);
    return String(value).replace(/["\\]/g, '\\$&');
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  $('supabase-login-button').addEventListener('click', () => signInWithSupabaseGoogle().catch(error => alert(error.message)));
  $('logout-button').addEventListener('click', () => logout().catch(error => alert(error.message)));
  $('login-button').addEventListener('click', () => devLogin().catch(error => alert(error.message)));
  $('toggle-organization-picker-button').addEventListener('click', toggleOrganizationPicker);
  $('create-organization-button').addEventListener('click', () => createOrganization().catch(error => alert(error.message)));
  $('save-settings-button').addEventListener('click', () => saveProjectSettings().catch(error => alert(error.message)));
  $('task-stop-select').addEventListener('change', event => {
    state.selectedStopId = event.target.value;
  });
  $('new-task-button').addEventListener('click', () => openTaskEditor(null));
  $('cancel-task-edit-button').addEventListener('click', closeTaskEditor);
  $('create-stop-button').addEventListener('click', () => createStopFromCurrentLocation().catch(error => alert(error.message)));
  $('task-type').addEventListener('change', updateTaskTypeUi);
  $('add-option-button').addEventListener('click', () => addOptionRow());
  $('add-asset-button').addEventListener('click', addAssetRow);
  $('add-hint-button').addEventListener('click', addHintRow);
  $('add-number-band-button').addEventListener('click', addNumberBand);
  document.querySelectorAll('[data-admin-tab]').forEach(button => {
    button.addEventListener('click', () => switchAdminTab(button.dataset.adminTab));
  });
  $('group-name').addEventListener('input', syncGroupUsername);
  $('group-password').addEventListener('focus', seedGroupPassword);
  $('generate-group-password-button').addEventListener('click', () => {
    $('group-password').value = generateAccessCode();
  });
  $('create-rebus-button').addEventListener('click', () => createRebus().catch(error => alert(error.message)));
  $('save-rebus-button').addEventListener('click', () => updateRebus().catch(error => alert(error.message)));
  $('delete-rebus-button').addEventListener('click', () => deleteRebus().catch(error => alert(error.message)));
  $('create-task-button').addEventListener('click', () => createTask().catch(error => alert(error.message)));
  $('create-student-button').addEventListener('click', () => createStudent().catch(error => alert(error.message)));
  $('export-groups-button').addEventListener('click', exportGroups);
  $('print-groups-button').addEventListener('click', printGroups);
  $('use-current-location-button').addEventListener('click', useCurrentLocation);
  setInterval(() => loadLive().catch(() => {}), 5000);
  boot().catch(error => alert(error.message));
})();
