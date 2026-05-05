(function () {
  const stateEndpoint = teamCode => `/api/team/${encodeURIComponent(teamCode)}/state`;
  const locationEndpoint = teamCode => `/api/team/${encodeURIComponent(teamCode)}/location`;
  let lastLocationSentAt = 0;

  async function postJson(url, payload, useBeacon = false) {
    const body = JSON.stringify(payload);
    if (useBeacon && navigator.sendBeacon) {
      return navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: useBeacon
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  window.BackendSync = {
    async saveTeamState(teamData, options = {}) {
      if (!teamData || !teamData.teamCode) return;
      try {
        await postJson(stateEndpoint(teamData.teamCode), { state: teamData }, Boolean(options.keepalive));
      } catch (error) {
        console.warn('Kunne ikke synke lagstatus til backend:', error);
      }
    },

    async loadTeamState(teamCode) {
      if (!teamCode) return null;
      try {
        const response = await fetch(stateEndpoint(teamCode), { cache: 'no-store' });
        if (!response.ok) return null;
        const data = await response.json();
        return data.team || null;
      } catch (error) {
        console.warn('Kunne ikke hente lagstatus fra backend:', error);
        return null;
      }
    },

    async saveLocation(teamData, position) {
      if (!teamData || !teamData.teamCode || !position || !position.coords) return;
      const now = Date.now();
      if (now - lastLocationSentAt < 5000) return;
      lastLocationSentAt = now;

      try {
        await postJson(locationEndpoint(teamData.teamCode), {
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy || null,
            timestamp: position.timestamp || now
          }
        });
      } catch (error) {
        console.warn('Kunne ikke synke posisjon til backend:', error);
      }
    }
  };
})();
