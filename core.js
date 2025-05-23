/* Version: #42 */
// Filnavn: core.js

// === GLOBALE VARIABLER ===
let map;
let currentMapMarker;
let userPositionMarker;
let mapElement;
let currentTeamData = null;
let mapPositionWatchId = null;
let finishMarker = null;
let geofenceFeedbackElement = null;
let generalArrivalAudio = null;
let shortPipAudio = null;
let longPipAudio = null;
let preRunPipTimerId = null;
let mobileLogContainer = null;
let postContentContainer = null;
let devModePositionUpdateIntervalId = null; // NY: For fallback i DEV_MODE

// === CoreApp Objekt DEFINERT GLOBALT ===
const CoreApp = {
    registeredPostsData: {},
    isReady: false,

    registerPost: function(postData) {
        if (!postData || typeof postData.id === 'undefined') {
            logToMobile("Ugyldig postData sendt til registerPost.", "error");
            return;
        }
        this.registeredPostsData[postData.id] = postData;
        logToMobile(`Post ${postData.id} (${postData.name || 'Ukjent Navn'}) registrert. Antall: ${Object.keys(this.registeredPostsData).length}`, "info");
    },

    getPostData: function(postId) {
        if (typeof postId === 'string' && postId.startsWith('post-')) {
            postId = parseInt(postId.split('-')[1]);
        }
        return this.registeredPostsData[postId] || null;
    },

    markPostAsCompleted: function(postId, pointsAwarded = 0) {
        logToMobile(`CoreApp.markPostAsCompleted kalt for post ${postId} med ${pointsAwarded} poeng.`, "info");
        if (!currentTeamData || !this.getPostData(postId)) {
            logToMobile(`Kan ikke markere post ${postId} som fullført: mangler team data eller post data.`, "warn");
            return;
        }

        if (!currentTeamData.completedGlobalPosts[`post${postId}`]) {
            currentTeamData.completedGlobalPosts[`post${postId}`] = true;
            currentTeamData.completedPostsCount++;
            currentTeamData.taskCompletionTimes[`post${postId}`] = Date.now();
            currentTeamData.score += pointsAwarded;

            logToMobile(`Post ${postId} markert som fullført. Poeng: ${currentTeamData.score}, Fullførte: ${currentTeamData.completedPostsCount}`, "info");
            saveState();
            document.dispatchEvent(new CustomEvent('scoreUpdated'));
            document.dispatchEvent(new CustomEvent('requestProceedToNext'));

        } else {
            logToMobile(`Post ${postId} var allerede markert som fullført.`, "info");
        }
    },
    setReady: function() {
        this.isReady = true;
        // coreAppReady eventet er ikke lenger nødvendig hvis core.js aktivt kaller definePostX()
        logToMobile("CoreApp er nå satt til klar (etter post-registrering).", "info");
    }
};

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10;
const GEOFENCE_RADIUS = 25;
const DEV_MODE_NO_GEOFENCE = true;
const FINISH_UNLOCK_CODE = "FASTLAND24";
const GEO_RUN_POST_ID = 7;

const START_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Start: Fastland", name: "Start: Fastland" };
const FINISH_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Mål: Fastland", name: "Mål: Fastland" };

// === HJELPEFUNKSJONER (Globale) ===
function calculateDistance(lat1, lon1, lat2, lon2) { const R = 6371e3; const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180; const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c; }
function formatTime(totalSeconds) { if (totalSeconds === null || totalSeconds === undefined) return "00:00"; const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; const paddedHours = String(hours).padStart(2, '0'); const paddedMinutes = String(minutes).padStart(2, '0'); const paddedSeconds = String(seconds).padStart(2, '0'); if (hours > 0) return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`; else return `${paddedMinutes}:${paddedSeconds}`; }
function formatTimeFromMs(ms) { if (ms === null || ms === undefined || ms < 0) return "00:00"; return formatTime(Math.round(ms / 1000)); }

// === Mobil Loggfunksjon ===
function logToMobile(message, level = 'log') { console[level](message); if (mobileLogContainer) { const logEntry = document.createElement('div'); logEntry.textContent = `[${level.toUpperCase()}] ${new Date().toLocaleTimeString()}: ${message}`; logEntry.classList.add('log-entry'); logEntry.classList.add(`log-level-${level}`); mobileLogContainer.appendChild(logEntry); mobileLogContainer.scrollTop = mobileLogContainer.scrollHeight; } }

// === Globale State Management Funksjoner ===
function saveState() { if (currentTeamData) { localStorage.setItem('activeTeamData_Skolerebus', JSON.stringify(currentTeamData)); logToMobile("State saved.", "info"); } else { localStorage.removeItem('activeTeamData_Skolerebus'); logToMobile("State cleared (no team data).", "info"); } }

// === LYDFUNKSJONER ===
function initializeSounds() { try { generalArrivalAudio = new Audio('audio/arrival_medium_pip.wav'); shortPipAudio = new Audio('audio/short_high_pip.wav'); longPipAudio = new Audio('audio/long_high_pip.wav'); logToMobile("Lydobjekter initialisert med faktiske filer.", "info"); if(generalArrivalAudio) generalArrivalAudio.load(); if(shortPipAudio) shortPipAudio.load(); if(longPipAudio) longPipAudio.load(); } catch (e) { logToMobile(`Kunne ikke initialisere Audio objekter: ${e.message}`, "error"); generalArrivalAudio = null; shortPipAudio = null; longPipAudio = null; } }
function playSound(audioObject) { if (audioObject && typeof audioObject.play === 'function') { audioObject.currentTime = 0; audioObject.play().catch(e => logToMobile(`Feil ved avspilling av lyd: ${e.message} (${audioObject.src ? audioObject.src : 'Ukjent lydkilde'})`, "warn")); } else { logToMobile("Fallback: Lydobjekt ikke gyldig for avspilling.", "warn"); } }
function playArrivalSound() { logToMobile("AUDIO: Spiller ankomstlyd (kort pip)...", "debug"); playSound(shortPipAudio); }
async function playGeoRunStartSoundSequence() { logToMobile("AUDIO: Starter Geo-løp lydsekvens...", "debug"); if (shortPipAudio && longPipAudio) { try { await playSoundPromise(shortPipAudio); await delay(150); await playSoundPromise(shortPipAudio); await delay(150); await playSoundPromise(shortPipAudio); await delay(150); await playSoundPromise(longPipAudio); logToMobile("AUDIO: Geo-løp lydsekvens fullført.", "debug"); } catch (e) { logToMobile(`Feil i lydsekvens: ${e.message}`, "warn"); } } else { logToMobile("Fallback: Pip, Pip, Pip, PIIIIIP (Geo-løp start)!", "info"); } }
function playGeoRunTurnSound() { logToMobile("AUDIO: Spiller Geo-løp vendelyd (langt pip)...", "debug"); playSound(longPipAudio); }
function playSoundPromise(audioObject) { return new Promise((resolve, reject) => { if (audioObject && typeof audioObject.play === 'function') { audioObject.currentTime = 0; const playPromise = audioObject.play(); if (playPromise !== undefined) { playPromise.then(() => { audioObject.onended = resolve; }).catch(error => { logToMobile(`Avspillingsfeil (Promise): ${error.message} (${audioObject.src})`, "warn"); reject(error); }); } else { audioObject.onended = resolve; audioObject.onerror = reject; } } else { logToMobile("Fallback: Lydobjekt ikke gyldig for promise-avspilling.", "warn"); resolve(); } }); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { mapElement = document.getElementById('dynamic-map-container'); if (!mapElement) { setTimeout(window.initMap, 500); return; } geofenceFeedbackElement = document.getElementById('geofence-feedback'); const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ]; map = new google.maps.Map(mapElement, { center: START_LOCATION, zoom: 15, mapTypeId: google.maps.MapTypeId.HYBRID, styles: mapStyles, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true, mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID] } }); if (currentTeamData) { if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && !currentTeamData.endTime) { updateMapMarker(null, true); } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; updateMapMarker(currentPostGlobalId, false); } else { updateMapMarker(null, true); } startContinuousUserPositionUpdate(); } logToMobile("Skolerebus Kart initialisert.", "info"); }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false, customLocation = null) { if (!map) { logToMobile("Kart ikke initialisert for updateMapMarker.", "warn"); return; } clearMapMarker(); if (!customLocation) clearFinishMarker(); let locationDetails, markerTitle, markerIconUrl; if (customLocation) { locationDetails = customLocation; markerTitle = customLocation.name || "Spesialpunkt"; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'; } else if (isFinalTarget) { locationDetails = FINISH_LOCATION; markerTitle = FINISH_LOCATION.title; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'; if (finishMarker) finishMarker.setMap(null); finishMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < 16) map.setZoom(16); } return; } else { const postData = CoreApp.getPostData(postGlobalId); if (!postData || typeof postData.lat === 'undefined' || typeof postData.lng === 'undefined') { logToMobile(`Ugyldig postGlobalId (${postGlobalId}) eller post ikke registrert/manglende koordinater for updateMapMarker.`, "warn"); return; } locationDetails = {lat: postData.lat, lng: postData.lng}; markerTitle = `Neste: ${postData.name || `Post ${postGlobalId}`}`; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'; } currentMapMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < (customLocation ? 18 : 15) ) map.setZoom((customLocation ? 18 : 15)); } logToMobile(`Kartmarkør oppdatert til: ${markerTitle}`, "debug");}
function clearMapMarker() { if (currentMapMarker) { currentMapMarker.setMap(null); currentMapMarker = null; } }
function clearFinishMarker() { if (finishMarker) { finishMarker.setMap(null); finishMarker = null; } }

function handleGeolocationError(error, isFromWatchPosition = true) { // NY: isFromWatchPosition parameter
    let msg = "Posisjonsfeil: ";
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg += "Du må tillate posisjonstilgang.";
            break;
        case error.POSITION_UNAVAILABLE:
            msg += "Posisjonen din er utilgjengelig.";
            break;
        case error.TIMEOUT:
            msg += "Tok for lang tid å hente posisjonen.";
            break;
        default:
            msg += "Ukjent GPS-feil.";
    }
    logToMobile(msg, "warn");

    if (geofenceFeedbackElement) {
        geofenceFeedbackElement.textContent = msg;
        geofenceFeedbackElement.className = 'geofence-error permanent';
        geofenceFeedbackElement.style.display = 'block';
    }

    // NY LOGIKK for DEV_MODE_NO_GEOFENCE
    if (DEV_MODE_NO_GEOFENCE && isFromWatchPosition && error.code !== error.PERMISSION_DENIED) {
        logToMobile("DEV_MODE: GPS feilet, men ikke pga. manglende tillatelse. Starter fallback interval for posisjonsoppdateringer.", "info");
        if (devModePositionUpdateIntervalId === null) { // Start kun hvis ikke allerede startet
            // Bruk en dummy posisjon, f.eks. START_LOCATION eller siste kjente hvis relevant
            const dummyPosition = {
                coords: {
                    latitude: START_LOCATION.lat,
                    longitude: START_LOCATION.lng,
                    accuracy: 100, // Dummy verdi
                    altitude: null,
                    altitudeAccuracy: null,
                    heading: null,
                    speed: null
                },
                timestamp: Date.now()
            };
            // Sørg for at updateUserPositionOnMap kalles minst én gang for å vise "bruker"
            updateUserPositionOnMap(dummyPosition);

            devModePositionUpdateIntervalId = setInterval(() => {
                logToMobile("DEV_MODE: Kaller handlePositionUpdate via fallback interval.", "debug");
                handlePositionUpdate(dummyPosition); // Send dummy posisjon
            }, 5000); // Oppdater hvert 5. sekund, som watchPosition
        }
    } else if (error.code === error.PERMISSION_DENIED) {
        // Hvis tillatelse nektes, stopp alt, inkludert fallback.
        stopContinuousUserPositionUpdate();
    }
}

// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
function updateUserPositionOnMap(position) { if (!map) return; const userPos = { lat: position.coords.latitude, lng: position.coords.longitude }; if (userPositionMarker) { userPositionMarker.setPosition(userPos); } else { userPositionMarker = new google.maps.Marker({ position: userPos, map: map, title: "Din Posisjon", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } }); } }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) { if (!geofenceFeedbackElement) return; if (isFullyCompleted || (!currentTeamData)) { geofenceFeedbackElement.style.display = 'none'; return; } geofenceFeedbackElement.style.display = 'block'; geofenceFeedbackElement.classList.remove('permanent'); if (DEV_MODE_NO_GEOFENCE) { geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`; geofenceFeedbackElement.className = 'geofence-info dev-mode'; return; } if (distance === null) { geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`; geofenceFeedbackElement.className = 'geofence-info'; return; } const distanceFormatted = Math.round(distance); if (isEffectivelyWithinRange) { if (canInteractWithTarget) { geofenceFeedbackElement.textContent = targetName.toLowerCase().includes("mål") ? `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Tast inn målkoden!` : `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Lærer må taste passord eller oppgaven vises.`; } else { geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`; } geofenceFeedbackElement.className = 'geofence-success'; } else { geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`; geofenceFeedbackElement.className = 'geofence-error'; } }

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);
    // NY: Fjernet loggspam for hver posisjonsoppdatering. Kan legges til ved behov.
    // logToMobile(`handlePositionUpdate: Lat: ${position.coords.latitude.toFixed(5)}, Lng: ${position.coords.longitude.toFixed(5)}`, "debug");

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) {
        logToMobile("handlePositionUpdate: Ingen teamdata eller rebus avsluttet. Stopper videre behandling.", "debug");
        updateGeofenceFeedback(null, false, true, null, false); return;
    }

    let targetLocationDetails = null; let isCurrentTargetTheFinishLine = false; let isGeoRunActiveForCurrentPost = false;
    const currentGlobalIdOriginal = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
    // logToMobile(`handlePositionUpdate: currentGlobalIdOriginal: ${currentGlobalIdOriginal}`, "debug");

    const currentPostDataFromCore = CoreApp.getPostData(currentGlobalIdOriginal);

    if (currentPostDataFromCore && currentPostDataFromCore.type === 'georun' &&
        currentTeamData.geoRunState && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]) {

        const runState = currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`];
        isGeoRunActiveForCurrentPost = true;
        // logToMobile(`handlePositionUpdate: Er på Post ${currentGlobalIdOriginal} (GeoRun). RunState active: ${runState.active}, finished: ${runState.finished}, prePipsDone: ${runState.preCountdownPipsDone}`, "debug");

        const geoRunPoint1Data = currentPostDataFromCore.geoRunPoint1;
        const geoRunPoint2Data = currentPostDataFromCore.geoRunPoint2;
        const prePipsForThisRun = currentPostDataFromCore.preCountdownPips;

        if (!geoRunPoint1Data || !geoRunPoint2Data) {
            logToMobile(`FEIL: geoRunPoint1 eller geoRunPoint2 er ikke definert for Post ${currentGlobalIdOriginal}.`, "error");
            isGeoRunActiveForCurrentPost = false;
        } else {
            if (runState.preCountdownPipsDone < prePipsForThisRun && !runState.active && !runState.finished && !runState.preRunPipTimerId) {
                targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunPreCountdown`, name: geoRunPoint1Data.name };
            } else if (!runState.active && !runState.finished) {
                targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunStart`, name: geoRunPoint1Data.name };
            } else if (runState.active && !runState.finished) {
                if (runState.lap % 2 !== 0) { targetLocationDetails = { location: geoRunPoint2Data, pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunPoint2`, name: geoRunPoint2Data.name }; }
                else { targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunPoint1`, name: geoRunPoint1Data.name }; }
            } else {
                isGeoRunActiveForCurrentPost = false;
            }
        }
    }

    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.finished)) {
        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) {
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name };
            isCurrentTargetTheFinishLine = true;
        } else {
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            const postDataForNav = CoreApp.getPostData(currentGlobalId);
            if (postDataForNav && typeof postDataForNav.lat !== 'undefined' && typeof postDataForNav.lng !== 'undefined') {
                targetLocationDetails = { location: {lat: postDataForNav.lat, lng: postDataForNav.lng}, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postDataForNav.name || `Post ${currentGlobalId}` };
            } else {
                 logToMobile(`handlePositionUpdate: Kunne ikke finne data eller koordinater for post ${currentGlobalId}.`, "warn");
            }
        }
    }

    if (!targetLocationDetails) {
        logToMobile("handlePositionUpdate: Ingen targetLocationDetails funnet (etter all logikk).", "warn");
        updateGeofenceFeedback(null, false, false, null, false); return;
    }

    const userLat = position.coords.latitude; const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS; const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange;
    // logToMobile(`handlePositionUpdate: Target: ${targetLocationDetails.name}, Avstand: ${distance.toFixed(1)}m, InnenforRange: ${isWithinRange}, EffektivtInnenfor: ${isEffectivelyWithinRange}`, "debug");

    let canCurrentlyInteract = false;
    if (isCurrentTargetTheFinishLine) {
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange;
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');
        if(finishUnlockInput) finishUnlockInput.disabled = !isEffectivelyWithinRange;
        if(finishUnlockButton) finishUnlockButton.disabled = !isEffectivelyWithinRange;
        if (isEffectivelyWithinRange && !currentTeamData.arrivalSoundPlayed.finish) { playArrivalSound(); currentTeamData.arrivalSoundPlayed.finish = true; saveState(); }
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else if (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`] && !currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`].finished) {
        document.dispatchEvent(new CustomEvent('geoRunLogicTrigger', { detail: { isAtTargetPoint: isEffectivelyWithinRange, targetPointId: targetLocationDetails.globalId, postId: currentGlobalIdOriginal } }));
    } else {
        const postGlobalId = targetLocationDetails.globalId; const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];
        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            logToMobile(`Post ${postGlobalId} nådd. Låser opp.`, "info");
            currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            if (!currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`]) {
                const thisPostData = CoreApp.getPostData(postGlobalId);
                if (thisPostData && thisPostData.type === 'georun') {
                    const runStateForPips = currentTeamData.geoRunState[`post${postGlobalId}`];
                    if (runStateForPips && !runStateForPips.preRunPipTimerId && runStateForPips.preCountdownPipsDone < (thisPostData.preCountdownPips || 3) ) { // Bruker 3 som default hvis preCountdownPips ikke er definert
                        document.dispatchEvent(new CustomEvent('startGeoRunPrePipsTrigger', {detail: {postId: postGlobalId}}));
                    }
                } else { playArrivalSound(); }
                currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`] = true;
            }
            saveState(); document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
            canCurrentlyInteract = true;
        } else if (isPostAlreadyUnlocked) {
            const thisPostData = CoreApp.getPostData(postGlobalId);
            if (thisPostData && (thisPostData.type === 'manned_minigolf' || thisPostData.type === 'manned_pyramid')) {
                 canCurrentlyInteract = !currentTeamData.mannedPostTeacherVerified[`post${postGlobalId}`];
            } else { canCurrentlyInteract = false; }
        }
    }
    if (!isGeoRunActiveForCurrentPost || (currentTeamData.geoRunState && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.finished)) { updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract); }
}


function startContinuousUserPositionUpdate() {
    if (!navigator.geolocation) {
        logToMobile("Geolocation ikke støttet.", "warn");
        return;
    }
    if (mapPositionWatchId !== null || devModePositionUpdateIntervalId !== null) { // Sjekk begge
        logToMobile("Posisjonssporing (ekte eller fallback) er allerede aktiv.", "info");
        return;
    }

    logToMobile("Starter kontinuerlig GPS posisjonssporing (eller forsøker).", "info");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
            // Nå sendes `true` som andre argument for å indikere at feilen kommer fra watchPosition
            handleGeolocationError(error, true);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    // NY: Hvis DEV_MODE er på og watchPosition ikke starter (f.eks. pga. ingen GPS-enhet, men tillatelse er gitt),
    // kan vi proaktivt starte fallback-intervallet etter en kort forsinkelse hvis watchPosition ikke har gitt en posisjon.
    // Dette er en ekstra sikkerhet, men handleGeolocationError vil også prøve å starte den.
    if (DEV_MODE_NO_GEOFENCE) {
        setTimeout(() => {
            if (mapPositionWatchId !== null && !userPositionMarker && devModePositionUpdateIntervalId === null) { // Hvis watch er aktiv, men ingen posisjon mottatt enda, og fallback ikke kjører
                logToMobile("DEV_MODE: watchPosition aktiv, men ingen posisjon mottatt. Simulerer en feil for å potensielt starte fallback.", "debug");
                // Simuler en timeout-feil for å trigge fallback-logikken i handleGeolocationError,
                // men bare hvis det ikke allerede er en PERMISSION_DENIED error.
                // Dette forutsetter at geofenceFeedbackElement ikke viser PERMISSION_DENIED.
                const permDeniedMsg = "Du må tillate posisjonstilgang.";
                if (!geofenceFeedbackElement || !geofenceFeedbackElement.textContent.includes(permDeniedMsg)) {
                    handleGeolocationError({ code: navigator.geolocation.TIMEOUT, message: "Simulert timeout for DEV_MODE fallback" }, true);
                }
            }
        }, 12000); // Vent litt lenger enn watchPosition timeout
    }
}

function stopContinuousUserPositionUpdate() {
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        logToMobile("Stoppet kontinuerlig GPS sporing (ekte).", "info");
    }
    if (devModePositionUpdateIntervalId !== null) { // NY: Stopp også fallback intervallet
        clearInterval(devModePositionUpdateIntervalId);
        devModePositionUpdateIntervalId = null;
        logToMobile("Stoppet fallback intervall for posisjonsoppdateringer (DEV_MODE).", "info");
    }
    // updateGeofenceFeedback kalles ofte, kanskje ikke nødvendig her hvis UI oppdateres andre steder
    // updateGeofenceFeedback(null, false, true, null, false);
}


document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output');
    logToMobile("DEBUG_V42: DOMContentLoaded event fired.", "info"); // Oppdatert versjonsnummer i logg
    initializeSounds();

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    postContentContainer = document.getElementById('post-content-container');

    if (!postContentContainer) logToMobile("CRITICAL - postContentContainer is NULL! Dynamisk innhold vil ikke lastes.", "error");

    const TEAM_CONFIG = {
        "LAG1": { name: "Lag 1", postSequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        "LAG2": { name: "Lag 2", postSequence: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] },
        "LAG3": { name: "Lag 3", postSequence: [3, 4, 2, 5, 6, 7, 8, 9, 10, 1] },
        "LAG4": { name: "Lag 4", postSequence: [4, 3, 2, 5, 6, 7, 8, 9, 10, 1] },
        "LAG5": { name: "Lag 5", postSequence: [5, 6, 7, 8, 9, 10, 1, 2, 3, 4] },
        "LAG6": { name: "Lag 6", postSequence: [6, 7, 8, 9, 10, 1, 2, 3, 4, 5] },
        "LAG7": { name: "Lag 7", postSequence: [7, 8, 9, 10, 1, 2, 3, 4, 5, 6] },
        "LAG8": { name: "Lag 8", postSequence: [8, 9, 10, 1, 2, 3, 4, 5, 6, 7] },
        "LAG9": { name: "Lag 9", postSequence: [9, 10, 1, 2, 3, 4, 5, 6, 7, 8] },
        "LAG10": { name: "Lag 10", postSequence: [10, 1, 2, 3, 4, 5, 6, 7, 8, 9] }
    };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() {
        if (currentTeamData && scoreDisplayElement && currentScoreSpan) {
            currentScoreSpan.textContent = currentTeamData.score;
            scoreDisplayElement.style.display = 'block';
        }
    }
    function updatePageText(pageElement, teamPostNumber, globalPostId) {
        if (!pageElement) { logToMobile(`updatePageText: pageElement for globalPostId ${globalPostId} er null.`, "warn"); return; }
        const titleElement = pageElement.querySelector('.post-title-placeholder');
        const postInfoElement = pageElement.querySelector('.post-info-placeholder');

        const postData = CoreApp.getPostData(globalPostId);
        if (!postData) {
            logToMobile(`updatePageText: Finner ikke postData for globalPostId ${globalPostId}`, "error");
            if(titleElement) titleElement.textContent = "Ukjent Post";
            return;
        }
        let postName = postData.name || `Post ${globalPostId}`;

        if (titleElement) titleElement.textContent = `Post ${teamPostNumber}/${Object.keys(CoreApp.registeredPostsData).length}: ${postName}`;

        if (postInfoElement) {
            if (postData.type === 'georun') {
                postInfoElement.textContent = `Bruk kartet for å finne startpunktet for Geo-løpet på ${postName}.`;
            } else if (postData.type === 'manned_minigolf' || postData.type === 'manned_pyramid') {
                postInfoElement.textContent = `Gå til ${postName} for en bemannet oppgave.`;
            } else {
                postInfoElement.textContent = `Bruk kartet for å finne ${postName}.`;
            }
        }

        const mannedPostTitleElement = pageElement.querySelector('.manned-post-title-placeholder');
        const mannedPostInstructionElement = pageElement.querySelector('.manned-post-instruction-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder');
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder');

        if (postData.type === 'manned_minigolf' || postData.type === 'manned_pyramid') {
            if (mannedPostTitleElement) mannedPostTitleElement.textContent = `Bemannet Post: ${postName}`;
            if (mannedPostInstructionElement && postData.instructionsManned) {
                mannedPostInstructionElement.textContent = postData.instructionsManned;
            }
        } else if (postData.type === 'georun') {
            const geoRunSetupElement = pageElement.querySelector('.geo-run-setup-section');
            if (geoRunSetupElement) { // Sørg for at seksjonen finnes
                const geoRunSetupInstructions = geoRunSetupElement.querySelector('p#georun-instructions-post7'); // Mer spesifikk selektor
                if (geoRunSetupInstructions && postData.instructionsTask) {
                    geoRunSetupInstructions.textContent = postData.instructionsTask;
                } else if (geoRunSetupInstructions) { // Fallback hvis ID ikke er der, men vi forventer en p-tag
                     const genericP = geoRunSetupElement.querySelector('p:nth-of-type(2)');
                     if (genericP && postData.instructionsTask) genericP.textContent = postData.instructionsTask;
                }
            }
        }
         else if (postData.type === 'standard') {
            if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
            if (taskQuestionElement && postData.question) {
                taskQuestionElement.textContent = postData.question;
            }
        }
    }

    function displayFinalResults() {
        logToMobile("DEBUG_V42: Displaying final results.", "info"); // Oppdatert versjonsnummer i logg
        const finalScoreSpan = document.getElementById('final-score');
        const totalTimeSpan = document.getElementById('total-time');
        const stageTimesList = document.getElementById('stage-times-list');

        if (finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
        if (totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
            totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
        }

        if (stageTimesList && currentTeamData.taskCompletionTimes) {
            stageTimesList.innerHTML = '';
            let lastTimestamp = currentTeamData.startTime;

            for (let i = 0; i < currentTeamData.postSequence.length; i++) {
                const postGlobalId = currentTeamData.postSequence[i];
                const postData = CoreApp.getPostData(postGlobalId);
                if (!postData) continue;

                const postName = postData.name;
                let startTimeForStage = (i === 0) ? currentTeamData.startTime : currentTeamData.taskCompletionTimes[`post${currentTeamData.postSequence[i-1]}`];

                if (currentTeamData.taskCompletionTimes['post' + postGlobalId]) {
                    if (startTimeForStage) {
                        const stageTime = currentTeamData.taskCompletionTimes['post' + postGlobalId] - startTimeForStage;
                        const li = document.createElement('li');
                        const fromPoint = (i === 0) ? "Start" : (CoreApp.getPostData(currentTeamData.postSequence[i-1]) ? CoreApp.getPostData(currentTeamData.postSequence[i-1]).name : "Forrige post");
                        li.textContent = `${fromPoint} til ${postName}: ${formatTimeFromMs(stageTime)}`;
                        stageTimesList.appendChild(li);
                    } else if (i === 0) {
                        const li = document.createElement('li');
                        li.textContent = `Start til ${postName}: Tid ukjent`;
                        stageTimesList.appendChild(li);
                    }
                } else {
                     const li = document.createElement('li');
                     const fromPoint = (i === 0) ? "Start" : (CoreApp.getPostData(currentTeamData.postSequence[i-1]) ? CoreApp.getPostData(currentTeamData.postSequence[i-1]).name : "Forrige post");
                     li.textContent = `${fromPoint} til ${postName}: Ikke fullført`;
                     stageTimesList.appendChild(li);
                     break;
                }
            }

            if (currentTeamData.endTime && currentTeamData.completedPostsCount === Object.keys(CoreApp.registeredPostsData).length) {
                const lastCompletedPostInSequence = currentTeamData.postSequence[Object.keys(CoreApp.registeredPostsData).length -1];
                const lastPostData = CoreApp.getPostData(lastCompletedPostInSequence);
                if (lastPostData && currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence]) {
                    const timeToFinish = currentTeamData.endTime - currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence];
                    const li = document.createElement('li');
                    li.textContent = `${lastPostData.name} til Mål: ${formatTimeFromMs(timeToFinish)}`;
                    stageTimesList.appendChild(li);
                }
            }
        }
    }

    async function showRebusPage(pageIdentifier) {
        logToMobile(`--- showRebusPage CALLED with pageIdentifier: '${pageIdentifier}' ---`, "info");
        if (!postContentContainer) { logToMobile("CRITICAL - postContentContainer is NULL in showRebusPage! Kan ikke laste innhold.", "error"); return; }

        let htmlFileToFetch;
        let expectedWrapperId;

        if (pageIdentifier === 'intro') { htmlFileToFetch = 'posts/intro.html'; expectedWrapperId = 'intro-content-wrapper'; }
        else if (pageIdentifier === 'finale') { htmlFileToFetch = 'posts/finale.html'; expectedWrapperId = 'finale-content-wrapper';}
        else if (pageIdentifier.startsWith('post-')) { const postNum = pageIdentifier.split('-')[1]; htmlFileToFetch = `posts/post${postNum}.html`; expectedWrapperId = `post-${postNum}-content-wrapper`;}
        else { logToMobile(`Ugyldig pageIdentifier for showRebusPage: ${pageIdentifier}`, "error"); htmlFileToFetch = 'posts/intro.html'; expectedWrapperId = 'intro-content-wrapper'; }

        try {
            const response = await fetch(htmlFileToFetch);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} for ${htmlFileToFetch}`); }
            const htmlContent = await response.text();
            postContentContainer.innerHTML = htmlContent;
            logToMobile(`Innhold for '${pageIdentifier}' lastet inn i postContentContainer.`, "debug");

            const loadedPageElement = document.getElementById(expectedWrapperId);
            if (!loadedPageElement) {
                 logToMobile(`FEIL: Kunne ikke finne rot-elementet med ID '${expectedWrapperId}' etter lasting av ${pageIdentifier}`, "error");
                 return;
            }

            if (currentTeamData && pageIdentifier.startsWith('post-')) {
                const globalPostNumMatch = pageIdentifier.match(/post-(\d+)/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    updatePageText(loadedPageElement, teamPostNum, globalPostNum);

                    const postData = CoreApp.getPostData(globalPostNum);
                    if (postData && postData.type === 'georun' && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${globalPostNum}`] && !currentTeamData.geoRunState[`post${globalPostNum}`].active && !currentTeamData.geoRunState[`post${globalPostNum}`].finished) {
                        // For GeoRun, kartmarkør skal peke på geoRunPoint1 (startpunktet for selve løpet) når posten vises.
                        if (postData.geoRunPoint1) {
                            updateMapMarker(null, false, postData.geoRunPoint1);
                        } else {
                            logToMobile(`Post ${globalPostNum} er georun, men mangler geoRunPoint1 data for kartmarkør.`, "warn");
                        }
                    }
                }
            }

            resetPageUI(pageIdentifier, loadedPageElement);

            if (currentTeamData && pageIdentifier !== 'intro') { updateScoreDisplay(); }
            else if (scoreDisplayElement) { scoreDisplayElement.style.display = 'none'; }

            if (pageIdentifier === 'finale') {
                const finaleUnlockSection = loadedPageElement.querySelector('#finale-unlock-section');
                const finaleCompletedSection = loadedPageElement.querySelector('#finale-completed-section');
                const finaleInfoSection = loadedPageElement.querySelector('#finale-info-section');
                if (currentTeamData && currentTeamData.endTime) {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'block';
                    displayFinalResults();
                } else if (currentTeamData && currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'block';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                } else {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                    if (pageIdentifier === 'finale' && !currentTeamData) { logToMobile("Prøver å vise finale uten teamdata, går til intro.", "warn"); clearState(); showRebusPage('intro'); return; }
                }
            }
            if (pageIdentifier.startsWith('post-')) {
                const postNum = parseInt(pageIdentifier.split('-')[1]);
                const postData = CoreApp.getPostData(postNum);
                if (postData && typeof postData.initUI === 'function') {
                    logToMobile(`Kaller initUI for post ${postNum}`, "debug");
                    postData.initUI(loadedPageElement, currentTeamData);
                } else {
                    logToMobile(`Ingen initUI funksjon funnet eller postData mangler for post ${postNum}`, "debug");
                }
            }
        } catch (error) {
            logToMobile(`Feil ved lasting av sideinnhold for '${pageIdentifier}': ${error.message}`, "error");
            postContentContainer.innerHTML = `<p class="feedback error">Kunne ikke laste innholdet for denne siden. Prøv å laste siden på nytt.</p>`;
        }
        logToMobile(`--- showRebusPage COMPLETED for pageIdentifier: '${pageIdentifier}' ---`, "info");
    }

    function showTabContent(tabId) {
        tabContents.forEach(content => content.classList.remove('visible'));
        tabButtons.forEach(button => button.classList.remove('active'));
        const activeContent = document.getElementById(tabId + '-content');
        const activeButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
        if (activeContent) activeContent.classList.add('visible');
        if (activeButton) activeButton.classList.add('active');
        logToMobile(`Tab skiftet til: ${tabId}`, "debug");
    }

    function loadState() {
        const savedState = localStorage.getItem('activeTeamData_Skolerebus');
        if (savedState) {
            currentTeamData = JSON.parse(savedState);
            logToMobile("Tilstand lastet fra localStorage.", "info");
            return true;
        }
        logToMobile("Ingen lagret tilstand funnet.", "info");
        return false;
    }

    function clearState() {
        logToMobile("DEBUG_V42: clearState kalt", "info"); // Oppdatert versjonsnummer i logg
        currentTeamData = null;
        saveState(); // Dette vil fjerne item fra localStorage
        stopContinuousUserPositionUpdate();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        clearMapMarker(); clearFinishMarker();
        if (map && START_LOCATION) map.panTo(START_LOCATION);
        if (scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        resetAllPostUIs();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';
        logToMobile("All state og UI nullstilt.", "info");
    }

    function resetPageUI(pageIdentifier, pageElementContext = null) {
        logToMobile(`DEBUG_V42: resetPageUI kalt for: ${pageIdentifier}`, "debug"); // Oppdatert versjonsnummer i logg
        const context = pageElementContext || postContentContainer;
        if (!context) { logToMobile("resetPageUI: Ingen kontekst (pageElementContext eller postContentContainer) funnet.", "error"); return; }

        let postNum = null;
        if (pageIdentifier && pageIdentifier.startsWith('post-')) {
            postNum = parseInt(pageIdentifier.split('-')[1]);
        }

        const postData = postNum ? CoreApp.getPostData(postNum) : null;
        const isUnlocked = postData && currentTeamData && currentTeamData.unlockedPosts[`post${postNum}`];
        const isCompleted = postData && currentTeamData && currentTeamData.completedGlobalPosts[`post${postNum}`];
        const isTeacherVerified = postData && currentTeamData && currentTeamData.mannedPostTeacherVerified[`post${postNum}`];

        // Skjul/vis seksjoner basert på post-status
        const postInfoSection = context.querySelector('.post-info-section');
        const taskSection = context.querySelector('.post-task-section'); // Standard oppgaveseksjon
        const teacherPasswordSection = context.querySelector('.teacher-password-section'); // For bemannede poster
        const minigolfFormSection = context.querySelector('.minigolf-form-section'); // For post 1
        const pyramidPointsSection = context.querySelector('.pyramid-points-section'); // For post 8
        const geoRunSetupSection = context.querySelector('.geo-run-setup-section'); // For post 7
        const geoRunActiveSection = context.querySelector('.geo-run-active-section'); // For post 7
        const geoRunResultsSection = context.querySelector('.geo-run-results-section'); // For post 7

        // Nullstill alle seksjoner først
        [postInfoSection, taskSection, teacherPasswordSection, minigolfFormSection, pyramidPointsSection, geoRunSetupSection, geoRunActiveSection, geoRunResultsSection]
            .forEach(section => { if (section) section.style.display = 'none'; });

        if (postData) {
            if (isCompleted) {
                logToMobile(`Post ${postNum} er fullført. Viser resultat/ferdig-UI.`, "debug");
                if (postData.type === 'standard' && taskSection) {
                    taskSection.style.display = 'block';
                    taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const feedbackEl = taskSection.querySelector('.feedback-task');
                    if (feedbackEl) { feedbackEl.textContent = "Post fullført!"; feedbackEl.className = "feedback success"; }
                } else if (postData.type === 'manned_minigolf' && minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                    // initUI for post1 vil håndtere detaljer om disabling og feedback
                } else if (postData.type === 'manned_pyramid' && pyramidPointsSection) {
                    pyramidPointsSection.style.display = 'block';
                    // initUI for post8 vil håndtere detaljer
                } else if (postData.type === 'georun' && geoRunResultsSection) {
                    geoRunResultsSection.style.display = 'block';
                    // initUI for post7 vil håndtere detaljer
                } else if (postInfoSection) { // Fallback hvis ingen annen seksjon passer
                    postInfoSection.style.display = 'block';
                    postInfoSection.innerHTML = `<p>Du har fullført denne posten.</p>`;
                }
            } else if (isUnlocked) {
                logToMobile(`Post ${postNum} er ulåst. Viser oppgave/interaksjons-UI.`, "debug");
                if (postData.type === 'standard' && taskSection) {
                    taskSection.style.display = 'block';
                    const inputEl = taskSection.querySelector('.post-task-input');
                    if (inputEl) { inputEl.value = ''; inputEl.disabled = false; }
                    const btnEl = taskSection.querySelector('.check-task-btn');
                    if (btnEl) btnEl.disabled = false;
                    const feedbackEl = taskSection.querySelector('.feedback-task');
                    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'feedback feedback-task'; }
                    const attemptsEl = taskSection.querySelector('.attempt-counter');
                    if (attemptsEl && currentTeamData.taskAttempts && currentTeamData.taskAttempts[`post${postNum}`] !== undefined) {
                        attemptsEl.textContent = `Forsøk igjen: ${postData.maxAttempts - currentTeamData.taskAttempts[`post${postNum}`]}`;
                    } else if (attemptsEl) {
                        attemptsEl.textContent = postData.maxAttempts ? `Forsøk: ${postData.maxAttempts}` : '';
                    }
                } else if (postData.type === 'manned_minigolf') {
                    if (isTeacherVerified && minigolfFormSection) minigolfFormSection.style.display = 'block';
                    else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
                    // initUI for post1 håndterer input reset etc.
                } else if (postData.type === 'manned_pyramid') {
                    if (isTeacherVerified && pyramidPointsSection) pyramidPointsSection.style.display = 'block';
                    else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
                    // initUI for post8 håndterer input reset etc.
                } else if (postData.type === 'georun') {
                    const runState = currentTeamData.geoRunState && currentTeamData.geoRunState[`post${postNum}`];
                    if (runState) {
                        if (runState.finished && geoRunResultsSection) geoRunResultsSection.style.display = 'block';
                        else if (runState.active && geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                        else if (geoRunSetupSection) geoRunSetupSection.style.display = 'block'; // Viser setup hvis ikke aktiv/ferdig
                        // initUI for post7 håndterer detaljer for hver seksjon
                    } else if (postInfoSection) { // Bør ikke skje hvis ulåst, men som fallback
                        postInfoSection.style.display = 'block';
                    }
                }
            } else if (postInfoSection) { // Ikke ulåst
                logToMobile(`Post ${postNum} er ikke ulåst. Viser info-seksjon.`, "debug");
                postInfoSection.style.display = 'block';
            }

            // La post-spesifikk initUI finjustere
            if (typeof postData.initUI === 'function') {
                postData.initUI(context.firstChild, currentTeamData); // Sender wrapper-diven
            }

        } else if (pageIdentifier === 'intro') {
            const teamCodeInput = context.querySelector('#team-code-input-dynamic');
            if (teamCodeInput) teamCodeInput.value = '';
            const teamCodeFeedback = context.querySelector('#team-code-feedback-dynamic');
            if (teamCodeFeedback) teamCodeFeedback.textContent = '';
            const startButton = context.querySelector('#start-with-team-code-button-dynamic');
            if (startButton) startButton.disabled = false;
        } else if (pageIdentifier === 'finale') {
            // Logikk for finale er allerede i showRebusPage, men kan legge til reset her om nødvendig
            const finishInput = context.querySelector('#finish-unlock-input');
            if (finishInput) finishInput.value = '';
            const finishFeedback = context.querySelector('#feedback-unlock-finish');
            if (finishFeedback) finishFeedback.textContent = '';
        }
    }


    function resetAllPostUIs() {
        logToMobile("resetAllPostUIs kalt.", "debug");
        // Denne funksjonen er mer konseptuell nå, da UI lastes dynamisk.
        // Men hvis det er globale UI-elementer knyttet til poster som ikke er i postContentContainer,
        // kan de nullstilles her. For nå, fokuserer vi på det som lastes.
        // Det viktigste er at `resetPageUI` kalles når en ny side vises.
    }

    function initializeTeam(teamCode) {
        logToMobile(`DEBUG_V42: initializeTeam kalt med kode: ${teamCode}`, "info"); // Oppdatert versjonsnummer i logg
        const teamConfig = TEAM_CONFIG[teamCode.toUpperCase()];
        if (!teamConfig) {
            const feedbackElDynamic = document.getElementById('team-code-feedback-dynamic');
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Ugyldig lagkode. Prøv igjen.";
                feedbackElDynamic.className = "feedback error";
            }
            logToMobile(`Ugyldig lagkode: ${teamCode}`, "warn");
            return;
        }

        currentTeamData = {
            teamCode: teamCode.toUpperCase(),
            teamName: teamConfig.name,
            postSequence: teamConfig.postSequence,
            currentPostArrayIndex: 0,
            score: 0,
            startTime: Date.now(),
            endTime: null,
            totalTimeSeconds: null,
            completedPostsCount: 0,
            completedGlobalPosts: {}, // f.eks. { "post1": true, "post5": true }
            unlockedPosts: {},       // f.eks. { "post1": true, "post5": true }
            taskAttempts: {},        // f.eks. { "post2": 1, "post4": 3 }
            taskCompletionTimes: {}, // f.eks. { "post1": timestamp, "post2": timestamp }
            mannedPostTeacherVerified: {}, // f.eks. { "post1": true }
            minigolfScores: {}, // f.eks. { "post1": { scores: [3,4,5], average: 4, pointsAwarded: 7 }}
            pyramidPoints: {},  // f.eks. { "post8": 8 }
            geoRunState: {},    // f.eks. { "post7": { active: false, finished: false, startTime: null, endTime: null, lap: 0, currentTarget: 'point1', preCountdownPipsDone: 0, preRunPipTimerId: null }}
            arrivalSoundPlayed: {}, // f.eks. { "post1": true, "finish": true }
            canEnterFinishCode: false
        };

        // Initialiser geoRunState for alle georun-poster i sekvensen
        currentTeamData.postSequence.forEach(postId => {
            const postData = CoreApp.getPostData(postId);
            if (postData && postData.type === 'georun') {
                currentTeamData.geoRunState[`post${postId}`] = {
                    active: false,
                    finished: false,
                    startTime: null,
                    endTime: null,
                    lap: 0,
                    preCountdownPipsDone: 0,
                    preRunPipTimerId: null,
                    countdownTimerId: null,
                    totalLaps: postData.lapsNormal // Kan justeres for testmodus senere om nødvendig
                };
            }
        });


        saveState();
        logToMobile(`Lag ${currentTeamData.teamName} initialisert. Starter på post ${currentTeamData.postSequence[0]}.`, "info");

        const firstPostId = currentTeamData.postSequence[0];
        showRebusPage(`post-${firstPostId}`);
        updateMapMarker(firstPostId, false);
        startContinuousUserPositionUpdate();
        updateScoreDisplay();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'block'; // Vis geofence info
    }

    function handleTeacherPassword(postNum, password) {
        const postData = CoreApp.getPostData(postNum);
        const feedbackEl = document.getElementById(`feedback-teacher-password-post${postNum}`);
        const passInput = document.getElementById(`teacher-password-input-post${postNum}`);

        if (!postData || !feedbackEl || !passInput) {
            logToMobile(`handleTeacherPassword: Nødvendige elementer/data mangler for post ${postNum}.`, "error");
            return;
        }
        if (password === postData.teacherPassword) {
            feedbackEl.textContent = "Korrekt passord! Oppgaven er låst opp.";
            feedbackEl.className = "feedback success";
            passInput.disabled = true;
            const passButton = document.querySelector(`.submit-teacher-password-btn[data-post="${postNum}"]`);
            if(passButton) passButton.disabled = true;

            currentTeamData.mannedPostTeacherVerified[`post${postNum}`] = true;
            saveState();
            logToMobile(`Lærerpassord korrekt for post ${postNum}.`, "info");
            resetPageUI(`post-${postNum}`, document.getElementById(`post-${postNum}-content-wrapper`)); // Last UI på nytt for å vise oppgavedelen
        } else {
            feedbackEl.textContent = "Feil passord. Prøv igjen.";
            feedbackEl.className = "feedback error shake";
            passInput.value = "";
            passInput.focus();
            logToMobile(`Feil lærerpassord for post ${postNum}.`, "warn");
            setTimeout(() => { if (feedbackEl) feedbackEl.classList.remove('shake'); }, 500);
        }
    }

    function handleMinigolfSubmit(postNum) {
        const postData = CoreApp.getPostData(postNum);
        if (!postData || postData.type !== 'manned_minigolf') return;

        const pageElement = document.getElementById(`post-${postNum}-content-wrapper`);
        if (!pageElement) return;

        const feedbackEl = pageElement.querySelector('#minigolf-results-feedback');
        const scores = [];
        let totalScore = 0;
        let playerCount = 0;

        for (let i = 1; i <= postData.maxPlayers; i++) {
            const scoreInput = pageElement.querySelector(`#player-${i}-score-post${postNum}`);
            if (scoreInput && scoreInput.value !== "") {
                const score = parseInt(scoreInput.value);
                if (isNaN(score) || score < postData.minScorePerPlayer) {
                    if(feedbackEl) {
                        feedbackEl.textContent = `Ugyldig score for spiller ${i}. Må være minst ${postData.minScorePerPlayer}.`;
                        feedbackEl.className = "feedback error";
                    }
                    logToMobile(`Minigolf: Ugyldig score for spiller ${i} på post ${postNum}.`, "warn");
                    return;
                }
                scores.push(score);
                totalScore += score;
                playerCount++;
            }
        }

        if (playerCount === 0) {
            if(feedbackEl) {
                feedbackEl.textContent = "Ingen scorer registrert. Fyll inn minst én spillers score.";
                feedbackEl.className = "feedback error";
            }
            logToMobile(`Minigolf: Ingen scorer registrert for post ${postNum}.`, "warn");
            return;
        }

        const averageScore = totalScore / playerCount;
        let pointsAwarded = 0;
        for (const threshold in postData.pointsScale) {
            if (averageScore <= parseFloat(threshold)) {
                pointsAwarded = postData.pointsScale[threshold];
                break;
            }
        }

        currentTeamData.minigolfScores[`post${postNum}`] = {
            scores: scores,
            average: averageScore,
            pointsAwarded: pointsAwarded
        };

        if(feedbackEl) {
            feedbackEl.textContent = `Snittscore: ${averageScore.toFixed(2)}. Poeng tildelt: ${pointsAwarded}.`;
            feedbackEl.className = "feedback success";
        }
        logToMobile(`Minigolf post ${postNum}: Snitt ${averageScore.toFixed(2)}, Poeng ${pointsAwarded}.`, "info");

        pageElement.querySelectorAll('.minigolf-form-section input, .minigolf-form-section button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true);
        const proceedButton = pageElement.querySelector(`#minigolf-proceed-btn-post${postNum}`);
        if (proceedButton) { proceedButton.style.display = 'inline-block'; proceedButton.disabled = false; }

        CoreApp.markPostAsCompleted(postNum, pointsAwarded);
    }

    function handlePyramidPointsSubmit(postNum, pointsStr) {
        const postData = CoreApp.getPostData(postNum);
        if (!postData || postData.type !== 'manned_pyramid') return;

        const pageElement = document.getElementById(`post-${postNum}-content-wrapper`);
        if (!pageElement) return;

        const feedbackEl = pageElement.querySelector('#pyramid-results-feedback'); // Antar denne IDen
        const points = parseInt(pointsStr);

        if (isNaN(points) || points < 0 || points > postData.maxPoints) {
            if(feedbackEl) {
                feedbackEl.textContent = `Ugyldig poengsum. Må være mellom 0 og ${postData.maxPoints}.`;
                feedbackEl.className = "feedback error";
            }
            logToMobile(`Pyramide: Ugyldig poengsum ${pointsStr} for post ${postNum}.`, "warn");
            const pointsInput = pageElement.querySelector(`#pyramid-points-input-post${postNum}`);
            if(pointsInput) pointsInput.focus();
            return;
        }

        currentTeamData.pyramidPoints[`post${postNum}`] = points;

        if(feedbackEl) {
            feedbackEl.textContent = `Poeng registrert: ${points}!`;
            feedbackEl.className = "feedback success";
        }
        logToMobile(`Pyramide post ${postNum}: ${points} poeng registrert.`, "info");

        pageElement.querySelectorAll('.pyramid-points-section input, .pyramid-points-section button:not(#pyramid-proceed-btn-post8)').forEach(el => el.disabled = true);
        // Anta en "Gå Videre"-knapp for pyramide også, hvis den finnes
        const proceedButton = pageElement.querySelector(`#pyramid-proceed-btn-post${postNum}`);
        if (proceedButton) { proceedButton.style.display = 'inline-block'; proceedButton.disabled = false; }


        CoreApp.markPostAsCompleted(postNum, points);
    }

    function startGeoRunPreCountdownPips(postId = GEO_RUN_POST_ID) {
        const postData = CoreApp.getPostData(postId);
        const runState = currentTeamData.geoRunState[`post${postId}`];

        if (!postData || postData.type !== 'georun' || !runState || runState.preRunPipTimerId || runState.active || runState.finished) {
            logToMobile(`startGeoRunPreCountdownPips: Kan ikke starte for post ${postId}. Enten feil posttype, manglende runState, allerede aktiv/ferdig, eller timer kjører.`, "warn");
            return;
        }

        const pageElement = document.getElementById(`post-${postId}-content-wrapper`);
        if (!pageElement) { logToMobile(`startGeoRunPreCountdownPips: Finner ikke pageElement for post ${postId}`, "error"); return;}

        const prePipInfoEl = pageElement.querySelector('.geo-run-pre-pip-info');
        const countdownEl = pageElement.querySelector('.geo-run-countdown');
        const maxPips = postData.preCountdownPips || 3; // Default til 3 pips

        logToMobile(`Starter pre-countdown pips for GeoRun Post ${postId}. ${runState.preCountdownPipsDone + 1}/${maxPips}`, "info");

        if (runState.preCountdownPipsDone < maxPips) {
            playSound(shortPipAudio);
            runState.preCountdownPipsDone++;
             if (prePipInfoEl) prePipInfoEl.textContent = `Pip ${runState.preCountdownPipsDone} av ${maxPips}.`;


            if (runState.preCountdownPipsDone < maxPips) {
                runState.preRunPipTimerId = setTimeout(() => {
                    runState.preRunPipTimerId = null; // Nullstill før neste kall
                    startGeoRunPreCountdownPips(postId); // Rekursivt kall for neste pip
                }, (postData.preCountdownInterval || 20) * 1000); // Bruk definert interval, default 20s
            } else {
                // Siste pre-pip er gjort, start hoved-nedtellingen
                logToMobile(`Siste pre-pip for Post ${postId}. Starter hoved-nedtelling.`, "info");
                 if (prePipInfoEl) prePipInfoEl.textContent = `Alle ${maxPips} pip sendt!`;
                if (countdownEl) countdownEl.textContent = postData.countdownSeconds || 10;

                let currentCountdown = postData.countdownSeconds || 10;
                runState.countdownTimerId = setInterval(() => {
                    currentCountdown--;
                    if (countdownEl) countdownEl.textContent = currentCountdown;
                    if (currentCountdown <= 0) {
                        clearInterval(runState.countdownTimerId);
                        runState.countdownTimerId = null;
                        // Faktiske starten på løpet skjer i handleGeoRunLogic når man er på startpunktet
                        logToMobile(`Hoved-nedtelling for Post ${postId} ferdig. Venter på start ved GeoRunPoint1.`, "info");
                        // Sikre at geofence sjekker for startpunktet for løpet
                        updateMapMarker(null, false, postData.geoRunPoint1); // Vis startpunktet for løpet
                        handlePositionUpdate({ coords: { latitude: userPositionMarker.getPosition().lat(), longitude: userPositionMarker.getPosition().lng() }, timestamp: Date.now() }); // Re-evaluer posisjon
                    } else if (currentCountdown <= 3) {
                        playSound(shortPipAudio); // Korte pip for de siste 3 sekundene
                    }
                }, 1000);
            }
            saveState();
        }
    }


    function handleGeoRunLogic(isAtTargetPoint, targetPointId, currentGeoRunPostId = null) {
        if (!currentTeamData) return;

        const postId = currentGeoRunPostId || currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        const postData = CoreApp.getPostData(postId);
        const runState = currentTeamData.geoRunState[`post${postId}`];
        const pageElement = document.getElementById(`post-${postId}-content-wrapper`);

        if (!postData || postData.type !== 'georun' || !runState || !pageElement) {
            logToMobile(`handleGeoRunLogic: Ugyldig data for post ${postId}. Avbryter.`, "warn");
            return;
        }
        logToMobile(`GeoRunLogic: Post ${postId}, Target: ${targetPointId}, AtTarget: ${isAtTargetPoint}, RunActive: ${runState.active}, Finished: ${runState.finished}`, "debug");

        const setupSection = pageElement.querySelector('.geo-run-setup-section');
        const activeSection = pageElement.querySelector('.geo-run-active-section');
        const resultsSection = pageElement.querySelector('.geo-run-results-section');
        const nextTargetEl = pageElement.querySelector('.geo-run-next-target');
        const currentLapEl = pageElement.querySelector('.geo-run-current-lap');
        const totalLapsForRun = runState.totalLaps || postData.lapsNormal;

        // Håndter pre-countdown pip logikk hvis det er målet
        if (targetPointId === 'geoRunPreCountdown' && isAtTargetPoint && runState.preCountdownPipsDone < (postData.preCountdownPips || 3) && !runState.preRunPipTimerId && !runState.active && !runState.finished) {
            logToMobile(`GeoRunLogic: Ved PreCountdown-punkt for post ${postId}. Starter pips.`, "info");
            document.dispatchEvent(new CustomEvent('startGeoRunPrePipsTrigger', {detail: {postId: postId}}));
            // Geofence feedback bør nå vise at man venter på pips/nedtelling
             updateGeofenceFeedback(0, true, false, `${postData.geoRunPoint1.name} (venter på startpip)`, true);
            return; // Ikke gjør mer i denne kall
        }
        // Oppdater geofence feedback basert på om vi er i et aktivt løp eller venter på start
        let feedbackTargetName;
        if (runState.active && !runState.finished) {
            feedbackTargetName = (runState.lap % 2 !== 0) ? postData.geoRunPoint2.name : postData.geoRunPoint1.name;
        } else if (!runState.active && !runState.finished) {
            feedbackTargetName = postData.geoRunPoint1.name + (runState.preCountdownPipsDone < (postData.preCountdownPips || 3) ? " (venter på startpip)" : " (klar til start)");
        } else { // finished
            feedbackTargetName = "Geo-løp fullført";
        }
        // Bruk 0 for distance hvis isAtTargetPoint er true, ellers null (eller en faktisk verdi hvis tilgjengelig)
        const feedbackDistance = isAtTargetPoint ? 0 : null;
        updateGeofenceFeedback(feedbackDistance, isAtTargetPoint, runState.finished, feedbackTargetName, isAtTargetPoint);


        if (runState.finished) {
            if(setupSection) setupSection.style.display = 'none';
            if(activeSection) activeSection.style.display = 'none';
            if(resultsSection) resultsSection.style.display = 'block';
            return;
        }

        if (!runState.active) { // Løpet har ikke startet ennå
            if (targetPointId === 'geoRunStart' && isAtTargetPoint && runState.preCountdownPipsDone >= (postData.preCountdownPips || 3) && !runState.countdownTimerId) {
                logToMobile(`GeoRun Post ${postId}: Startpunkt nådd! Løpet starter NÅ!`, "info");
                runState.active = true;
                runState.startTime = Date.now();
                runState.lap = 1; // Starter første runde
                if(setupSection) setupSection.style.display = 'none';
                if(activeSection) activeSection.style.display = 'block';
                if(resultsSection) resultsSection.style.display = 'none';

                if(currentLapEl) currentLapEl.textContent = `${runState.lap} av ${totalLapsForRun}`;
                if(nextTargetEl) nextTargetEl.textContent = postData.geoRunPoint2.name; // Første mål er Point2
                updateMapMarker(null, false, postData.geoRunPoint2); // Vis neste vendepunkt
                playGeoRunStartSoundSequence();
                saveState();
            } else {
                // Venter fortsatt på å nå startpunktet, eller pre-pips/countdown er ikke ferdig
                if(setupSection) setupSection.style.display = 'block';
                if(activeSection) activeSection.style.display = 'none';
                if(resultsSection) resultsSection.style.display = 'none';
                if (targetPointId === 'geoRunStart' && !isAtTargetPoint) {
                    logToMobile(`GeoRun Post ${postId}: Nærmer deg startpunktet.`, "debug");
                } else if (targetPointId === 'geoRunStart' && isAtTargetPoint && (runState.preCountdownPipsDone < (postData.preCountdownPips || 3) || runState.countdownTimerId) ) {
                    logToMobile(`GeoRun Post ${postId}: Ved startpunkt, men pips/countdown ikke ferdig.`, "debug");
                }
            }
        } else { // Løpet er aktivt
            if(setupSection) setupSection.style.display = 'none';
            if(activeSection) activeSection.style.display = 'block';
            if(resultsSection) resultsSection.style.display = 'none';

            const currentTargetIsPoint1 = targetPointId === 'geoRunPoint1';
            const currentTargetIsPoint2 = targetPointId === 'geoRunPoint2';

            if (isAtTargetPoint && ((runState.lap % 2 !== 0 && currentTargetIsPoint2) || (runState.lap % 2 === 0 && currentTargetIsPoint1))) {
                logToMobile(`GeoRun Post ${postId}: Vendepunkt ${targetPointId} nådd på runde ${runState.lap}.`, "info");
                playGeoRunTurnSound();

                if (runState.lap >= totalLapsForRun) { // Siste runde fullført
                    runState.finished = true;
                    runState.active = false;
                    runState.endTime = Date.now();
                    const totalTimeMs = runState.endTime - runState.startTime;
                    logToMobile(`GeoRun Post ${postId} FULLFØRT! Tid: ${formatTimeFromMs(totalTimeMs)}`, "info");

                    if(activeSection) activeSection.style.display = 'none';
                    if(resultsSection) resultsSection.style.display = 'block';
                    const timeEl = resultsSection.querySelector('.geo-run-total-time');
                    if(timeEl) timeEl.textContent = formatTimeFromMs(totalTimeMs);

                    let pointsAwarded = 0;
                    const totalTimeSeconds = totalTimeMs / 1000;
                    for (const threshold in postData.pointsScale) {
                        if (totalTimeSeconds <= parseFloat(threshold)) {
                            pointsAwarded = postData.pointsScale[threshold];
                            break;
                        }
                    }
                    const pointsEl = resultsSection.querySelector('.geo-run-points-awarded');
                    if(pointsEl) pointsEl.textContent = pointsAwarded;
                    const proceedBtn = resultsSection.querySelector(`#geo-run-proceed-btn-post${postId}`);
                    if(proceedBtn) proceedBtn.style.display = 'inline-block';

                    CoreApp.markPostAsCompleted(postId, pointsAwarded);
                    updateMapMarker(null, true); // Vis mål hvis dette var siste post, ellers neste post
                } else { // Forbered neste runde
                    runState.lap++;
                    if(currentLapEl) currentLapEl.textContent = `${runState.lap} av ${totalLapsForRun}`;
                    if (runState.lap % 2 !== 0) { // Løp mot Point2
                        if(nextTargetEl) nextTargetEl.textContent = postData.geoRunPoint2.name;
                        updateMapMarker(null, false, postData.geoRunPoint2);
                    } else { // Løp mot Point1
                        if(nextTargetEl) nextTargetEl.textContent = postData.geoRunPoint1.name;
                        updateMapMarker(null, false, postData.geoRunPoint1);
                    }
                }
                saveState();
            }
        }
    }


    function handleTaskCheck(postNum, userAnswer) {
        const postData = CoreApp.getPostData(postNum);
        if (!postData || postData.type !== 'standard') return;

        const pageElement = document.getElementById(`post-${postNum}-content-wrapper`);
        if (!pageElement) return;

        const feedbackEl = pageElement.querySelector(`#feedback-task-${postNum}`);
        const inputEl = pageElement.querySelector(`#post-${postNum}-task-input`);
        const attemptsEl = pageElement.querySelector(`#attempts-${postNum}`);
        const checkButton = pageElement.querySelector(`.check-task-btn[data-post="${postNum}"]`);

        if (!currentTeamData.taskAttempts) currentTeamData.taskAttempts = {};
        if (currentTeamData.taskAttempts[`post${postNum}`] === undefined) {
            currentTeamData.taskAttempts[`post${postNum}`] = 0;
        }

        currentTeamData.taskAttempts[`post${postNum}`]++;

        if (userAnswer.toUpperCase() === postData.correctAnswer.toUpperCase()) {
            if(feedbackEl) {
                feedbackEl.textContent = "Riktig svar! Bra jobbet!";
                feedbackEl.className = "feedback success";
            }
            if(inputEl) inputEl.disabled = true;
            if(checkButton) checkButton.disabled = true;
            if(attemptsEl) attemptsEl.textContent = `Post fullført!`;
            logToMobile(`Post ${postNum} korrekt besvart.`, "info");
            CoreApp.markPostAsCompleted(postNum, postData.pointsPerCorrect || 10); // Default 10 poeng
        } else {
            const remainingAttempts = (postData.maxAttempts || Infinity) - currentTeamData.taskAttempts[`post${postNum}`];
            if(feedbackEl) {
                feedbackEl.textContent = "Feil svar. Prøv igjen!";
                feedbackEl.className = "feedback error shake";
            }
            if(inputEl) { inputEl.value = ""; inputEl.focus(); }
            logToMobile(`Post ${postNum} feil besvart. Forsøk: ${currentTeamData.taskAttempts[`post${postNum}`]}.`, "warn");

            if (remainingAttempts <= 0 && postData.maxAttempts) {
                if(feedbackEl) feedbackEl.textContent = `Ingen flere forsøk igjen på denne posten.`;
                if(inputEl) inputEl.disabled = true;
                if(checkButton) checkButton.disabled = true;
                if(attemptsEl) attemptsEl.textContent = "Ingen flere forsøk.";
                logToMobile(`Post ${postNum}: Ingen flere forsøk. Markerer som fullført med 0 poeng.`, "info");
                CoreApp.markPostAsCompleted(postNum, 0); // Fullført med 0 poeng
            } else if (postData.maxAttempts) {
                if(attemptsEl) attemptsEl.textContent = `Forsøk igjen: ${remainingAttempts}`;
            } else if (attemptsEl){
                 attemptsEl.textContent = `Antall forsøk: ${currentTeamData.taskAttempts[`post${postNum}`]}`;
            }
            saveState(); // Lagre antall forsøk
            setTimeout(() => { if(feedbackEl) feedbackEl.classList.remove('shake'); }, 500);
        }
    }

    window.proceedToNextPostOrFinishGlobal = function() {
        if (!currentTeamData) return;
        logToMobile("proceedToNextPostOrFinishGlobal kalt.", "info");

        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) {
            logToMobile("Alle poster fullført. Viser finalesiden.", "info");
            showRebusPage('finale');
            updateMapMarker(null, true); // Vis mål-markør
            // Geofence for finale håndteres av handlePositionUpdate
        } else {
            currentTeamData.currentPostArrayIndex++;
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                logToMobile(`Går til neste post: ${nextPostGlobalId} (Indeks: ${currentTeamData.currentPostArrayIndex})`, "info");
                showRebusPage(`post-${nextPostGlobalId}`);
                updateMapMarker(nextPostGlobalId, false);
                saveState();
            } else {
                // Dette skal egentlig håndteres av den første if-en (completedPostsCount)
                logToMobile("Feil: Prøvde å gå forbi siste post i sekvensen, men ikke alle er fullført?", "error");
                showRebusPage('finale'); // Fallback til finale
                updateMapMarker(null, true);
            }
        }
    }

    function updateUIAfterLoad() {
        logToMobile("updateUIAfterLoad kalt.", "info");
        updateScoreDisplay();
        if (currentTeamData && currentTeamData.endTime) {
            stopContinuousUserPositionUpdate();
            if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';
        } else if (currentTeamData) {
            startContinuousUserPositionUpdate(); // Sørg for at den kjører
            if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'block';
        }
    }

    function handleFinishCodeInput(userAnswer) {
        const feedbackEl = document.getElementById('feedback-unlock-finish');
        const inputEl = document.getElementById('finish-unlock-input');
        const buttonEl = document.getElementById('finish-unlock-btn');

        if (!currentTeamData || currentTeamData.endTime) {
            logToMobile("Forsøkte å taste målkode, men spillet er allerede avsluttet eller ingen teamdata.", "warn");
            return;
        }
        if (!currentTeamData.canEnterFinishCode && !DEV_MODE_NO_GEOFENCE) {
            if(feedbackEl) {
                feedbackEl.textContent = "Du er ikke nær nok målområdet for å taste kode.";
                feedbackEl.className = "feedback error";
            }
            logToMobile("Forsøkte å taste målkode utenfor målområdet.", "warn");
            return;
        }

        if (userAnswer === FINISH_UNLOCK_CODE) {
            currentTeamData.endTime = Date.now();
            currentTeamData.totalTimeSeconds = Math.round((currentTeamData.endTime - currentTeamData.startTime) / 1000);
            if(feedbackEl) {
                feedbackEl.textContent = "Riktig kode! Spillet er fullført!";
                feedbackEl.className = "feedback success";
            }
            if(inputEl) inputEl.disabled = true;
            if(buttonEl) buttonEl.disabled = true;
            logToMobile(`Målkode korrekt! Spill fullført. Total tid: ${formatTime(currentTeamData.totalTimeSeconds)}s`, "info");

            saveState();
            stopContinuousUserPositionUpdate();
            if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';
            clearMapMarker(); // Fjern post-markør
            updateMapMarker(null, true); // Vis kun mål-markør (blå)
            displayFinalResults(); // Oppdater og vis resultatseksjonen på finalesiden
            const finaleCompletedSection = document.getElementById('finale-completed-section');
            const finaleUnlockSection = document.getElementById('finale-unlock-section');
            if(finaleCompletedSection) finaleCompletedSection.style.display = 'block';
            if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';

        } else {
            if(feedbackEl) {
                feedbackEl.textContent = "Feil målkode. Prøv igjen.";
                feedbackEl.className = "feedback error shake";
            }
            if(inputEl) { inputEl.value = ""; inputEl.focus(); }
            logToMobile("Feil målkode.", "warn");
            setTimeout(() => { if(feedbackEl) feedbackEl.classList.remove('shake'); }, 500);
        }
    }

    // === EVENT LISTENERS ===
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; const postData = CoreApp.getPostData(currentPostGlobalId); if(postData) { if(postData.type === 'georun' && currentTeamData.geoRunState[`post${currentPostGlobalId}`] && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].active && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].finished && postData.geoRunPoint1) { targetLocation = postData.geoRunPoint1; } else { targetLocation = {lat: postData.lat, lng: postData.lng}; } } } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });

    const globalDevResetButtons = document.querySelectorAll('.container > .dev-reset-button');
    globalDevResetButtons.forEach(button => { button.addEventListener('click', () => { if (confirm("Nullstille rebusen (global)?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); } }); });

    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { toggleLogBtn.addEventListener('click', () => { mobileLogContainer.style.display = mobileLogContainer.style.display === 'none' ? 'block' : 'none'; }); }
    if (clearLogBtn && mobileLogContainer) { clearLogBtn.addEventListener('click', () => { mobileLogContainer.innerHTML = ''; }); }

    if (postContentContainer) {
        postContentContainer.addEventListener('click', (event) => {
            const target = event.target;
            // logToMobile(`Klikk i postContentContainer. Target ID: ${target.id}, Class: ${target.className}`, "debug");

            if (target.id === 'start-with-team-code-button-dynamic' && !target.disabled) {
                const dynamicTeamCodeInput = postContentContainer.querySelector('#team-code-input-dynamic');
                if (dynamicTeamCodeInput) {
                    logToMobile("Startknapp (dynamisk) klikket. Kaller initializeTeam.", "debug");
                    initializeTeam(dynamicTeamCodeInput.value);
                } else {
                    logToMobile("FEIL: Fant ikke team-code-input-dynamic ved startknapp-klikk.", "error");
                }
            } else if (target.classList.contains('check-task-btn') && !target.disabled) {
                const postNum = parseInt(target.getAttribute('data-post'));
                const postData = CoreApp.getPostData(postNum);
                if (postData && postData.type === 'standard') {
                    const taskInput = postContentContainer.querySelector(`#post-${postNum}-task-input`);
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase());
                }
            } else if (target.classList.contains('submit-teacher-password-btn') && !target.disabled) {
                const postNum = parseInt(target.getAttribute('data-post'));
                const passInput = postContentContainer.querySelector(`#teacher-password-input-post${postNum}`);
                if(passInput) handleTeacherPassword(postNum, passInput.value.trim());
            } else if (target.id === 'submit-minigolf-post1' && !target.disabled) {
                // Bruker global handleMinigolfSubmit direkte, da post1.js ikke har egen submit-logikk
                handleMinigolfSubmit(1);
            }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { logToMobile("Minigolf proceed button clicked.", "debug"); window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) {
                const pointsInput = postContentContainer.querySelector('#pyramid-points-input-post8');
                if(pointsInput) {
                    // Bruker global handlePyramidPointsSubmit direkte
                    handlePyramidPointsSubmit(8, pointsInput.value.trim());
                }
            }
            else if (target.id === `pyramid-proceed-btn-post8` && !target.disabled) { logToMobile("Pyramid proceed button clicked.", "debug"); window.proceedToNextPostOrFinishGlobal(); } // Hvis en slik knapp legges til
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { logToMobile("Geo-run proceed button clicked.", "debug"); window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'finish-unlock-btn' && !target.disabled) {
                const finishCodeInput = postContentContainer.querySelector('#finish-unlock-input');
                if (finishCodeInput && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE) ) { handleFinishCodeInput(finishCodeInput.value.trim().toUpperCase()); }
                else if (finishCodeInput && currentTeamData && !currentTeamData.canEnterFinishCode && !DEV_MODE_NO_GEOFENCE) {
                    const feedbackEl = document.getElementById('feedback-unlock-finish');
                    if(feedbackEl) { feedbackEl.textContent = "Du er ikke nær nok målområdet."; feedbackEl.className = "feedback error"; }
                }
            } else if (target.classList.contains('dev-reset-button')) {
                 if (confirm("Nullstille rebusen?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); }
            }
        });

        postContentContainer.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.id === 'team-code-input-dynamic' && !target.disabled) {
                    event.preventDefault();
                    const dynamicStartButton = postContentContainer.querySelector('#start-with-team-code-button-dynamic');
                    if (dynamicStartButton && !dynamicStartButton.disabled) {
                        logToMobile("Enter i team-code-input-dynamic, klikker startknapp.", "debug");
                        dynamicStartButton.click();
                    }
                } else if (target.classList.contains('post-task-input') && !target.disabled) {
                    const postWrapperDiv = target.closest('div[id$="-content-wrapper"]');
                    if (postWrapperDiv) {
                        const pageId = postWrapperDiv.id.replace('-content-wrapper', '');
                        const postNum = parseInt(pageId.split('-')[1]);
                        const postData = CoreApp.getPostData(postNum);
                        if (postData && postData.type === 'standard') {
                            event.preventDefault(); const taskButton = postWrapperDiv.querySelector(`.check-task-btn[data-post="${postNum}"]`);
                            if (taskButton && !taskButton.disabled) taskButton.click();
                        }
                    }
                } else if (target.classList.contains('teacher-password-input') && !target.disabled) {
                     const postWrapperDiv = target.closest('div[id$="-content-wrapper"]');
                     if(postWrapperDiv) {
                         event.preventDefault(); const postNum = parseInt(postWrapperDiv.id.split('-')[1]);
                         const passButton = postWrapperDiv.querySelector('.submit-teacher-password-btn');
                         if(passButton && !passButton.disabled) passButton.click();
                    }
                } else if (target.id === 'finish-unlock-input' && !target.disabled) {
                    event.preventDefault();
                    const associatedButton = postContentContainer.querySelector('#finish-unlock-btn');
                    if (associatedButton && !associatedButton.disabled && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE)) { handleFinishCodeInput(target.value.trim().toUpperCase()); }
                }
            }
        });
    }

    document.addEventListener('postReached', function(event) { if (event.detail && event.detail.pageId) { logToMobile(`Custom event 'postReached' for pageId: ${event.detail.pageId}. Calling resetPageUI.`, "debug"); resetPageUI(event.detail.pageId, document.getElementById(event.detail.pageId + "-content-wrapper")); } });
    document.addEventListener('geoRunLogicTrigger', function(event) { if (event.detail) { logToMobile(`Custom event 'geoRunLogicTrigger' for target: ${event.detail.targetPointId}, postId: ${event.detail.postId}`, "debug"); handleGeoRunLogic(event.detail.isAtTargetPoint, event.detail.targetPointId, event.detail.postId); }});
    document.addEventListener('startGeoRunPrePipsTrigger', function(event) { logToMobile("Custom event 'startGeoRunPrePipsTrigger' mottatt.", "debug"); if (event.detail && event.detail.postId) { startGeoRunPreCountdownPips(event.detail.postId); } else { startGeoRunPreCountdownPips(); /* Fallback til default GEO_RUN_POST_ID */ } });
    document.addEventListener('scoreUpdated', updateScoreDisplay);
    document.addEventListener('requestProceedToNext', window.proceedToNextPostOrFinishGlobal);

    // === INITALISERING VED LASTING AV SIDE ===
    const postScriptsToLoad = [];
    for (let i = 1; i <= 10; i++) {
        postScriptsToLoad.push(`posts/post${i}.js`);
    }

    Promise.all(postScriptsToLoad.map(scriptPath => {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = false;
            script.onload = () => {
                logToMobile(`${scriptPath} lastet.`, "debug");
                const postNumMatch = scriptPath.match(/post(\d+)\.js$/);
                if (postNumMatch && postNumMatch[1]) {
                    const postNum = parseInt(postNumMatch[1]);
                    if (typeof window[`definePost${postNum}`] === 'function') {
                        // `definePostX` kaller nå CoreApp.registerPost internt.
                        // Vi trenger bare å sikre at definePostX blir kalt.
                        window[`definePost${postNum}`]();
                    } else {
                        logToMobile(`definePost${postNum} ikke funnet etter lasting av ${scriptPath}.`, "warn");
                    }
                }
                resolve(true);
            };
            script.onerror = () => { logToMobile(`FEIL ved lasting av ${scriptPath}.`, "error"); resolve(false); };
            document.head.appendChild(script);
        });
    }))
    .then((results) => {
        const successfullyLoaded = results.filter(res => res).length;
        logToMobile(`${successfullyLoaded} av ${postScriptsToLoad.length} post-spesifikke scripts forsøkt lastet & kjørt. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}. Initialiserer app-tilstand...`, "info");

        CoreApp.setReady();

        if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }
        if (loadState()) {
            logToMobile("Tilstand lastet fra localStorage.", "info");
            showTabContent('rebus');
            if (currentTeamData.endTime) { showRebusPage('finale'); if (map) updateMapMarker(null, true); }
            else if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) { showRebusPage('finale'); if (map) updateMapMarker(null, true); if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); }
            else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && currentTeamData.postSequence.length > 0 && Object.keys(CoreApp.registeredPostsData).length > 0) {
                const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                 if (CoreApp.getPostData(currentExpectedPostId)) {
                    showRebusPage(`post-${currentExpectedPostId}`);
                    // Kartmarkør oppdateres av showRebusPage eller handlePositionUpdate
                    if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
                 } else {
                    logToMobile(`Post ${currentExpectedPostId} fra lagret state er ikke registrert. Nullstiller.`, "warn");
                    clearState(); showRebusPage('intro');
                 }
            } else { logToMobile("Uventet tilstand ved lasting (eller ingen poster registrert), nullstiller.", "warn"); clearState(); showRebusPage('intro'); }
            updateUIAfterLoad();
        } else { logToMobile("Ingen lagret tilstand funnet, viser introduksjonsside.", "info"); showTabContent('rebus'); showRebusPage('intro'); }
        logToMobile("Initial page setup complete.", "info");
    });
});
/* Version: #42 */
