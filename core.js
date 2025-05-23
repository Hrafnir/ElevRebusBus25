/* Version: #47 */
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
let devModePositionUpdateIntervalId = null;

// === CoreApp Objekt DEFINERT GLOBALT ===
const CoreApp = {
    registeredPostsData: {},
    isReady: false,

    registerPost: function(postData) {
        if (!postData || typeof postData.id === 'undefined') {
            logToMobile("Ugyldig postData sendt til CoreApp.registerPost.", "error");
            return;
        }
        this.registeredPostsData[postData.id] = postData;
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

function handleGeolocationError(error, isFromWatchPosition = true) {
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

    if (DEV_MODE_NO_GEOFENCE && isFromWatchPosition && error.code !== error.PERMISSION_DENIED) {
        logToMobile("DEV_MODE: GPS feilet, men ikke pga. manglende tillatelse. Starter fallback interval for posisjonsoppdateringer.", "info");
        if (devModePositionUpdateIntervalId === null) {
            const dummyPosition = {
                coords: {
                    latitude: START_LOCATION.lat,
                    longitude: START_LOCATION.lng,
                    accuracy: 100, altitude: null, altitudeAccuracy: null, heading: null, speed: null
                },
                timestamp: Date.now()
            };
            updateUserPositionOnMap(dummyPosition);
            devModePositionUpdateIntervalId = setInterval(() => {
                handlePositionUpdate(dummyPosition);
            }, 5000);
        }
    } else if (error.code === error.PERMISSION_DENIED) {
        stopContinuousUserPositionUpdate();
    }
}

// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
function updateUserPositionOnMap(position) { if (!map) return; const userPos = { lat: position.coords.latitude, lng: position.coords.longitude }; if (userPositionMarker) { userPositionMarker.setPosition(userPos); } else { userPositionMarker = new google.maps.Marker({ position: userPos, map: map, title: "Din Posisjon", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } }); } }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) { if (!geofenceFeedbackElement) return; if (isFullyCompleted || (!currentTeamData)) { geofenceFeedbackElement.style.display = 'none'; return; } geofenceFeedbackElement.style.display = 'block'; geofenceFeedbackElement.classList.remove('permanent'); if (DEV_MODE_NO_GEOFENCE) { geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`; geofenceFeedbackElement.className = 'geofence-info dev-mode'; return; } if (distance === null) { geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`; geofenceFeedbackElement.className = 'geofence-info'; return; } const distanceFormatted = Math.round(distance); if (isEffectivelyWithinRange) { if (canInteractWithTarget) { geofenceFeedbackElement.textContent = targetName.toLowerCase().includes("mål") ? `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Tast inn målkoden!` : `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Lærer må taste passord eller oppgaven vises.`; } else { geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`; } geofenceFeedbackElement.className = 'geofence-success'; } else { geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`; geofenceFeedbackElement.className = 'geofence-error'; } }

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) {
        updateGeofenceFeedback(null, false, true, null, false); return;
    }

    let targetLocationDetails = null; let isCurrentTargetTheFinishLine = false; let isGeoRunActiveForCurrentPost = false;
    const currentGlobalIdOriginal = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
    const currentPostDataFromCore = CoreApp.getPostData(currentGlobalIdOriginal);

    if (currentPostDataFromCore && currentPostDataFromCore.type === 'georun' &&
        currentTeamData.geoRunState && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]) {
        const runState = currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`];
        isGeoRunActiveForCurrentPost = true;
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
            } else { isGeoRunActiveForCurrentPost = false; }
        }
    }

    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.finished)) {
        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name };
            isCurrentTargetTheFinishLine = true;
        } else if (Object.keys(CoreApp.registeredPostsData).length > 0) {
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            const postDataForNav = CoreApp.getPostData(currentGlobalId);
            if (postDataForNav && typeof postDataForNav.lat !== 'undefined' && typeof postDataForNav.lng !== 'undefined') {
                targetLocationDetails = { location: {lat: postDataForNav.lat, lng: postDataForNav.lng}, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postDataForNav.name || `Post ${currentGlobalId}` };
            } else { logToMobile(`handlePositionUpdate: Kunne ikke finne data eller koordinater for post ${currentGlobalId}. (Registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length})`, "warn"); }
        } else { logToMobile("handlePositionUpdate: Ingen registrerte poster, kan ikke bestemme mål.", "warn"); }
    }

    if (!targetLocationDetails) {
        updateGeofenceFeedback(null, false, false, null, false); return;
    }

    const userLat = position.coords.latitude; const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS; const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange;
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
                    if (runStateForPips && !runStateForPips.preRunPipTimerId && runStateForPips.preCountdownPipsDone < (thisPostData.preCountdownPips || 3) ) {
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
    if (mapPositionWatchId !== null || devModePositionUpdateIntervalId !== null) {
        logToMobile("Posisjonssporing (ekte eller fallback) er allerede aktiv.", "info");
        return;
    }
    logToMobile("Starter kontinuerlig GPS posisjonssporing (eller forsøker).", "info");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => { handleGeolocationError(error, true); },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
    if (DEV_MODE_NO_GEOFENCE) {
        setTimeout(() => {
            if (mapPositionWatchId !== null && !userPositionMarker && devModePositionUpdateIntervalId === null) {
                logToMobile("DEV_MODE: watchPosition aktiv, men ingen posisjon mottatt. Simulerer en feil for å potensielt starte fallback.", "debug");
                const permDeniedMsg = "Du må tillate posisjonstilgang.";
                if (!geofenceFeedbackElement || !geofenceFeedbackElement.textContent.includes(permDeniedMsg)) {
                    handleGeolocationError({ code: navigator.geolocation.TIMEOUT, message: "Simulert timeout for DEV_MODE fallback" }, true);
                }
            }
        }, 12000);
    }
}

function stopContinuousUserPositionUpdate() {
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        logToMobile("Stoppet kontinuerlig GPS sporing (ekte).", "info");
    }
    if (devModePositionUpdateIntervalId !== null) {
        clearInterval(devModePositionUpdateIntervalId);
        devModePositionUpdateIntervalId = null;
        logToMobile("Stoppet fallback intervall for posisjonsoppdateringer (DEV_MODE).", "info");
    }
}

document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output');
    logToMobile(`DEBUG_V47: DOMContentLoaded event fired.`, "info"); // NY VERSJON
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

    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }
    function displayFinalResults() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V47: Displaying final results.`, "info");
        const finalScoreSpan = document.getElementById('final-score');
        const totalTimeSpan = document.getElementById('total-time');
        const stageTimesList = document.getElementById('stage-times-list');

        if (finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
        if (totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
            totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
        }

        if (stageTimesList && currentTeamData.taskCompletionTimes) {
            stageTimesList.innerHTML = '';
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
            logToMobile(`Innhold for '${pageIdentifier}' lastet inn i postContentContainer. Forventet ID: ${expectedWrapperId}`, "debug");

            const loadedPageElement = document.getElementById(expectedWrapperId);
            // NY DIAGNOSTIKK LOGG
            logToMobile(`Type of loadedPageElement for ${expectedWrapperId}: ${typeof loadedPageElement}. Is null? ${loadedPageElement === null}. Value: ${loadedPageElement}`, "debug");

            if (!loadedPageElement || typeof loadedPageElement.querySelector !== 'function') {
                 logToMobile(`FEIL: Kunne ikke finne gyldig rot-element med ID '${expectedWrapperId}' eller det er ikke et DOM-element etter innlasting av ${pageIdentifier}. Funnet: ${loadedPageElement}`, "error");
                 // For å unngå at feilen i catch-blokken overskriver denne mer spesifikke loggen:
                 postContentContainer.innerHTML = `<p class="feedback error">Intern feil: Kunne ikke initialisere sideinnholdet korrekt for ${pageIdentifier}. Kontakt arrangør.</p>`;
                 return;
            }

            if (currentTeamData && pageIdentifier.startsWith('post-')) {
                const globalPostNumMatch = pageIdentifier.match(/post-(\d+)/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    updatePageText(loadedPageElement, teamPostNum, globalPostNum); // Send loadedPageElement

                    const postData = CoreApp.getPostData(globalPostNum);
                    if (postData && postData.type === 'georun' && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${globalPostNum}`] && !currentTeamData.geoRunState[`post${globalPostNum}`].active && !currentTeamData.geoRunState[`post${globalPostNum}`].finished) {
                        if (postData.geoRunPoint1) {
                            updateMapMarker(null, false, postData.geoRunPoint1);
                        } else {
                            logToMobile(`Post ${globalPostNum} er georun, men mangler geoRunPoint1 data for kartmarkør.`, "warn");
                        }
                    }
                }
            }

            resetPageUI(pageIdentifier, loadedPageElement); // Send loadedPageElement

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
                } else if (currentTeamData && currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'block';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                } else {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'block';
                    if (Object.keys(CoreApp.registeredPostsData).length === 0 && currentTeamData) {
                        if(finaleInfoSection) finaleInfoSection.innerHTML = "<p>Feil: Ingen poster er lastet inn i systemet. Kontakt en arrangør.</p>";
                    }
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
                    postData.initUI(loadedPageElement, currentTeamData); // Send loadedPageElement
                }
            }
        } catch (error) {
            logToMobile(`Feil ved lasting av sideinnhold for '${pageIdentifier}': ${error.message} (catch-blokk i showRebusPage)`, "error");
            postContentContainer.innerHTML = `<p class="feedback error">Kunne ikke laste innholdet for ${pageIdentifier}. Prøv å laste siden på nytt.</p>`;
        }
        logToMobile(`--- showRebusPage COMPLETED for pageIdentifier: '${pageIdentifier}' ---`, "info");
    }

    function showTabContent(tabId) { /* ... (uendret) ... */ }
    function loadState() { /* ... (uendret) ... */ }
    function clearState() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V47: clearState kalt`, "info");
        currentTeamData = null;
        saveState();
        stopContinuousUserPositionUpdate();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        clearMapMarker(); clearFinishMarker();
        if (map && START_LOCATION) map.panTo(START_LOCATION);
        if (scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        resetAllPostUIs();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';
        logToMobile("All state og UI nullstilt.", "info");
    }
    function resetPageUI(pageIdentifier, pageElementContext = null) { /* ... (uendret, men DEBUG-logg oppdatert/redusert) ... */
        // logToMobile(`DEBUG_V47: resetPageUI kalt for: ${pageIdentifier}`, "debug");
        const context = pageElementContext || postContentContainer; // context er nå loadedPageElement når kalt fra showRebusPage
        if (!context || typeof context.querySelector !== 'function') { // Sjekk om context er et gyldig element
            logToMobile(`resetPageUI: Ugyldig kontekst (${typeof context}) for ${pageIdentifier}. Kan ikke fortsette.`, "error");
            return;
        }

        let postNum = null;
        if (pageIdentifier && pageIdentifier.startsWith('post-')) {
            postNum = parseInt(pageIdentifier.split('-')[1]);
        }

        const postData = postNum ? CoreApp.getPostData(postNum) : null;
        // Undefined checks for teamData properties
        const isUnlocked = postData && currentTeamData && currentTeamData.unlockedPosts && currentTeamData.unlockedPosts[`post${postNum}`];
        const isCompleted = postData && currentTeamData && currentTeamData.completedGlobalPosts && currentTeamData.completedGlobalPosts[`post${postNum}`];
        const isTeacherVerified = postData && currentTeamData && currentTeamData.mannedPostTeacherVerified && currentTeamData.mannedPostTeacherVerified[`post${postNum}`];


        const postInfoSection = context.querySelector('.post-info-section');
        const taskSection = context.querySelector('.post-task-section');
        const teacherPasswordSection = context.querySelector('.teacher-password-section');
        const minigolfFormSection = context.querySelector('.minigolf-form-section');
        const pyramidPointsSection = context.querySelector('.pyramid-points-section');
        const geoRunSetupSection = context.querySelector('.geo-run-setup-section');
        const geoRunActiveSection = context.querySelector('.geo-run-active-section');
        const geoRunResultsSection = context.querySelector('.geo-run-results-section');

        [postInfoSection, taskSection, teacherPasswordSection, minigolfFormSection, pyramidPointsSection, geoRunSetupSection, geoRunActiveSection, geoRunResultsSection]
            .forEach(section => { if (section) section.style.display = 'none'; });

        if (postData) { // Bare fortsett hvis postData finnes
            if (isCompleted) {
                if (postData.type === 'standard' && taskSection) {
                    taskSection.style.display = 'block';
                    taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const feedbackEl = taskSection.querySelector('.feedback-task');
                    if (feedbackEl) { feedbackEl.textContent = "Post fullført!"; feedbackEl.className = "feedback success"; }
                } else if (postData.type === 'manned_minigolf' && minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                } else if (postData.type === 'manned_pyramid' && pyramidPointsSection) {
                    pyramidPointsSection.style.display = 'block';
                } else if (postData.type === 'georun' && geoRunResultsSection) {
                    geoRunResultsSection.style.display = 'block';
                } else if (postInfoSection) {
                    postInfoSection.style.display = 'block';
                    postInfoSection.innerHTML = `<p>Du har fullført denne posten.</p>`;
                }
            } else if (isUnlocked) {
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
                } else if (postData.type === 'manned_pyramid') {
                    if (isTeacherVerified && pyramidPointsSection) pyramidPointsSection.style.display = 'block';
                    else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
                } else if (postData.type === 'georun') {
                    const runState = currentTeamData.geoRunState && currentTeamData.geoRunState[`post${postNum}`];
                    if (runState) {
                        if (runState.finished && geoRunResultsSection) geoRunResultsSection.style.display = 'block';
                        else if (runState.active && geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                        else if (geoRunSetupSection) geoRunSetupSection.style.display = 'block';
                    } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
                }
            } else if (postInfoSection) {
                postInfoSection.style.display = 'block';
            }

            // initUI kalles nå fra showRebusPage etter at loadedPageElement er verifisert.
            // Vi trenger ikke å kalle den her igjen hvis pageElementContext er satt.
            // Men hvis pageElementContext er null (dvs. resetPageUI ble kalt uten et spesifikt element),
            // og vi er inne i en post-kontekst, bør vi kanskje vurdere å kalle initUI.
            // Foreløpig er dette OK, da showRebusPage alltid sender med loadedPageElement.
            if (pageElementContext && typeof postData.initUI === 'function') {
                 // initUI kalles allerede fra showRebusPage med loadedPageElement.
                 // Hvis resetPageUI kalles separat med et element, kan initUI kalles her.
                 // For nå, la showRebusPage håndtere det primære initUI-kallet.
            }
        } else if (pageIdentifier === 'intro') {
            const teamCodeInput = context.querySelector('#team-code-input-dynamic');
            if (teamCodeInput) teamCodeInput.value = '';
            const teamCodeFeedback = context.querySelector('#team-code-feedback-dynamic');
            if (teamCodeFeedback) teamCodeFeedback.textContent = '';
            const startButton = context.querySelector('#start-with-team-code-button-dynamic');
            if (startButton) startButton.disabled = false;
        } else if (pageIdentifier === 'finale') {
            const finishInput = context.querySelector('#finish-unlock-input');
            if (finishInput) finishInput.value = '';
            const finishFeedback = context.querySelector('#feedback-unlock-finish');
            if (finishFeedback) finishFeedback.textContent = '';
        }
    }
    function resetAllPostUIs() { /* ... (uendret) ... */ }
    function initializeTeam(teamCode) { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V47: initializeTeam kalt med kode: ${teamCode}`, "info");
        if (Object.keys(CoreApp.registeredPostsData).length === 0) {
            logToMobile("initializeTeam: Ingen poster er registrert i CoreApp. Kan ikke starte lag.", "error");
            const feedbackElDynamic = document.getElementById('team-code-feedback-dynamic');
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Systemfeil: Ingen poster lastet. Kontakt arrangør.";
                feedbackElDynamic.className = "feedback error";
            }
            return;
        }

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
            teamCode: teamCode.toUpperCase(), teamName: teamConfig.name, postSequence: teamConfig.postSequence,
            currentPostArrayIndex: 0, score: 0, startTime: Date.now(), endTime: null, totalTimeSeconds: null,
            completedPostsCount: 0, completedGlobalPosts: {}, unlockedPosts: {}, taskAttempts: {},
            taskCompletionTimes: {}, mannedPostTeacherVerified: {}, minigolfScores: {}, pyramidPoints: {},
            geoRunState: {}, arrivalSoundPlayed: {}, canEnterFinishCode: false
        };

        currentTeamData.postSequence.forEach(postId => {
            const postData = CoreApp.getPostData(postId);
            if (postData && postData.type === 'georun') {
                currentTeamData.geoRunState[`post${postId}`] = {
                    active: false, finished: false, startTime: null, endTime: null, lap: 0,
                    preCountdownPipsDone: 0, preRunPipTimerId: null, countdownTimerId: null,
                    totalLaps: postData.lapsNormal
                };
            }
        });

        saveState();
        logToMobile(`Lag ${currentTeamData.teamName} initialisert. Starter på post ${currentTeamData.postSequence[0]}. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}`, "info");

        const firstPostId = currentTeamData.postSequence[0];
        showRebusPage(`post-${firstPostId}`);
        updateMapMarker(firstPostId, false);
        startContinuousUserPositionUpdate();
        updateScoreDisplay();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'block';
    }
    function handleTeacherPassword(postNum, password) { /* ... (uendret) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (uendret) ... */ }
    function handlePyramidPointsSubmit(postNum, pointsStr) { /* ... (uendret) ... */ }
    function startGeoRunPreCountdownPips(postId = GEO_RUN_POST_ID) { /* ... (uendret) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId, currentGeoRunPostId = null) { /* ... (uendret) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret) ... */ }
    window.proceedToNextPostOrFinishGlobal = function() { /* ... (uendret) ... */ }
    function updateUIAfterLoad() { /* ... (uendret) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (uendret) ... */ }

    // === EVENT LISTENERS (uendret) ===
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) ) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; const postData = CoreApp.getPostData(currentPostGlobalId); if(postData) { if(postData.type === 'georun' && currentTeamData.geoRunState[`post${currentPostGlobalId}`] && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].active && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].finished && postData.geoRunPoint1) { targetLocation = postData.geoRunPoint1; } else { targetLocation = {lat: postData.lat, lng: postData.lng}; } } } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
    const globalDevResetButtons = document.querySelectorAll('.container > .dev-reset-button');
    globalDevResetButtons.forEach(button => { button.addEventListener('click', () => { if (confirm("Nullstille rebusen (global)?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); } }); });
    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { toggleLogBtn.addEventListener('click', () => { mobileLogContainer.style.display = mobileLogContainer.style.display === 'none' ? 'block' : 'none'; }); }
    if (clearLogBtn && mobileLogContainer) { clearLogBtn.addEventListener('click', () => { mobileLogContainer.innerHTML = ''; }); }
    if (postContentContainer) {
        postContentContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.id === 'start-with-team-code-button-dynamic' && !target.disabled) {
                const dynamicTeamCodeInput = postContentContainer.querySelector('#team-code-input-dynamic');
                if (dynamicTeamCodeInput) { initializeTeam(dynamicTeamCodeInput.value); }
                else { logToMobile("FEIL: Fant ikke team-code-input-dynamic.", "error"); }
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
            } else if (target.id === 'submit-minigolf-post1' && !target.disabled) { handleMinigolfSubmit(1); }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) {
                const pointsInput = postContentContainer.querySelector('#pyramid-points-input-post8');
                if(pointsInput) { handlePyramidPointsSubmit(8, pointsInput.value.trim()); }
            }
            else if (target.id === `pyramid-proceed-btn-post8` && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
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
                    if (dynamicStartButton && !dynamicStartButton.disabled) { dynamicStartButton.click(); }
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
    document.addEventListener('postReached', function(event) { if (event.detail && event.detail.pageId) { resetPageUI(event.detail.pageId, document.getElementById(event.detail.pageId + "-content-wrapper")); } });
    document.addEventListener('geoRunLogicTrigger', function(event) { if (event.detail) { handleGeoRunLogic(event.detail.isAtTargetPoint, event.detail.targetPointId, event.detail.postId); }});
    document.addEventListener('startGeoRunPrePipsTrigger', function(event) { if (event.detail && event.detail.postId) { startGeoRunPreCountdownPips(event.detail.postId); } else { startGeoRunPreCountdownPips(); } });
    document.addEventListener('scoreUpdated', updateScoreDisplay);
    document.addEventListener('requestProceedToNext', window.proceedToNextPostOrFinishGlobal);

    // === INITALISERING VED LASTING AV SIDE (uendret) ===
    const postScriptsToLoad = [];
    for (let i = 1; i <= TOTAL_POSTS; i++) { postScriptsToLoad.push(`posts/post${i}.js`); }
    Promise.all(postScriptsToLoad.map(scriptPath => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = false;
            script.onload = () => { logToMobile(`${scriptPath} lastet.`, "debug"); resolve(true); };
            script.onerror = () => { logToMobile(`FEIL ved lasting av ${scriptPath}.`, "error"); reject(new Error(`Failed to load ${scriptPath}`)); };
            document.head.appendChild(script);
        });
    }))
    .then(() => {
        logToMobile(`Alle ${postScriptsToLoad.length} post-spesifikke scripts lastet. Registrerer poster...`, "info");
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const defineFunctionName = `definePost${i}`;
            if (typeof window[defineFunctionName] === 'function') {
                try {
                    const postData = window[defineFunctionName]();
                    if (postData) { CoreApp.registerPost(postData); }
                    else { logToMobile(`${defineFunctionName} returnerte ikke data. Post ${i} ikke registrert.`, "warn"); }
                } catch (e) { logToMobile(`Feil under kjøring av ${defineFunctionName} eller registrering av post ${i}: ${e.message}`, "error"); }
            } else { logToMobile(`${defineFunctionName} er ikke definert. Post ${i} kan ikke registreres.`, "warn"); }
        }
        logToMobile(`Post-registrering fullført. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}.`, "info");
        CoreApp.setReady();
        if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }
        if (loadState()) {
            logToMobile("Tilstand lastet fra localStorage.", "info");
            showTabContent('rebus');
            if (currentTeamData.endTime) {
                showRebusPage('finale');
                if (map) updateMapMarker(null, true);
            } else if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
                showRebusPage('finale');
                if (map) updateMapMarker(null, true);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && currentTeamData.postSequence.length > 0 && Object.keys(CoreApp.registeredPostsData).length > 0) {
                const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                 if (CoreApp.getPostData(currentExpectedPostId)) {
                    showRebusPage(`post-${currentExpectedPostId}`);
                    if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
                 } else {
                    logToMobile(`Post ${currentExpectedPostId} fra lagret state er ikke registrert (Antall registrerte: ${Object.keys(CoreApp.registeredPostsData).length}). Nullstiller.`, "warn");
                    clearState(); showRebusPage('intro');
                 }
            } else {
                logToMobile("Uventet tilstand ved lasting (eller ingen poster registrert), nullstiller.", "warn");
                clearState(); showRebusPage('intro');
            }
            updateUIAfterLoad();
        } else {
            logToMobile("Ingen lagret tilstand funnet, viser introduksjonsside.", "info");
            showTabContent('rebus');
            showRebusPage('intro');
        }
        logToMobile("Initial page setup complete.", "info");
    })
    .catch(error => {
        logToMobile(`Alvorlig feil under lasting av post-skript: ${error.message}. Applikasjonen kan være ustabil.`, "error");
        postContentContainer.innerHTML = `<p class="feedback error">En kritisk feil oppstod under lasting av spillets data. Prøv å laste siden på nytt, eller kontakt en arrangør.</p>`;
    });
});
/* Version: #47 */
