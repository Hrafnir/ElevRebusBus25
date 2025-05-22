/* Version: #36 */
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

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10;
const GEOFENCE_RADIUS = 25; 
const DEV_MODE_NO_GEOFENCE = false; 
const FINISH_UNLOCK_CODE = "FASTLAND24"; 
const MANNED_POST_PASSWORDS = { post1: "GOLFMESTER", post8: "PYRAMIDEBYGGER" };
const MAX_PLAYERS_PER_TEAM = 6; 
const GEO_RUN_POST_ID = 7;
const GEO_RUN_LAPS_NORMAL = 2; 
const GEO_RUN_LAPS_TEST = 1; 
const GEO_RUN_LAPS = DEV_MODE_NO_GEOFENCE ? GEO_RUN_LAPS_TEST : GEO_RUN_LAPS_NORMAL; 
const GEO_RUN_PRE_COUNTDOWN_PIPS = 3; 
const GEO_RUN_PRE_COUNTDOWN_INTERVAL_SECONDS = 20; 
const GEO_RUN_COUNTDOWN_SECONDS = 10; 
const GEO_RUN_POINT1 = { lat: 60.8006280021653, lng: 10.683461472668988, name: "Start/Vendepunkt 1 (Geo-løp)" };
const GEO_RUN_POINT2 = { lat: 60.79971947637134, lng: 10.683614899042398, name: "Vendepunkt 2 (Geo-løp)" };
const GEO_RUN_POINTS_SCALE = { 30: 10, 40: 9, 50: 8, 60: 7, 75: 6, 90: 5, 105: 4, 120: 3, 150: 2, Infinity: 1 };
const START_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Start: Fastland", name: "Start: Fastland" };
const FINISH_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Mål: Fastland", name: "Mål: Fastland" };
const POST_LOCATIONS = [
    { lat: 60.7962307499199, lng: 10.667771549607588, title: "Post 1", name: "Bassengparken"},
    { lat: 60.7941862597763, lng: 10.656946793729826, title: "Post 2", name: "Hunn Kirke"},
    { lat: 60.80121161360927, lng: 10.645440903323017, title: "Post 3", name: "Lavvoen Øverby"},
    { lat: 60.80469643634315, lng: 10.646298022954033, title: "Post 4", name: "Åttekanten på Eiktunet"},
    { lat: 60.803527350299944, lng: 10.66552015165931, title: "Post 5", name: "Krysset Øverbyvegen/Prost Bloms Gate"},
    { lat: 60.80202682020165, lng: 10.673687047853834, title: "Post 6", name: "Hunn Gravlund"},
    { lat: GEO_RUN_POINT1.lat, lng: GEO_RUN_POINT1.lng, title: "Post 7", name: "Geo-løp Start"},
    { lat: 60.794004447513956, lng: 10.692558505369421, title: "Post 8", name: "Scenen Gjøvik Gård"},
    { lat: 60.793249975246106, lng: 10.685006947085599, title: "Post 9", name: "Gjøvik Olympiske Fjellhall"},
    { lat: 60.793880419179715, lng: 10.678003145501888, title: "Post 10", name: "Hovdetoppen Restaurant"}
];
const CORRECT_TASK_ANSWERS = {
    post1: "MINIGOLF FULLFØRT", post2: "SVARPOST2", post3: "SVARPOST3", post4: "SVARPOST4", post5: "SVARPOST5",
    post6: "SVARPOST6", post7: "GEOLØP FULLFØRT", post8: "PYRAMIDE FULLFØRT", post9: "SVARPOST9", post10: "SVARPOST10"
};
const MAX_ATTEMPTS_PER_TASK = 5; 
const POINTS_PER_CORRECT_TASK = 10; 

// === HJELPEFUNKSJONER (Globale) ===
function calculateDistance(lat1, lon1, lat2, lon2) { const R = 6371e3; const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180; const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); return R * c; }
function formatTime(totalSeconds) { if (totalSeconds === null || totalSeconds === undefined) return "00:00"; const hours = Math.floor(totalSeconds / 3600); const minutes = Math.floor((totalSeconds % 3600) / 60); const seconds = totalSeconds % 60; const paddedHours = String(hours).padStart(2, '0'); const paddedMinutes = String(minutes).padStart(2, '0'); const paddedSeconds = String(seconds).padStart(2, '0'); if (hours > 0) return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`; else return `${paddedMinutes}:${paddedSeconds}`; }
function formatTimeFromMs(ms) { if (ms === null || ms === undefined || ms < 0) return "00:00"; return formatTime(Math.round(ms / 1000)); }

// === Mobil Loggfunksjon ===
function logToMobile(message, level = 'log') {
    console[level](message); 
    if (mobileLogContainer) {
        const logEntry = document.createElement('div');
        logEntry.textContent = `[${level.toUpperCase()}] ${new Date().toLocaleTimeString()}: ${message}`;
        logEntry.classList.add('log-entry');
        logEntry.classList.add(`log-level-${level}`);
        mobileLogContainer.appendChild(logEntry);
        mobileLogContainer.scrollTop = mobileLogContainer.scrollHeight; 
    }
}

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
window.initMap = function() { mapElement = document.getElementById('dynamic-map-container'); if (!mapElement) { setTimeout(window.initMap, 500); return; } geofenceFeedbackElement = document.getElementById('geofence-feedback'); const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ]; map = new google.maps.Map(mapElement, { center: START_LOCATION, zoom: 15, mapTypeId: google.maps.MapTypeId.HYBRID, styles: mapStyles, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true, mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID] } }); if (currentTeamData) { if (currentTeamData.completedPostsCount >= TOTAL_POSTS && !currentTeamData.endTime) { updateMapMarker(null, true); } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; updateMapMarker(currentPostGlobalId, false); } else { updateMapMarker(null, true); } startContinuousUserPositionUpdate(); } logToMobile("Skolerebus Kart initialisert.", "info"); }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false, customLocation = null) { if (!map) { logToMobile("Kart ikke initialisert for updateMapMarker.", "warn"); return; } clearMapMarker(); if (!customLocation) clearFinishMarker(); let locationDetails, markerTitle, markerIconUrl; if (customLocation) { locationDetails = customLocation; markerTitle = customLocation.name || "Geo-løp Punkt"; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'; } else if (isFinalTarget) { locationDetails = FINISH_LOCATION; markerTitle = FINISH_LOCATION.title; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'; if (finishMarker) finishMarker.setMap(null); finishMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < 16) map.setZoom(16); } return; } else { if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) { logToMobile(`Ugyldig postGlobalId for updateMapMarker: ${postGlobalId}`, "warn"); return; } locationDetails = POST_LOCATIONS[postGlobalId - 1]; markerTitle = `Neste: ${locationDetails.name || locationDetails.title}`; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'; } currentMapMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < (customLocation ? 18 : 15) ) map.setZoom((customLocation ? 18 : 15)); } logToMobile(`Kartmarkør oppdatert til: ${markerTitle}`, "debug");}
function clearMapMarker() { if (currentMapMarker) { currentMapMarker.setMap(null); currentMapMarker = null; } }
function clearFinishMarker() { if (finishMarker) { finishMarker.setMap(null); finishMarker = null; } }
function handleGeolocationError(error) { let msg = "Posisjonsfeil: "; switch (error.code) { case error.PERMISSION_DENIED: msg += "Du må tillate posisjonstilgang."; break; case error.POSITION_UNAVAILABLE: msg += "Posisjonen din er utilgjengelig."; break; case error.TIMEOUT: msg += "Tok for lang tid å hente posisjonen."; break; default: msg += "Ukjent GPS-feil."; } logToMobile(msg, "warn"); if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = msg; geofenceFeedbackElement.className = 'geofence-error permanent'; geofenceFeedbackElement.style.display = 'block'; } }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
function updateUserPositionOnMap(position) { if (!map) return; const userPos = { lat: position.coords.latitude, lng: position.coords.longitude }; if (userPositionMarker) { userPositionMarker.setPosition(userPos); } else { userPositionMarker = new google.maps.Marker({ position: userPos, map: map, title: "Din Posisjon", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } }); } }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) { if (!geofenceFeedbackElement) return; if (isFullyCompleted || (!currentTeamData)) { geofenceFeedbackElement.style.display = 'none'; return; } geofenceFeedbackElement.style.display = 'block'; geofenceFeedbackElement.classList.remove('permanent'); if (DEV_MODE_NO_GEOFENCE) { geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`; geofenceFeedbackElement.className = 'geofence-info dev-mode'; return; } if (distance === null) { geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`; geofenceFeedbackElement.className = 'geofence-info'; return; } const distanceFormatted = Math.round(distance); if (isEffectivelyWithinRange) { if (canInteractWithTarget) { geofenceFeedbackElement.textContent = targetName.toLowerCase().includes("mål") ? `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Tast inn målkoden!` : `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Lærer må taste passord eller oppgaven vises.`; } else { geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`; } geofenceFeedbackElement.className = 'geofence-success'; } else { geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`; geofenceFeedbackElement.className = 'geofence-error'; } }

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);
    logToMobile(`handlePositionUpdate: Lat: ${position.coords.latitude.toFixed(5)}, Lng: ${position.coords.longitude.toFixed(5)}`, "debug");

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) { 
        logToMobile("handlePositionUpdate: Ingen teamdata, avslutter.", "debug");
        updateGeofenceFeedback(null, false, true, null, false); return;
    }

    let targetLocationDetails = null; let isCurrentTargetTheFinishLine = false; let isGeoRunActiveForCurrentPost = false;
    const currentGlobalIdOriginal = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
    logToMobile(`handlePositionUpdate: currentGlobalIdOriginal: ${currentGlobalIdOriginal}`, "debug");


    if (currentGlobalIdOriginal === GEO_RUN_POST_ID && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]) {
        const runState = currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]; 
        isGeoRunActiveForCurrentPost = true; 
        logToMobile(`handlePositionUpdate: Er på Post 7 (GeoRun). RunState active: ${runState.active}, finished: ${runState.finished}, prePipsDone: ${runState.preCountdownPipsDone}`, "debug");

        if (runState.preCountdownPipsDone < GEO_RUN_PRE_COUNTDOWN_PIPS && !runState.active && !runState.finished && !runState.preRunPipTimerId) { 
            targetLocationDetails = { location: GEO_RUN_POINT1, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunPreCountdown`, name: GEO_RUN_POINT1.name };
            logToMobile("handlePositionUpdate: Mål for GeoRun er preCountdown.", "debug");
        } else if (!runState.active && !runState.finished) { 
            targetLocationDetails = { location: GEO_RUN_POINT1, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunStart`, name: GEO_RUN_POINT1.name }; 
            logToMobile("handlePositionUpdate: Mål for GeoRun er startpunkt.", "debug");
        } else if (runState.active && !runState.finished) { 
            if (runState.lap % 2 !== 0) { targetLocationDetails = { location: GEO_RUN_POINT2, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunPoint2`, name: GEO_RUN_POINT2.name }; } 
            else { targetLocationDetails = { location: GEO_RUN_POINT1, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunPoint1`, name: GEO_RUN_POINT1.name }; } 
            logToMobile(`handlePositionUpdate: Mål for GeoRun er aktivt løp, target: ${targetLocationDetails.name}`, "debug");
        } else {
            isGeoRunActiveForCurrentPost = false; 
            logToMobile("handlePositionUpdate: GeoRun er ferdig, bruker vanlig postlogikk.", "debug");
        }
    }

    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) {
        if (currentTeamData.completedPostsCount >= TOTAL_POSTS) { 
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name }; 
            isCurrentTargetTheFinishLine = true; 
            logToMobile("handlePositionUpdate: Mål er FINISH_LOCATION.", "debug");
        } else { 
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; 
            if (currentGlobalId && POST_LOCATIONS[currentGlobalId - 1]) { 
                const postData = POST_LOCATIONS[currentGlobalId - 1]; 
                targetLocationDetails = { location: postData, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postData.name || `Post ${currentGlobalId}` }; 
                logToMobile(`handlePositionUpdate: Mål er Post ${currentGlobalId}.`, "debug");
            } 
        }
    }

    if (!targetLocationDetails) { 
        logToMobile("handlePositionUpdate: Ingen targetLocationDetails funnet.", "warn");
        updateGeofenceFeedback(null, false, false, null, false); return; 
    }

    const userLat = position.coords.latitude; const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS; const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange; 
    logToMobile(`handlePositionUpdate: Target: ${targetLocationDetails.name}, Avstand: ${distance.toFixed(1)}m, InnenforRange: ${isWithinRange}, EffektivtInnenfor: ${isEffectivelyWithinRange}`, "debug");
    
    let canCurrentlyInteract = false; 
    if (isCurrentTargetTheFinishLine) {
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange; 
        const finishUnlockInput = document.getElementById('finish-unlock-input'); // Hentes fra dynamisk HTML
        const finishUnlockButton = document.getElementById('finish-unlock-btn'); // Hentes fra dynamisk HTML
        if(finishUnlockInput) finishUnlockInput.disabled = !isEffectivelyWithinRange; 
        if(finishUnlockButton) finishUnlockButton.disabled = !isEffectivelyWithinRange;
        if (isEffectivelyWithinRange && !currentTeamData.arrivalSoundPlayed.finish) { playArrivalSound(); currentTeamData.arrivalSoundPlayed.finish = true; saveState(); } 
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else if (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].finished) {
        document.dispatchEvent(new CustomEvent('geoRunLogicTrigger', { detail: { isAtTargetPoint: isEffectivelyWithinRange, targetPointId: targetLocationDetails.globalId } }));
    } else { 
        const postGlobalId = targetLocationDetails.globalId; const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];
        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            logToMobile(`Post ${postGlobalId} nådd. Låser opp.`, "info"); 
            currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            if (!currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`]) { 
                if (postGlobalId === GEO_RUN_POST_ID) { 
                    if (currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].preRunPipTimerId && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].preCountdownPipsDone < GEO_RUN_PRE_COUNTDOWN_PIPS) {
                        document.dispatchEvent(new CustomEvent('startGeoRunPrePipsTrigger'));
                    }
                } else { playArrivalSound(); }
                currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`] = true; 
            } 
            saveState(); document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
            canCurrentlyInteract = true; 
        } else if (isPostAlreadyUnlocked) { if (postGlobalId === 1 || postGlobalId === 8) { canCurrentlyInteract = !currentTeamData.mannedPostTeacherVerified[`post${postGlobalId}`]; } else { canCurrentlyInteract = false; } }
    }
    if (!isGeoRunActiveForCurrentPost || (currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) { updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract); }
}

function startContinuousUserPositionUpdate() { if (!navigator.geolocation) { logToMobile("Geolocation ikke støttet.", "warn"); return; } if (mapPositionWatchId !== null) return; logToMobile("Starter kontinuerlig GPS posisjonssporing.", "info"); mapPositionWatchId = navigator.geolocation.watchPosition( handlePositionUpdate, (error) => { handleGeolocationError(error); if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) {} }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }); }
function stopContinuousUserPositionUpdate() { if (mapPositionWatchId !== null) { navigator.geolocation.clearWatch(mapPositionWatchId); mapPositionWatchId = null; logToMobile("Stoppet kontinuerlig GPS sporing.", "info"); updateGeofenceFeedback(null, false, true, null, false); } }


document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output'); 
    logToMobile("DEBUG_V36: DOMContentLoaded event fired.", "info"); // Oppdatert versjonsnummer
    initializeSounds(); 
    
    // Elementer i hoved-index.html som IKKE lastes dynamisk per post
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    geofenceFeedbackElement = document.getElementById('geofence-feedback'); // Allerede global, men greit å ha ref.
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
        const mannedPostTitleElement = pageElement.querySelector('.manned-post-title-placeholder'); 
        // For vanlige oppgaver (ikke bemannet, ikke geo-løp)
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder'); 
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder'); 
        // For bemannede poster (post 1 og 8)
        const mannedPostInstructionElement = pageElement.querySelector('.manned-post-instruction-placeholder');

        if (globalPostId === null || globalPostId === undefined || globalPostId === 'finish') return;
        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) titleElement.textContent = `Post ${teamPostNumber}/${TOTAL_POSTS}: ${postName}`;
        
        if (postInfoElement) { // Denne vises før posten er "låst opp"
            if (globalPostId === GEO_RUN_POST_ID) {
                postInfoElement.textContent = `Bruk kartet for å finne startpunktet for Geo-løpet på ${postName}.`;
            } else {
                postInfoElement.textContent = `Bruk kartet for å finne ${postName}.`;
            }
        }
        
        if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
        if (taskQuestionElement && globalPostId !== 1 && globalPostId !== 8 && globalPostId !== GEO_RUN_POST_ID) {
            taskQuestionElement.textContent = `Her kommer oppgaven for ${postName}. (Svar med fasit: ${CORRECT_TASK_ANSWERS['post'+globalPostId]})`;
        }
        
        if (mannedPostTitleElement) mannedPostTitleElement.textContent = `Bemannet Post: ${postName}`;
        if (mannedPostInstructionElement) {
            if (globalPostId === 1) {
                mannedPostInstructionElement.textContent = "Velkommen til Minigolf! Læreren vil guide dere og taste inn et passord når dere er klare.";
            } else if (globalPostId === 8) {
                mannedPostInstructionElement.textContent = "Velkommen til Pyramidebygging! Læreren vil guide dere og taste inn et passord.";
            }
        }
    }

    function displayFinalResults() { /* ... (som i v33) ... */ }

    async function showRebusPage(pageIdentifier) { 
        logToMobile(`--- showRebusPage CALLED with pageIdentifier: '${pageIdentifier}' ---`, "info");
        if (!postContentContainer) { logToMobile("CRITICAL - postContentContainer is NULL in showRebusPage! Kan ikke laste innhold.", "error"); return; }

        let htmlFileToFetch;
        if (pageIdentifier === 'intro') { htmlFileToFetch = 'posts/intro.html'; }
        else if (pageIdentifier === 'finale') { htmlFileToFetch = 'posts/finale.html'; }
        else if (pageIdentifier.startsWith('post-')) { const postNum = pageIdentifier.split('-')[1]; htmlFileToFetch = `posts/post${postNum}.html`; }
        else { logToMobile(`Ugyldig pageIdentifier for showRebusPage: ${pageIdentifier}`, "error"); htmlFileToFetch = 'posts/intro.html'; }

        try {
            const response = await fetch(htmlFileToFetch);
            if (!response.ok) { throw new Error(`HTTP error! status: ${response.status} for ${htmlFileToFetch}`); }
            const htmlContent = await response.text();
            postContentContainer.innerHTML = htmlContent;
            logToMobile(`Innhold for '${pageIdentifier}' lastet inn i postContentContainer.`, "debug");

            if (currentTeamData && pageIdentifier.startsWith('post-')) {
                const globalPostNumMatch = pageIdentifier.match(/post-(\d+)/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    const loadedPageElement = postContentContainer.firstChild; 
                    if (loadedPageElement) { // Sjekk at elementet faktisk finnes
                        updatePageText(loadedPageElement, teamPostNum, globalPostNum);
                        if (globalPostNum === GEO_RUN_POST_ID && currentTeamData.geoRunState && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].active && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].finished) {
                            updateMapMarker(null, false, GEO_RUN_POINT1);
                        }
                    } else {
                        logToMobile(`FEIL: loadedPageElement er null etter lasting av ${pageIdentifier}`, "error");
                    }
                }
            }
            
            resetPageUI(pageIdentifier); 
            
            if (currentTeamData && pageIdentifier !== 'intro') { updateScoreDisplay(); } 
            else if (scoreDisplayElement) { scoreDisplayElement.style.display = 'none'; }
            
            if (pageIdentifier === 'finale') {
                const finaleUnlockSection = document.getElementById('finale-unlock-section'); 
                const finaleCompletedSection = document.getElementById('finale-completed-section'); 
                const finaleInfoSection = document.getElementById('finale-info-section'); 
                if (currentTeamData && currentTeamData.endTime) { 
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'block';
                    displayFinalResults(); 
                } else if (currentTeamData && currentTeamData.completedPostsCount >= TOTAL_POSTS) { 
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
        } catch (error) {
            logToMobile(`Feil ved lasting av sideinnhold for '${pageIdentifier}': ${error.message}`, "error");
            postContentContainer.innerHTML = `<p class="feedback error">Kunne ikke laste innholdet for denne siden. Prøv å laste siden på nytt.</p>`;
        }
        logToMobile(`--- showRebusPage COMPLETED for pageIdentifier: '${pageIdentifier}' ---`, "info");
    }

    function showTabContent(tabId) { /* ... (uendret) ... */ }
    
    function loadState() { /* ... (som i v33) ... */ } 
    function clearState() { /* ... (som i v33, men med DEBUG_V34 i logg) ... */
        if(preRunPipTimerId) clearInterval(preRunPipTimerId); 
        if(currentTeamData && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]) {
            if(currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].countdownTimerId) {
                clearInterval(currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].countdownTimerId);
            }
             if(currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].preRunPipTimerId) { 
                clearInterval(currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].preRunPipTimerId);
            }
        }
        localStorage.removeItem('activeTeamData_Skolerebus'); currentTeamData = null;
        resetAllPostUIs(); 
        clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); 
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        // Hent referanser på nytt her, da de kan være borte hvis intro.html ikke er lastet
        const introTeamCodeInput = document.getElementById('team-code-input-dynamic'); 
        const introStartButton = document.getElementById('start-with-team-code-button-dynamic');
        const introFeedback = document.getElementById('team-code-feedback-dynamic');

        if(introTeamCodeInput) { introTeamCodeInput.value = ''; introTeamCodeInput.disabled = false;}
        if(introStartButton) introStartButton.disabled = false;
        if(introFeedback) { introFeedback.textContent = ''; introFeedback.className = 'feedback';}
        
        if (geofenceFeedbackElement) { geofenceFeedbackElement.style.display = 'none'; geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = ''; }
        logToMobile("State cleared by clearState().", "info");
    }

    function resetPageUI(pageIdentifier) { 
        const pageElement = postContentContainer.firstChild; 
        if (!pageElement) { logToMobile(`resetPageUI: Finner ikke pageElement for '${pageIdentifier}' i postContentContainer.`, "warn"); return; }
        
        let postNum = null;
        if (pageIdentifier.startsWith('post-')) { postNum = parseInt(pageIdentifier.split('-')[1]); }

        logToMobile(`resetPageUI for pageIdentifier: '${pageIdentifier}', postNum: ${postNum}`, "debug");

        if (pageIdentifier === 'intro') { 
            const teamCodeInputForIntroReset = document.getElementById('team-code-input-dynamic'); 
            const startButtonForIntroReset = document.getElementById('start-with-team-code-button-dynamic');
            if(teamCodeInputForIntroReset) teamCodeInputForIntroReset.disabled = false;
            if(startButtonForIntroReset) startButtonForIntroReset.disabled = false;
            return;
        }

        if (pageIdentifier === 'finale') {
            const unlockInput = document.getElementById('finish-unlock-input'); 
            const unlockButton = document.getElementById('finish-unlock-btn');
            const unlockFeedback = document.getElementById('feedback-unlock-finish'); 
            const shouldBeDisabled = !(currentTeamData && currentTeamData.canEnterFinishCode) && !DEV_MODE_NO_GEOFENCE;
            if (unlockInput) { unlockInput.disabled = shouldBeDisabled; unlockInput.value = ''; } 
            if (unlockButton) unlockButton.disabled = shouldBeDisabled; 
            if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            return;
        }
        
        if (postNum) {
            const postInfoSection = pageElement.querySelector('.post-info-section'); 
            const taskSection = pageElement.querySelector('.post-task-section'); 
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section'); 
            const minigolfFormSection = pageElement.querySelector('.minigolf-form-section'); 
            const pyramidPointsSection = pageElement.querySelector('.pyramid-points-section'); 
            const geoRunSetupSection = pageElement.querySelector('.geo-run-setup-section');
            const geoRunActiveSection = pageElement.querySelector('.geo-run-active-section');
            const geoRunResultsSection = pageElement.querySelector('.geo-run-results-section');

            const isPostUnlocked = currentTeamData?.unlockedPosts?.[`post${postNum}`]; 
            const isTaskCompleted = currentTeamData?.completedGlobalPosts?.[`post${postNum}`];
            const isMannedPost = (postNum === 1 || postNum === 8);
            const isTeacherVerified = isMannedPost && currentTeamData?.mannedPostTeacherVerified?.[`post${postNum}`];

            if(postInfoSection) postInfoSection.style.display = 'none';
            if(taskSection) taskSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(minigolfFormSection) minigolfFormSection.style.display = 'none';
            if(pyramidPointsSection) pyramidPointsSection.style.display = 'none';
            if(geoRunSetupSection) geoRunSetupSection.style.display = 'none';
            if(geoRunActiveSection) geoRunActiveSection.style.display = 'none';
            if(geoRunResultsSection) geoRunResultsSection.style.display = 'none';
            
            if (postNum === 1) { const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1'); if (minigolfProceedButton) minigolfProceedButton.style.display = 'none'; }
            if (postNum === GEO_RUN_POST_ID) { const geoRunProceedButton = document.getElementById(`geo-run-proceed-btn-post${GEO_RUN_POST_ID}`); if (geoRunProceedButton) geoRunProceedButton.style.display = 'none'; }
            
            const teacherPassInput = pageElement.querySelector('.teacher-password-input');
            if (teacherPassInput) { teacherPassInput.value = ''; teacherPassInput.disabled = false; }
            const teacherPassButton = pageElement.querySelector('.submit-teacher-password-btn');
            if (teacherPassButton) teacherPassButton.disabled = false;
            const teacherPassFeedback = pageElement.querySelector('.feedback-teacher-password');
            if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }

            if (isTaskCompleted) { 
                if (isMannedPost) { 
                     if (postNum === 1 && minigolfFormSection) { 
                        minigolfFormSection.style.display = 'block'; 
                        minigolfFormSection.querySelectorAll('input, button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true); 
                        const mgFeedback = document.getElementById('minigolf-results-feedback');
                        if(mgFeedback) { const savedGolfPoints = currentTeamData?.minigolfScores?.post1?.pointsAwarded; const savedGolfAverage = currentTeamData?.minigolfScores?.post1?.average; if (savedGolfPoints !== undefined && savedGolfAverage !== undefined) { mgFeedback.textContent = `Snitt: ${savedGolfAverage.toFixed(2)}. Poeng: ${savedGolfPoints}!`; } else { mgFeedback.textContent = "Minigolf fullført! Poeng registrert."; } mgFeedback.className = "feedback success"; }
                        const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1'); if (minigolfProceedButton) { minigolfProceedButton.style.display = 'inline-block'; minigolfProceedButton.disabled = false; }
                    } else if (postNum === 8 && pyramidPointsSection) { 
                        pyramidPointsSection.style.display = 'block';
                        pyramidPointsSection.querySelectorAll('input, button').forEach(el => el.disabled = true); 
                         const ppFeedback = document.getElementById('pyramid-results-feedback');
                        if(ppFeedback) { const savedPyramidPoints = currentTeamData?.pyramidPoints?.post8; if (savedPyramidPoints !== undefined) { ppFeedback.textContent = `Poeng registrert: ${savedPyramidPoints}!`; } else { ppFeedback.textContent = "Pyramidepoeng registrert!"; } ppFeedback.className = "feedback success"; }
                    }
                } else if (postNum === GEO_RUN_POST_ID && geoRunResultsSection) { 
                    geoRunResultsSection.style.display = 'block';
                    const timeDisplay = geoRunResultsSection.querySelector('.geo-run-total-time'); const pointsDisplay = geoRunResultsSection.querySelector('.geo-run-points-awarded');
                    const runState = currentTeamData.geoRunState[`post${postNum}`];
                    if(timeDisplay && runState?.totalTime !== null) timeDisplay.textContent = formatTimeFromMs(runState.totalTime);
                    if(pointsDisplay && runState?.pointsAwarded !== null) pointsDisplay.textContent = runState.pointsAwarded;
                    const geoRunProceedButton = document.getElementById(`geo-run-proceed-btn-post${GEO_RUN_POST_ID}`); if (geoRunProceedButton) { geoRunProceedButton.style.display = 'inline-block'; geoRunProceedButton.disabled = false; }
                }
                 else if (taskSection) { 
                    taskSection.style.display = 'block';
                    taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const taskFeedback = taskSection.querySelector('.feedback-task'); if(taskFeedback) {taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success';}
                }
            } else if (isPostUnlocked) { 
                if (isMannedPost) {
                    if (isTeacherVerified) { 
                        if (postNum === 1 && minigolfFormSection) {
                            minigolfFormSection.style.display = 'block';
                            for (let i = 1; i <= MAX_PLAYERS_PER_TEAM; i++) { const scoreInput = document.getElementById(`player-${i}-score-post1`); if (scoreInput) { scoreInput.value = ''; scoreInput.disabled = false;} }
                            const submitGolfBtn = document.getElementById('submit-minigolf-post1'); if(submitGolfBtn) submitGolfBtn.disabled = false;
                            const mgFeedback = document.getElementById('minigolf-results-feedback'); if(mgFeedback) { mgFeedback.textContent = ""; mgFeedback.className = "feedback";}
                            const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1'); if (minigolfProceedButton) minigolfProceedButton.style.display = 'none';
                        } else if (postNum === 8 && pyramidPointsSection) {
                            pyramidPointsSection.style.display = 'block';
                            const pointsInput = document.getElementById('pyramid-points-input-post8'); if(pointsInput) {pointsInput.value = ''; pointsInput.disabled = false;}
                            const submitPyramidBtn = document.getElementById('submit-pyramid-points-post8'); if(submitPyramidBtn) submitPyramidBtn.disabled = false;
                            const ppFeedback = document.getElementById('pyramid-results-feedback'); if(ppFeedback) { ppFeedback.textContent = ""; ppFeedback.className = "feedback";}
                        }
                    } else if (teacherPasswordSection) { teacherPasswordSection.style.display = 'block'; }
                } else if (postNum === GEO_RUN_POST_ID && currentTeamData && currentTeamData.geoRunState) { 
                    const runState = currentTeamData.geoRunState[`post${postNum}`];
                    if (runState.active) {
                        if(geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                         const lapDisplay = geoRunActiveSection.querySelector('.geo-run-current-lap'); const nextPointDisplay = geoRunActiveSection.querySelector('.geo-run-next-target');
                         if(lapDisplay) lapDisplay.textContent = runState.lap; if(nextPointDisplay) nextPointDisplay.textContent = (runState.lap % 2 !== 0) ? GEO_RUN_POINT2.name : GEO_RUN_POINT1.name;
                    } else if (geoRunSetupSection) { 
                        geoRunSetupSection.style.display = 'block';
                        const countdownDisplay = geoRunSetupSection.querySelector('.geo-run-countdown'); const prePipInfo = geoRunSetupSection.querySelector('.geo-run-pre-pip-info');
                        if (runState.preRunPipTimerId || (runState.preCountdownPipsDone > 0 && runState.preCountdownPipsDone < GEO_RUN_PRE_COUNTDOWN_PIPS)) { 
                            if(prePipInfo) prePipInfo.textContent = `Vent på signal... Pip ${runState.preCountdownPipsDone +1} av ${GEO_RUN_PRE_COUNTDOWN_PIPS} om ca. ${GEO_RUN_PRE_COUNTDOWN_INTERVAL_SECONDS} sek.`;
                            if(countdownDisplay) countdownDisplay.style.display = 'none'; 
                        } else if (runState.countdownTimerId == null && runState.preCountdownPipsDone >= GEO_RUN_PRE_COUNTDOWN_PIPS) { 
                             if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) { countdownDisplay.textContent = GEO_RUN_COUNTDOWN_SECONDS; countdownDisplay.style.display = 'inline';}
                        } else if (runState.countdownTimerId != null) { if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) countdownDisplay.style.display = 'inline';
                        } else { if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) {countdownDisplay.textContent = GEO_RUN_COUNTDOWN_SECONDS; countdownDisplay.style.display = 'inline';} }
                    } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
                }
                 else if (taskSection) { 
                    taskSection.style.display = 'block';
                    const taskInput = taskSection.querySelector('.post-task-input'); const taskButton = taskSection.querySelector('.check-task-btn'); const taskFeedback = taskSection.querySelector('.feedback-task'); const attemptCounterElement = taskSection.querySelector('.attempt-counter');
                    if(taskInput) {taskInput.value = ''; taskInput.disabled = false;} if(taskButton) taskButton.disabled = false; if(taskFeedback) {taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task';}
                    if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) { const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`]; attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`; } 
                    else if (attemptCounterElement) { attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`; }
                }
            } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
        }
    }

    function resetAllPostUIs() { 
        if(postContentContainer) postContentContainer.innerHTML = '';
        const introTeamCodeInput = document.getElementById('team-code-input-dynamic'); // Disse er i intro.html
        const introStartButton = document.getElementById('start-with-team-code-button-dynamic');
        const introFeedback = document.getElementById('team-code-feedback-dynamic');
        if(introTeamCodeInput) { introTeamCodeInput.value = ''; introTeamCodeInput.disabled = false; }
        if(introStartButton) introStartButton.disabled = false;
        if(introFeedback) { introFeedback.textContent = ''; introFeedback.className = 'feedback';}
    }
    
    function initializeTeam(teamCode) {
        const dynamicStartButton = document.getElementById('start-with-team-code-button-dynamic');
        const dynamicTeamCodeInput = document.getElementById('team-code-input-dynamic');
        const dynamicTeamCodeFeedback = document.getElementById('team-code-feedback-dynamic');

        if (dynamicStartButton) dynamicStartButton.disabled = true;
        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];

        if (config) {
            currentTeamData = {
                ...config, id: teamKey, currentPostArrayIndex: 0, completedPostsCount: 0,
                completedGlobalPosts: {}, unlockedPosts: {}, score: 0, taskAttempts: {},
                startTime: Date.now(), endTime: null, totalTimeSeconds: null,
                taskCompletionTimes: {}, 
                canEnterFinishCode: false,
                mannedPostTeacherVerified: { post1: false, post8: false }, 
                minigolfScores: { post1: {} }, 
                pyramidPoints: {},
                arrivalSoundPlayed: {}, 
                geoRunState: {} 
            };
            POST_LOCATIONS.forEach((_,i) => currentTeamData.arrivalSoundPlayed[`post${i+1}`] = false);
            currentTeamData.arrivalSoundPlayed.finish = false;
            currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] = { 
                active: false, lap: 0, startTime: null, lapStartTime: null, 
                atPoint1: false, atPoint2: false, countdownTimerId: null, 
                finished: false, totalTime: null, pointsAwarded: null,
                preCountdownPipsDone: 0, preRunPipTimerId: null 
            };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            
            saveState(); 
            if (dynamicTeamCodeInput) dynamicTeamCodeInput.disabled = true; 
            if (dynamicStartButton) dynamicStartButton.disabled = true;


            clearFinishMarker(); updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}`); 
            
            if (map) updateMapMarker(firstPostInSequence, false);
            startContinuousUserPositionUpdate(); 
        } else {
            if (dynamicStartButton) dynamicStartButton.disabled = false;
            if(dynamicTeamCodeFeedback) { dynamicTeamCodeFeedback.textContent = 'Ugyldig lagkode! (Eks: LAG1)'; dynamicTeamCodeFeedback.classList.add('error', 'shake'); }
            if (dynamicTeamCodeInput) { dynamicTeamCodeInput.classList.add('shake'); setTimeout(() => { if(dynamicTeamCodeFeedback) dynamicTeamCodeFeedback.classList.remove('shake'); if(dynamicTeamCodeInput) dynamicTeamCodeInput.classList.remove('shake'); }, 400); dynamicTeamCodeInput.focus(); dynamicTeamCodeInput.select(); }
        }
    }

    function handleTeacherPassword(postNum, password) { /* ... (som i v33) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (som i v33) ... */ }
    function handlePyramidPointsSubmit(postNum, points) { /* ... (som i v33) ... */ }
    function startGeoRunPreCountdownPips() { /* ... (som i v33) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId) { /* ... (som i v33) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (som i v33) ... */ }
    function proceedToNextPostOrFinish() { /* ... (som i v33) ... */ }
    function updateUIAfterLoad() { /* ... (som i v33) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (som i v33) ... */ }

    // === EVENT LISTENERS ===
    // Delegerte listeners for dynamisk innhold
    if (postContentContainer) {
        postContentContainer.addEventListener('click', (event) => {
            const target = event.target;
            logToMobile(`Klikk registrert inne i postContentContainer. Target ID: ${target.id}, Target Class: ${target.className}`, "debug");

            if (target.id === 'start-with-team-code-button-dynamic' && !target.disabled) {
                const dynamicTeamCodeInput = postContentContainer.querySelector('#team-code-input-dynamic');
                if (dynamicTeamCodeInput) initializeTeam(dynamicTeamCodeInput.value);
            } else if (target.classList.contains('check-task-btn') && !target.disabled) { 
                const postNum = parseInt(target.getAttribute('data-post'));
                if (postNum !== 1 && postNum !== 8 && postNum !== GEO_RUN_POST_ID) { 
                    const taskInput = postContentContainer.querySelector(`#post-${postNum}-task-input`); 
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase()); 
                }
            } else if (target.classList.contains('submit-teacher-password-btn') && !target.disabled) { 
                const postNum = parseInt(target.getAttribute('data-post'));
                const passInput = postContentContainer.querySelector(`#teacher-password-input-post${postNum}`);
                if(passInput) handleTeacherPassword(postNum, passInput.value.trim()); 
            } else if (target.id === 'submit-minigolf-post1' && !target.disabled) { handleMinigolfSubmit(1); }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { logToMobile("Minigolf proceed button clicked.", "debug"); proceedToNextPostOrFinish(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) { const pointsInput = postContentContainer.querySelector('#pyramid-points-input-post8'); if(pointsInput) handlePyramidPointsSubmit(8, pointsInput.value.trim()); }
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { logToMobile("Geo-run proceed button clicked.", "debug"); proceedToNextPostOrFinish(); }
            else if (target.id === 'finish-unlock-btn' && !target.disabled) { 
                const finishCodeInput = postContentContainer.querySelector('#finish-unlock-input');
                if (finishCodeInput && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(finishCodeInput.value.trim().toUpperCase()); }
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
                    if (dynamicStartButton && !dynamicStartButton.disabled) dynamicStartButton.click();
                } else if (target.classList.contains('post-task-input') && !target.disabled) { 
                    const postPageDiv = target.closest('div[id^="post-"]'); // Finner div som starter med "post-"
                    if (postPageDiv) { 
                        const postNum = parseInt(postPageDiv.id.split('-')[1]);
                        if (postNum !== 1 && postNum !== 8 && postNum !== GEO_RUN_POST_ID) { 
                            event.preventDefault(); const taskButton = postPageDiv.querySelector(`.check-task-btn[data-post="${postNum}"]`); 
                            if (taskButton && !taskButton.disabled) taskButton.click(); 
                        }
                    }
                } else if (target.classList.contains('teacher-password-input') && !target.disabled) { 
                     const postPageDiv = target.closest('div[id^="post-"]');
                     if(postPageDiv) { 
                         event.preventDefault(); const postNum = parseInt(postPageDiv.id.split('-')[1]); 
                         const passButton = postPageDiv.querySelector('.submit-teacher-password-btn'); 
                         if(passButton && !passButton.disabled) passButton.click(); 
                    }
                } else if (target.id === 'finish-unlock-input' && !target.disabled) { 
                    event.preventDefault(); 
                    const associatedButton = postContentContainer.querySelector('#finish-unlock-btn'); 
                    if (associatedButton && !associatedButton.disabled && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(target.value.trim().toUpperCase()); }
                }
            }
        });
    }
    
    // Listeners for elementer i hoved-HTML (tabs, globale dev-reset, mobil-logg knapper)
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || currentTeamData.completedPostsCount >= TOTAL_POSTS) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; targetLocation = POST_LOCATIONS[currentPostGlobalId - 1]; } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
    
    // Håndter globale dev-reset knapper (hvis noen finnes utenfor postContentContainer)
    devResetButtons.forEach(button => { 
        if (!button.closest('#post-content-container')) { 
            button.addEventListener('click', () => { 
                if (confirm("Nullstille rebusen (global)?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); } 
            });
        }
    });
    
    document.addEventListener('postReached', function(event) { if (event.detail && event.detail.pageId) { logToMobile(`Custom event 'postReached' for pageId: ${event.detail.pageId}. Calling resetPageUI.`, "debug"); resetPageUI(event.detail.pageId); } });
    document.addEventListener('geoRunLogicTrigger', function(event) { if (event.detail) { logToMobile(`Custom event 'geoRunLogicTrigger' for target: ${event.detail.targetPointId}`, "debug"); handleGeoRunLogic(event.detail.isAtTargetPoint, event.detail.targetPointId); }});
    document.addEventListener('startGeoRunPrePipsTrigger', function() { logToMobile("Custom event 'startGeoRunPrePipsTrigger' mottatt.", "debug"); startGeoRunPreCountdownPips(); });
    
    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { toggleLogBtn.addEventListener('click', () => { mobileLogContainer.style.display = mobileLogContainer.style.display === 'none' ? 'block' : 'none'; }); }
    if (clearLogBtn && mobileLogContainer) { clearLogBtn.addEventListener('click', () => { mobileLogContainer.innerHTML = ''; }); }

    // === INITALISERING VED LASTING AV SIDE ===
    if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }
    if (loadState()) {
        logToMobile("Tilstand lastet fra localStorage.", "info");
        showTabContent('rebus');
        if (currentTeamData.endTime) { showRebusPage('finale'); if (map) updateMapMarker(null, true); }
        else if (currentTeamData.completedPostsCount >= TOTAL_POSTS) { showRebusPage('finale'); if (map) updateMapMarker(null, true); if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); }
        else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            showRebusPage(`post-${currentExpectedPostId}`); 
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); 
        } else { logToMobile("Uventet tilstand ved lasting, nullstiller.", "warn"); clearState(); showRebusPage('intro'); }
        updateUIAfterLoad();
    } else { logToMobile("Ingen lagret tilstand funnet, viser introduksjonsside.", "info"); showTabContent('rebus'); showRebusPage('intro'); resetAllPostUIs(); }
    logToMobile("Initial page setup complete.", "info");
});
/* Version: #36 */
