(function () {
  const tableBody = document.getElementById('team-table-body');
  const eventList = document.getElementById('event-list');
  const tokenInput = document.getElementById('admin-token');
  const connectButton = document.getElementById('connect-button');
  const resetButton = document.getElementById('reset-button');
  const connectionStatus = document.getElementById('connection-status');
  const activeTeams = document.getElementById('active-teams');
  const finishedTeams = document.getElementById('finished-teams');
  const lastUpdated = document.getElementById('last-updated');

  let teams = new Map();
  let events = [];
  let source = null;

  const params = new URLSearchParams(window.location.search);
  tokenInput.value = localStorage.getItem('adminToken') || params.get('token') || '';

  function fmtTime(timestamp) {
    if (!timestamp) return '-';
    return new Date(timestamp).toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function fmtDuration(seconds) {
    if (!seconds && seconds !== 0) return '-';
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  function locationLink(team) {
    if (!team.lastLocation) return '-';
    const { lat, lng, accuracy } = team.lastLocation;
    const label = `${lat.toFixed(5)}, ${lng.toFixed(5)}${accuracy ? ` (${Math.round(accuracy)}m)` : ''}`;
    return `<a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noreferrer">${label}</a>`;
  }

  function render() {
    const sortedTeams = Array.from(teams.values()).sort((a, b) => {
      if (Boolean(a.endTime) !== Boolean(b.endTime)) return Number(a.endTime) - Number(b.endTime);
      return (b.score || 0) - (a.score || 0) || String(a.teamCode).localeCompare(String(b.teamCode));
    });

    activeTeams.textContent = String(sortedTeams.length);
    finishedTeams.textContent = String(sortedTeams.filter(team => team.endTime).length);
    lastUpdated.textContent = fmtTime(Date.now());

    if (!sortedTeams.length) {
      tableBody.innerHTML = '<tr><td colspan="6" class="empty">Ingen lag har startet ennå.</td></tr>';
    } else {
      tableBody.innerHTML = sortedTeams.map(team => {
        const completed = team.completedPostsCount || 0;
        const total = 10;
        const bars = Array.from({ length: total }, (_, index) => `<span class="${index < completed ? 'done' : ''}"></span>`).join('');
        const postText = team.endTime ? `Ferdig (${fmtDuration(team.totalTimeSeconds)})` : (team.currentPostId ? `Post ${team.currentPostId}` : '-');
        return `
          <tr>
            <td><strong>${team.teamName || team.teamCode}</strong><br><small>${team.teamCode}</small></td>
            <td>${postText}</td>
            <td>${team.score || 0}</td>
            <td><div class="progress" aria-label="${completed} av ${total} poster">${bars}</div><small>${completed}/${total}</small></td>
            <td>${fmtTime(team.lastSeen)}</td>
            <td>${locationLink(team)}</td>
          </tr>
        `;
      }).join('');
    }

    const recentEvents = events.slice(-40).reverse();
    eventList.innerHTML = recentEvents.length
      ? recentEvents.map(event => `<li><time>${fmtTime(event.createdAt)} ${event.teamCode || ''}</time>${event.message}</li>`).join('')
      : '<li class="empty">Ingen hendelser ennå.</li>';
  }

  async function loadSnapshot(token) {
    const response = await fetch('/api/admin/snapshot', {
      headers: { 'x-admin-token': token },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('Kunne ikke hente admin-snapshot.');
    const data = await response.json();
    teams = new Map((data.teams || []).map(team => [team.teamCode, team]));
    events = data.events || [];
    render();
  }

  function connect() {
    const token = tokenInput.value.trim();
    if (!token) return;
    localStorage.setItem('adminToken', token);
    if (source) source.close();

    connectionStatus.textContent = 'Kobler til...';
    loadSnapshot(token).catch(error => {
      connectionStatus.textContent = error.message;
    });

    source = new EventSource(`/api/admin/events?token=${encodeURIComponent(token)}`);
    source.addEventListener('open', () => {
      connectionStatus.textContent = 'Tilkoblet live';
    });
    source.addEventListener('snapshot', event => {
      const data = JSON.parse(event.data);
      teams = new Map((data.teams || []).map(team => [team.teamCode, team]));
      events = data.events || [];
      render();
    });
    source.addEventListener('team', event => {
      const team = JSON.parse(event.data);
      teams.set(team.teamCode, team);
      render();
    });
    source.addEventListener('event', event => {
      events.push(JSON.parse(event.data));
      events = events.slice(-100);
      render();
    });
    source.addEventListener('error', () => {
      connectionStatus.textContent = 'Tilkoblingen prøver igjen...';
    });
  }

  connectButton.addEventListener('click', connect);
  resetButton.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token || !confirm('Nullstille all backend-status for alle lag?')) return;
    const response = await fetch('/api/admin/reset', {
      method: 'POST',
      headers: { 'x-admin-token': token }
    });
    if (response.ok) {
      teams = new Map();
      events = [];
      render();
    }
  });

  if (tokenInput.value) connect();
  render();
})();
