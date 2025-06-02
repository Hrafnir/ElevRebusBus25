/* Version: #89 */
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
let targetLocationDetailsForLogging = null; // For å logge forrige mål

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
        const postData = this.getPostData(postId);

        if (!currentTeamData || !postData) {
            logToMobile(`Kan ikke markere post ${postId} som fullført: mangler team data eller post data.`, "warn");
            return;
        }

        if (!currentTeamData.completedGlobalPosts[`post${postId}`]) {
            currentTeamData.completedGlobalPosts[`post${postId}`] = true;
            currentTeamData.completedPostsCount++;
            currentTeamData.taskCompletionTimes[`post${postId}`] = Date.now();
            currentTeamData.score += pointsAwarded;
            currentTeamData.pointsPerPost[`post${postId}`] = pointsAwarded;

            if (postData.type === 'georun' && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${postId}`]) {
                currentTeamData.geoRunState[`post${postId}`].pointsAwarded = pointsAwarded;
                currentTeamData.geoRunState[`post${postId}`].finished = true; 
                currentTeamData.geoRunState[`post${postId}`].active = false;
            }

            logToMobile(`Post ${postId} markert som fullført. Poeng totalt: ${currentTeamData.score}, Poeng for post: ${pointsAwarded}, Fullførte: ${currentTeamData.completedPostsCount}`, "info");
            saveState();
            document.dispatchEvent(new CustomEvent('scoreUpdated'));

            const requiresManualProceed = ['manned_minigolf', 'manned_pyramid', 'georun'];
            if (!requiresManualProceed.includes(postData.type)) {
                logToMobile(`Post ${postId} (type: ${postData.type}) går automatisk videre.`, "debug");
                document.dispatchEvent(new CustomEvent('requestProceedToNext'));
            } else {
                logToMobile(`Post ${postId} (type: ${postData.type}) krever manuell 'Gå Videre'. Viser resultat/ferdig-UI. (SVAR_ID: #89_DEBUG_A)`, "debug");
                const currentPageId = `post-${postId}`;
                const pageElement = document.getElementById(`${currentPageId}-content-wrapper`);
                if (pageElement) {
                    logToMobile(`Sideelement ${pageElement.id} FUNNET for post ${postId}. Kaller resetPageUI. (SVAR_ID: #89_DEBUG_B)`, "debug");
                    resetPageUI(currentPageId, pageElement); 
                } else {
                    logToMobile(`Sideelement for post ${postId} (${currentPageId}-content-wrapper) IKKE funnet for umiddelbar UI-oppdatering etter markPostAsCompleted. (SVAR_ID: #89_DEBUG_C)`, "warn");
                }
            }

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
const GEO_RUN_START_RADIUS = 20;
const GEO_RUN_WAYPOINT_RADIUS = 5;
const DEV_MODE_NO_GEOFENCE = true; // Bekreftet satt til true
const FINISH_UNLOCK_CODE = "FASTLAND24";
const GEO_RUN_POST_ID = 7;

const MAP_STYLES_NO_LABELS = [
    { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
    { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
    { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
];

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
function playGeoRunTurnSound() { logToMobile("AUDIO: Spiller Geo-løp vendelyd (høyt pip)...", "debug"); playSound(longPipAudio); }
function playSoundPromise(audioObject) { return new Promise((resolve, reject) => { if (audioObject && typeof audioObject.play === 'function') { audioObject.currentTime = 0; const playPromise = audioObject.play(); if (playPromise !== undefined) { playPromise.then(() => { audioObject.onended = resolve; }).catch(error => { logToMobile(`Avspillingsfeil (Promise): ${error.message} (${audioObject.src})`, "warn"); reject(error); }); } else { audioObject.onended = resolve; audioObject.onerror = reject; } } else { logToMobile("Fallback: Lydobjekt ikke gyldig for promise-avspilling.", "warn"); resolve(); } }); }
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { mapElement = document.getElementById('dynamic-map-container'); if (!mapElement) { setTimeout(window.initMap, 500); return; } geofenceFeedbackElement = document.getElementById('geofence-feedback'); map = new google.maps.Map(mapElement, { center: START_LOCATION, zoom: 15, mapTypeId: google.maps.MapTypeId.HYBRID, styles: MAP_STYLES_NO_LABELS, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true, mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID] } }); if (currentTeamData) { if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && !currentTeamData.endTime) { updateMapMarker(null, true); } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; updateMapMarker(currentPostGlobalId, false); } else { updateMapMarker(null, true); } startContinuousUserPositionUpdate(); } logToMobile("Skolerebus Kart initialisert.", "info"); }

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
function updateUserPositionOnMap(position) {
    if (!map && (!window.geoRunMiniMapInstance && typeof window.geoRunMiniMapInstance !== 'object')) return;

    const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };

    if (map) {
        if (userPositionMarker) {
            userPositionMarker.setPosition(userPos);
        } else {
            userPositionMarker = new google.maps.Marker({
                position: userPos, map: map, title: "Din Posisjon",
                icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" }
            });
        }
    }

    const currentPostData = currentTeamData ? CoreApp.getPostData(currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]) : null;
    if (currentPostData && currentPostData.type === 'georun' && typeof currentPostData.updateMiniMapDisplay === 'function') {
        if (window.geoRunMiniMapInstance && typeof window.geoRunMiniMapInstance.panTo === 'function') {
            currentPostData.updateMiniMapDisplay(userPos, currentTeamData);
        }
    }
}

function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false, geofenceRadiusOverride = GEOFENCE_RADIUS) {
    if (!geofenceFeedbackElement) return;
    if (isFullyCompleted || (!currentTeamData)) {
        geofenceFeedbackElement.style.display = 'none';
        return;
    }
    geofenceFeedbackElement.style.display = 'block';
    geofenceFeedbackElement.classList.remove('permanent');

    if (DEV_MODE_NO_GEOFENCE) {
        geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`;
        geofenceFeedbackElement.className = 'geofence-info dev-mode';
        return;
    }

    if (distance === null) {
        geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`;
        geofenceFeedbackElement.className = 'geofence-info';
        return;
    }

    const distanceFormatted = Math.round(distance);
    if (isEffectivelyWithinRange) {
        if (canInteractWithTarget) {
            let message = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). `;
            if (targetName.toLowerCase().includes("mål")) {
                message += "Tast inn målkoden!";
            } else if (targetName.toLowerCase().includes("start geo-løp")) {
                 message += "Trykk 'Start Geo-Løp'!";
            } else {
                message += "Lærer må taste passord eller oppgaven vises.";
            }
            geofenceFeedbackElement.textContent = message;
        } else {
            geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`;
        }
        geofenceFeedbackElement.className = 'geofence-success';
    } else {
        geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${geofenceRadiusOverride}m)`;
        geofenceFeedbackElement.className = 'geofence-error';
    }
}


function handlePositionUpdate(position) {
    // NY LOGGLINJE HER:
    logToMobile(`handlePositionUpdate KALT. Nåværende post i teamData: ${currentTeamData ? currentTeamData.postSequence[currentTeamData.currentPostArrayIndex] : 'Ingen teamdata/post'}, Mål-ID forrige sjekk: ${targetLocationDetailsForLogging ? targetLocationDetailsForLogging.globalId : 'Ingen forrige mål'} (SVAR_ID: #89_DEBUG_HPU_ENTRY)`, "debug");

    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) {
        updateGeofenceFeedback(null, false, true, null, false); return;
    }

    let targetLocationDetails = null; // Endret fra global til lokal
    let isCurrentTargetTheFinishLine = false;
    let isGeoRunActiveForCurrentPost = false;
    let currentGeofenceRadius = GEOFENCE_RADIUS;

    const currentGlobalIdOriginal = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
    const currentPostDataFromCore = CoreApp.getPostData(currentGlobalIdOriginal);

    if (currentPostDataFromCore && currentPostDataFromCore.type === 'georun' &&
        currentTeamData.geoRunState && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]) {

        const runState = currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`];
        const allGeoRunPoints = currentPostDataFromCore.geoRunPoints;
        const runTargetIndices = currentPostDataFromCore.runTargetIndices;

        if (!allGeoRunPoints || allGeoRunPoints.length === 0 || !runTargetIndices || runTargetIndices.length === 0) {
            logToMobile(`FEIL: geoRunPoints eller runTargetIndices mangler/er tomme for Post ${currentGlobalIdOriginal}.`, "error");
        } else {
            isGeoRunActiveForCurrentPost = true;
            if (runState.awaitingGeoRunStartConfirmation) {
                targetLocationDetails = { location: allGeoRunPoints[0], pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunButtonEnable`, name: "Start Geo-Løp (" + allGeoRunPoints[0].name + ")" };
                currentGeofenceRadius = GEO_RUN_START_RADIUS;
            } else if (runState.active && !runState.finished) {
                const currentTargetIndexInSequence = runState.lap - 1;
                if (currentTargetIndexInSequence < runTargetIndices.length) {
                    const targetPointActualIndex = runTargetIndices[currentTargetIndexInSequence];
                    const targetPoint = allGeoRunPoints[targetPointActualIndex];
                    targetLocationDetails = { location: targetPoint, pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunTarget${targetPointActualIndex}`, name: targetPoint.name };
                    currentGeofenceRadius = GEO_RUN_WAYPOINT_RADIUS;
                } else {
                    isGeoRunActiveForCurrentPost = false;
                }
            } else if (!runState.active && !runState.finished && !runState.awaitingGeoRunStartConfirmation) {
                 targetLocationDetails = { location: allGeoRunPoints[0], pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunInitialArrival`, name: allGeoRunPoints[0].name };
                 currentGeofenceRadius = GEOFENCE_RADIUS;
            } else {
                isGeoRunActiveForCurrentPost = false;
            }
        }
    }

    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.finished && !currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.awaitingGeoRunStartConfirmation)) {
        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name };
            isCurrentTargetTheFinishLine = true;
            currentGeofenceRadius = GEOFENCE_RADIUS;
        } else if (Object.keys(CoreApp.registeredPostsData).length > 0) {
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            const postDataForNav = CoreApp.getPostData(currentGlobalId);
            if (postDataForNav && typeof postDataForNav.lat !== 'undefined' && typeof postDataForNav.lng !== 'undefined') {
                targetLocationDetails = { location: {lat: postDataForNav.lat, lng: postDataForNav.lng}, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postDataForNav.name || `Post ${currentGlobalId}` };
                currentGeofenceRadius = GEOFENCE_RADIUS;
            } else { logToMobile(`handlePositionUpdate: Kunne ikke finne data eller koordinater for post ${currentGlobalId}.`, "warn"); }
        } else { logToMobile("handlePositionUpdate: Ingen registrerte poster, kan ikke bestemme mål.", "warn"); }
    }
    
    targetLocationDetailsForLogging = targetLocationDetails; // Oppdater for neste logg-kall

    if (!targetLocationDetails) {
        updateGeofenceFeedback(null, false, false, null, false, GEOFENCE_RADIUS); return;
    }

    const userLat = position.coords.latitude; const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= currentGeofenceRadius;
    const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange;
    let canCurrentlyInteract = false;

    if (isCurrentTargetTheFinishLine) {
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange;
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');
        if(finishUnlockInput) finishUnlockInput.disabled = !isEffectivelyWithinRange;
        if(finishUnlockButton) finishUnlockButton.disabled = !isEffectivelyWithinRange;
        if (isEffectivelyWithinRange && !currentTeamData.arrivalSoundPlayed.finish) { playArrivalSound(); currentTeamData.arrivalSoundPlayed.finish = true; saveState(); }
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else if (isGeoRunActiveForCurrentPost && currentPostDataFromCore && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]) {
        const runState = currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`];
        if (runState.awaitingGeoRunStartConfirmation && targetLocationDetails.globalId === 'geoRunButtonEnable') {
            const startButton = document.getElementById(`start-georun-btn-post${currentGlobalIdOriginal}`);
            if (startButton) {
                const prevDisabledState = startButton.disabled;
                startButton.disabled = !isEffectivelyWithinRange;
                if (prevDisabledState && !startButton.disabled) {
                    logToMobile(`GeoRun Startknapp for post ${currentGlobalIdOriginal} er nå AKTIVERT. (Effektivt innenfor: ${isEffectivelyWithinRange})`, "info");
                }
            }
            canCurrentlyInteract = isEffectivelyWithinRange;
        } else if (runState.active && !runState.finished) {
            document.dispatchEvent(new CustomEvent('geoRunLogicTrigger', { detail: { isAtTargetPoint: isEffectivelyWithinRange, targetPointId: targetLocationDetails.globalId, postId: currentGlobalIdOriginal } }));
        } else if (!runState.active && !runState.finished && !runState.awaitingGeoRunStartConfirmation && targetLocationDetails.globalId === 'geoRunInitialArrival' && isEffectivelyWithinRange) {
            if (!currentTeamData.unlockedPosts[`post${currentGlobalIdOriginal}`]) {
                 logToMobile(`Post ${currentGlobalIdOriginal} (GeoRun Hoved) nådd. Låser opp. Viser instruksjoner for start.`, "info");
                 currentTeamData.unlockedPosts[`post${currentGlobalIdOriginal}`] = true;
                 runState.awaitingGeoRunStartConfirmation = true;
                 if (!currentTeamData.arrivalSoundPlayed[`post${currentGlobalIdOriginal}`]) {
                    playArrivalSound();
                    currentTeamData.arrivalSoundPlayed[`post${currentGlobalIdOriginal}`] = true;
                 }
                 saveState();
                 document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
                 canCurrentlyInteract = true;
            }
        }
    } else {
        const postGlobalId = targetLocationDetails.globalId;
        const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];
        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            logToMobile(`Post ${postGlobalId} nådd. Låser opp.`, "info");
            currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            if (!currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`]) {
                playArrivalSound();
                currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`] = true;
            }
            saveState();
            document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
            canCurrentlyInteract = true;
        } else if (isPostAlreadyUnlocked) {
            const thisPostData = CoreApp.getPostData(postGlobalId);
            if (thisPostData && (thisPostData.type === 'manned_minigolf' || thisPostData.type === 'manned_pyramid')) {
                 canCurrentlyInteract = !currentTeamData.mannedPostTeacherVerified[`post${postGlobalId}`];
            } else { canCurrentlyInteract = false; }
        }
    }

    updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract, currentGeofenceRadius);
}

function startContinuousUserPositionUpdate() {
    if (!navigator.geolocation) {
        logToMobile("Geolocation ikke støttet.", "warn");
        return;
    }
    if (mapPositionWatchId !== null || devModePositionUpdateIntervalId !== null) {
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

// === resetPageUI FLYTTET TIL GLOBALT SKOP ===
function resetPageUI(pageIdentifier, pageElementContext = null) {
    logToMobile(`resetPageUI KALT for pageIdentifier: '${pageIdentifier}'. pageElementContext ID: ${pageElementContext ? pageElementContext.id : 'NULL'}. (SVAR_ID: #89_DEBUG_D)`, "debug");
    const context = pageElementContext || postContentContainer; 
    if (!context || typeof context.querySelector !== 'function') {
        logToMobile(`resetPageUI: Ugyldig kontekst (${typeof context}) for ${pageIdentifier}. Kan ikke fortsette.`, "error");
        return;
    }

    let postNum = null;
    if (pageIdentifier && pageIdentifier.startsWith('post-')) {
        postNum = parseInt(pageIdentifier.split('-')[1]);
    }

    const postData = postNum ? CoreApp.getPostData(postNum) : null; 
    const isUnlocked = postData && currentTeamData && currentTeamData.unlockedPosts && currentTeamData.unlockedPosts[`post${postNum}`];
    const isCompleted = postData && currentTeamData && currentTeamData.completedGlobalPosts && currentTeamData.completedGlobalPosts[`post${postNum}`];
    const isTeacherVerified = postData && currentTeamData && currentTeamData.mannedPostTeacherVerified && currentTeamData.mannedPostTeacherVerified[`post${postNum}`];

    const postInfoSection = context.querySelector('.post-info-section');
    const taskSection = context.querySelector('.post-task-section');
    const teacherPasswordSection = context.querySelector('.teacher-password-section');
    const minigolfFormSection = context.querySelector('.minigolf-form-section');
    const pyramidPointsSection = context.querySelector('.pyramid-points-section');
    const geoRunStartButtonSection = context.querySelector('.geo-run-start-button-section');
    const geoRunActiveSection = context.querySelector('.geo-run-active-section');
    const geoRunResultsSection = context.querySelector('.geo-run-results-section');


    [postInfoSection, taskSection, teacherPasswordSection, minigolfFormSection, pyramidPointsSection, geoRunStartButtonSection, geoRunActiveSection, geoRunResultsSection]
        .forEach(section => { if (section) section.style.display = 'none'; });

    if (postData) {
        if (isCompleted) {
            if ((postData.type === 'standard' || postData.type === 'standard_hint') && taskSection) {
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
            if ((postData.type === 'standard' || postData.type === 'standard_hint') && taskSection) {
                taskSection.style.display = 'block';
                const inputEl = taskSection.querySelector('.post-task-input');
                if (inputEl) { inputEl.value = ''; inputEl.disabled = false; }
                const btnEl = taskSection.querySelector('.check-task-btn');
                if (btnEl) btnEl.disabled = false;
                const feedbackEl = taskSection.querySelector('.feedback-task');
                if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'feedback feedback-task'; }
                const attemptsEl = taskSection.querySelector('.attempt-counter');
                const maxAttemptsForPost = postData.maxAttempts || 5;
                const attemptsMade = (currentTeamData.taskAttempts && currentTeamData.taskAttempts[`post${postNum}`]) || 0;
                if (attemptsEl) {
                    attemptsEl.textContent = `Forsøk: ${attemptsMade} / ${maxAttemptsForPost}`;
                }
            } else if (postData.type === 'manned_minigolf') {
                if (isTeacherVerified && minigolfFormSection) minigolfFormSection.style.display = 'block';
                else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
            } else if (postData.type === 'manned_pyramid') {
                if (isTeacherVerified && pyramidPointsSection) pyramidPointsSection.style.display = 'block';
                else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
            } else if (postData.type === 'georun') { 
                if (postInfoSection) postInfoSection.style.display = 'block'; 
            }
        } else if (postInfoSection) { 
            postInfoSection.style.display = 'block';
        }

        if (typeof postData.initUI === 'function') {
            logToMobile(`resetPageUI for ${pageIdentifier}: Kaller postData.initUI. (SVAR_ID: #89_DEBUG_INIT_CALL)`, "debug");
            postData.initUI(context, currentTeamData);
        }

    } else if (pageIdentifier === 'intro') {
        const teamCodeInput = context.querySelector('#team-code-input-dynamic');
        if (teamCodeInput) teamCodeInput.value = '';
        const teamPasswordInput = context.querySelector('#team-password-input-dynamic');
        if (teamPasswordInput) teamPasswordInput.value = '';
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

// === DEV FUNKSJON FOR Å TESTE MÅLGANG ===
function dev_simulateAllPostsCompleted() {
    if (!currentTeamData) {
        logToMobile("dev_simulateAllPostsCompleted: Ingen aktivt lag. Start et lag først.", "warn");
        return;
    }
    if (Object.keys(CoreApp.registeredPostsData).length === 0) {
        logToMobile("dev_simulateAllPostsCompleted: Ingen poster registrert.", "warn");
        return;
    }

    logToMobile("dev_simulateAllPostsCompleted: Simulerer at alle poster er fullført...", "info");
    
    let pseudoTime = Date.now() - (currentTeamData.postSequence.length * 60000); 
    currentTeamData.postSequence.forEach((postId, index) => {
        if (!currentTeamData.completedGlobalPosts[`post${postId}`]) {
            currentTeamData.completedGlobalPosts[`post${postId}`] = true;
            currentTeamData.pointsPerPost[`post${postId}`] = 0; 
            pseudoTime += (Math.random() * 5000 + 30000); 
            currentTeamData.taskCompletionTimes[`post${postId}`] = pseudoTime;
        }
    });
    
    currentTeamData.completedPostsCount = currentTeamData.postSequence.length;
    currentTeamData.canEnterFinishCode = true; 
    
    logToMobile(`Alle ${currentTeamData.completedPostsCount} poster er nå markert som fullført for ${currentTeamData.teamName}.`, "info");
    saveState();
    
    showRebusPage('finale');        
    updateMapMarker(null, true);    
    updateScoreDisplay();           

    stopContinuousUserPositionUpdate(); 
    if (geofenceFeedbackElement) {      
        geofenceFeedbackElement.style.display = 'none';
    }
    logToMobile("dev_simulateAllPostsCompleted: Ferdig. Du skal nå være på finalesiden.", "info");
}


document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output');
    logToMobile(`DOMContentLoaded event fired. (SVAR_ID: #89_core_init)`, "info"); 
    initializeSounds();

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    postContentContainer = document.getElementById('post-content-container'); 

    if (!postContentContainer) logToMobile("CRITICAL - postContentContainer is NULL! Dynamisk innhold vil ikke lastes.", "error");

    const TEAM_CONFIG = {
        "LAG1": { name: "Lag 1", postSequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], password: "SOL" },
        "LAG2": { name: "Lag 2", postSequence: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1], password: "MANE" },
        "LAG3": { name: "Lag 3", postSequence: [3, 4, 2, 5, 6, 7, 8, 9, 10, 1], password: "STJERNE" },
        "LAG4": { name: "Lag 4", postSequence: [4, 3, 2, 5, 6, 7, 8, 9, 10, 1], password: "HIMMEL" },
        "LAG5": { name: "Lag 5", postSequence: [5, 6, 7, 8, 9, 10, 1, 2, 3, 4], password: "JORD" },
        "LAG6": { name: "Lag 6", postSequence: [6, 7, 8, 9, 10, 1, 2, 3, 4, 5], password: "VANN" },
        "LAG7": { name: "Lag 7", postSequence: [7, 8, 9, 10, 1, 2, 3, 4, 5, 6], password: "ILD" },
        "LAG8": { name: "Lag 8", postSequence: [8, 9, 10, 1, 2, 3, 4, 5, 6, 7], password: "FJELL" },
        "LAG9": { name: "Lag 9", postSequence: [9, 10, 1, 2, 3, 4, 5, 6, 7, 8], password: "SKOG" },
        "LAG10": { name: "Lag 10", postSequence: [10, 1, 2, 3, 4, 5, 6, 7, 8, 9], password: "HAV" }
    };

    // === KJERNEFUNKSJONER (DOM-avhengige, men definert globalt via hoisting eller plassering) ===
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
                 postInfoElement.textContent = `Du nærmer deg ${postName}. Se post-spesifikke instruksjoner nedenfor og på kartet.`;
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
        }
         else if (postData.type === 'standard' || postData.type === 'standard_hint') {
            if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
            if (taskQuestionElement && postData.question) {
                taskQuestionElement.textContent = postData.question;
            }
        }
    }

    function displayFinalResults() {
        logToMobile(`displayFinalResults kalt. (SVAR_ID: #89_core_displayFinalResults)`, "info"); 
        const finalScoreSpan = document.getElementById('final-score');
        const totalTimeSpan = document.getElementById('total-time');
        const stageTimesList = document.getElementById('stage-times-list');

        if (finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
        if (totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
            totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
        }

        if (stageTimesList && currentTeamData.taskCompletionTimes && currentTeamData.pointsPerPost) {
            stageTimesList.innerHTML = '';
            for (let i = 0; i < currentTeamData.postSequence.length; i++) {
                const postGlobalId = currentTeamData.postSequence[i];
                const postData = CoreApp.getPostData(postGlobalId);
                if (!postData) continue;

                const postName = postData.name || `Post ${postGlobalId}`;
                const pointsForThisPost = currentTeamData.pointsPerPost[`post${postGlobalId}`];
                const pointsText = (pointsForThisPost !== undefined) ? `${pointsForThisPost} poeng` : "0 poeng";

                let stageTimeText = "Tid ikke fullført";
                if (currentTeamData.taskCompletionTimes['post' + postGlobalId]) {
                    let startTimeForStage = (i === 0) ? currentTeamData.startTime : currentTeamData.taskCompletionTimes[`post${currentTeamData.postSequence[i-1]}`];
                    if (startTimeForStage) {
                        const stageTimeMs = currentTeamData.taskCompletionTimes['post' + postGlobalId] - startTimeForStage;
                        stageTimeText = `Tid: ${formatTimeFromMs(stageTimeMs)}`;
                    } else if (i === 0) {
                        const stageTimeMs = currentTeamData.taskCompletionTimes['post' + postGlobalId] - currentTeamData.startTime;
                        stageTimeText = `Tid: ${formatTimeFromMs(stageTimeMs)}`;
                    }
                }

                const li = document.createElement('li');
                const fromPoint = (i === 0) ? "Start" : (CoreApp.getPostData(currentTeamData.postSequence[i-1]) ? CoreApp.getPostData(currentTeamData.postSequence[i-1]).name : "Forrige");
                li.textContent = `${fromPoint} til ${postName}: ${pointsText}, ${stageTimeText}`;
                stageTimesList.appendChild(li);

                if (!currentTeamData.taskCompletionTimes['post' + postGlobalId] && !currentTeamData.endTime) {
                    break;
                }
            }

            if (currentTeamData.endTime && currentTeamData.completedPostsCount === Object.keys(CoreApp.registeredPostsData).length) {
                const lastCompletedPostInSequence = currentTeamData.postSequence[Object.keys(CoreApp.registeredPostsData).length -1];
                const lastPostData = CoreApp.getPostData(lastCompletedPostInSequence);
                if (lastPostData && currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence]) {
                    const timeToFinish = currentTeamData.endTime - currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence];
                    const li = document.createElement('li');
                    li.textContent = `${lastPostData.name} til Mål: Tid: ${formatTimeFromMs(timeToFinish)}`;
                    stageTimesList.appendChild(li);
                }
            }
        }
    }

    async function showRebusPage(pageIdentifier) {
        logToMobile(`--- showRebusPage CALLED with pageIdentifier: '${pageIdentifier}' ---`, "info");
        if (!postContentContainer) { logToMobile("CRITICAL - postContentContainer is NULL in showRebusPage! Kan ikke laste innhold.", "error"); return; }

        const currentPostArrayIndex = currentTeamData ? currentTeamData.currentPostArrayIndex : -1;
        let previousPostGlobalIdIfNavigating = null;
        if (currentTeamData && currentTeamData.postSequence && currentTeamData.postSequence[currentPostArrayIndex] !== undefined) {
            const currentActualPostIdOnPage = `post-${currentTeamData.postSequence[currentPostArrayIndex]}`;
            if (pageIdentifier !== currentActualPostIdOnPage || pageIdentifier === 'intro' || pageIdentifier === 'finale') {
                 previousPostGlobalIdIfNavigating = currentTeamData.postSequence[currentPostArrayIndex];
            }
        }

        if (previousPostGlobalIdIfNavigating === GEO_RUN_POST_ID && pageIdentifier !== `post-${GEO_RUN_POST_ID}`) {
            const geoRunPostData = CoreApp.getPostData(GEO_RUN_POST_ID);
            if (geoRunPostData && typeof geoRunPostData.cleanupUI === 'function') {
                logToMobile("showRebusPage: Kaller cleanupUI for GeoRun (Post 7) fordi vi navigerer bort.", "debug");
                geoRunPostData.cleanupUI();
            }
        }


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
            logToMobile(`Type of loadedPageElement for ${expectedWrapperId}: ${typeof loadedPageElement}. Is null? ${loadedPageElement === null}. Value: ${loadedPageElement}`, "debug");

            if (!loadedPageElement || typeof loadedPageElement.querySelector !== 'function') {
                 logToMobile(`FEIL: Kunne ikke finne gyldig rot-element med ID '${expectedWrapperId}' eller det er ikke et DOM-element etter innlasting av ${pageIdentifier}. Funnet: ${loadedPageElement}`, "error");
                 postContentContainer.innerHTML = `<p class="feedback error">Intern feil: Kunne ikke initialisere sideinnholdet korrekt for ${pageIdentifier}. Kontakt arrangør.</p>`;
                 return;
            }

            if (currentTeamData && pageIdentifier.startsWith('post-')) {
                const globalPostNumMatch = pageIdentifier.match(/post-(\d+)/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    updatePageText(loadedPageElement, teamPostNum, globalPostNum);

                    const postData = CoreApp.getPostData(globalPostNum);
                    if (postData && postData.type === 'georun' && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${globalPostNum}`] &&
                        !currentTeamData.geoRunState[`post${globalPostNum}`].active &&
                        !currentTeamData.geoRunState[`post${globalPostNum}`].finished &&
                        !currentTeamData.geoRunState[`post${globalPostNum}`].awaitingGeoRunStartConfirmation) {
                        if (postData.geoRunPoints && postData.geoRunPoints[0]) {
                            updateMapMarker(null, false, postData.geoRunPoints[0]);
                        } else {
                            logToMobile(`Post ${globalPostNum} er georun, men mangler geoRunPoints[0] data for kartmarkør.`, "warn");
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
        } catch (error) {
            logToMobile(`Feil ved lasting av sideinnhold for '${pageIdentifier}': ${error.message} (catch-blokk i showRebusPage)`, "error");
            postContentContainer.innerHTML = `<p class="feedback error">Kunne ikke laste innholdet for ${pageIdentifier}. Prøv å laste siden på nytt.</p>`;
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
        logToMobile(`clearState kalt. (SVAR_ID: #89_core_clearState)`, "info"); 
        currentTeamData = null;
        saveState();
        stopContinuousUserPositionUpdate();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        clearMapMarker(); clearFinishMarker();
        if (map && START_LOCATION) map.panTo(START_LOCATION);
        if (scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        resetAllPostUIs(); 
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';

        const geoRunPostData = CoreApp.getPostData(GEO_RUN_POST_ID);
        if (geoRunPostData && typeof geoRunPostData.cleanupUI === 'function') {
            logToMobile("clearState: Kaller cleanupUI for GeoRun (Post 7).", "debug");
            geoRunPostData.cleanupUI();
        }

        logToMobile("All state og UI nullstilt.", "info");
    }
    
    function resetAllPostUIs() { 
        logToMobile("resetAllPostUIs kalt.", "debug");
    }

    async function initializeTeam(teamCode, teamPassword) {
        logToMobile(`initializeTeam kalt med kode: ${teamCode}. (SVAR_ID: #89_core_initTeam)`, "info"); 
        const feedbackElDynamic = document.getElementById('team-code-feedback-dynamic');

        if (Object.keys(CoreApp.registeredPostsData).length === 0) {
            logToMobile("initializeTeam: Ingen poster er registrert i CoreApp. Kan ikke starte lag.", "error");
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Systemfeil: Ingen poster lastet. Kontakt arrangør.";
                feedbackElDynamic.className = "feedback error";
            }
            return;
        }

        const teamCodeUpper = teamCode.toUpperCase();
        const teamConfig = TEAM_CONFIG[teamCodeUpper];

        if (!teamConfig) {
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Ugyldig lagkode. Prøv igjen.";
                feedbackElDynamic.className = "feedback error";
            }
            logToMobile(`Ugyldig lagkode: ${teamCode}`, "warn");
            return;
        }

        if (teamPassword !== teamConfig.password) {
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Feil passord for valgt lag. Prøv igjen.";
                feedbackElDynamic.className = "feedback error";
            }
            logToMobile(`Feil passord for lag ${teamCodeUpper}. Oppgitt: '${teamPassword}', Forventet: '${teamConfig.password}'`, "warn");
            const passInput = document.getElementById('team-password-input-dynamic');
            if (passInput) { passInput.value = ''; passInput.focus(); }
            return;
        }


        currentTeamData = {
            teamCode: teamCodeUpper, teamName: teamConfig.name, postSequence: teamConfig.postSequence,
            currentPostArrayIndex: 0, score: 0, startTime: Date.now(), endTime: null, totalTimeSeconds: null,
            completedPostsCount: 0, completedGlobalPosts: {}, unlockedPosts: {}, taskAttempts: {},
            taskCompletionTimes: {}, mannedPostTeacherVerified: {}, minigolfScores: {}, pyramidPoints: {},
            geoRunState: {}, arrivalSoundPlayed: {}, canEnterFinishCode: false,
            pointsPerPost: {}
        };

        currentTeamData.postSequence.forEach(postId => {
            const postData = CoreApp.getPostData(postId);
            if (postData && postData.type === 'georun') {
                currentTeamData.geoRunState[`post${postId}`] = {
                    active: false, finished: false, startTime: null, endTime: null, lap: 0,
                    pointsAwarded: 0,
                    awaitingGeoRunStartConfirmation: false,
                    totalLaps: postData.lapsToComplete || 5
                };
            }
        });

        saveState();
        logToMobile(`Lag ${currentTeamData.teamName} initialisert. Starter på post ${currentTeamData.postSequence[0]}. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}`, "info");
        if (feedbackElDynamic) feedbackElDynamic.textContent = '';

        const firstPostId = currentTeamData.postSequence[0];
        await showRebusPage(`post-${firstPostId}`);

        updateMapMarker(firstPostId, false);
        startContinuousUserPositionUpdate();
        updateScoreDisplay();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'block';
    }

    function handleTeacherPassword(postNum, password) {
        const postData = CoreApp.getPostData(postNum);
        const feedbackEl = document.getElementById(`feedback-teacher-password-post${postNum}`);
        const passInput = document.getElementById(`teacher-password-input-post${postNum}`);

        if (!postData || !feedbackEl || !passInput) {
            logToMobile(`handleTeacherPassword: Nødvendige elementer/data mangler for post ${postNum}.`, "error");
            return;
        }
        if (password.toUpperCase() === postData.teacherPassword.toUpperCase()) {
            feedbackEl.textContent = "Korrekt passord! Oppgaven er låst opp.";
            feedbackEl.className = "feedback success";
            passInput.disabled = true;
            const passButton = document.querySelector(`.submit-teacher-password-btn[data-post="${postNum}"]`);
            if(passButton) passButton.disabled = true;

            currentTeamData.mannedPostTeacherVerified[`post${postNum}`] = true;
            saveState();
            logToMobile(`Lærerpassord korrekt for post ${postNum}.`, "info");
            resetPageUI(`post-${postNum}`, document.getElementById(`post-${postNum}-content-wrapper`)); 
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

        const feedbackEl = pageElement.querySelector('#pyramid-results-feedback');
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
        const proceedButton = pageElement.querySelector(`#pyramid-proceed-btn-post${postNum}`);
        if (proceedButton) { proceedButton.style.display = 'inline-block'; proceedButton.disabled = false; }

        CoreApp.markPostAsCompleted(postNum, points);
    }

    function handleGeoRunLogic(isAtTargetPoint, targetPointId, currentGeoRunPostId = null) {
        if (!currentTeamData) return;

        const postId = currentGeoRunPostId || currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        const postData = CoreApp.getPostData(postId);
        const runState = currentTeamData.geoRunState[`post${postId}`];
        const pageElement = document.getElementById(`post-${postId}-content-wrapper`);

        if (!postData || postData.type !== 'georun' || !runState || !pageElement || !runState.active || runState.finished) {
            return;
        }

        const currentLapEl = pageElement.querySelector('.geo-run-current-lap');
        const nextTargetEl = pageElement.querySelector('.geo-run-next-target');
        const totalLegs = runState.totalLaps;

        const currentTargetIndexInSequence = runState.lap - 1;
        const targetPointActualIndex = postData.runTargetIndices[currentTargetIndexInSequence];
        const expectedTargetGlobalId = `geoRunTarget${targetPointActualIndex}`;

        if (isAtTargetPoint && targetPointId === expectedTargetGlobalId) {
            logToMobile(`GeoRun Post ${postId}: Mål ${postData.geoRunPoints[targetPointActualIndex].name} nådd på etappe ${runState.lap}.`, "info");
            playGeoRunTurnSound();

            if (runState.lap >= totalLegs) {
                runState.finished = true;
                runState.active = false;
                runState.endTime = Date.now();
                const totalTimeMs = runState.endTime - runState.startTime;
                logToMobile(`GeoRun Post ${postId} FULLFØRT! Tid: ${formatTimeFromMs(totalTimeMs)}`, "info");

                let pointsAwarded = 0;
                const totalTimeSeconds = totalTimeMs / 1000;
                if (postData.pointsScale) {
                    for (const threshold in postData.pointsScale) {
                        if (totalTimeSeconds <= parseFloat(threshold)) {
                            pointsAwarded = postData.pointsScale[threshold];
                            break;
                        }
                    }
                } else {
                    logToMobile(`GeoRun Post ${postId}: Ingen pointsScale definert. Gir 0 poeng.`, "warn");
                }
                runState.pointsAwarded = pointsAwarded;

                CoreApp.markPostAsCompleted(postId, pointsAwarded);
            } else {
                runState.lap++;
                if(currentLapEl) currentLapEl.textContent = `${runState.lap}`;

                const nextTargetPointIndexInSequence = runState.lap - 1;
                const nextTargetPointActualIndex = postData.runTargetIndices[nextTargetPointIndexInSequence];
                const nextMapTargetPoint = postData.geoRunPoints[nextTargetPointActualIndex];

                if(nextTargetEl) nextTargetEl.textContent = nextMapTargetPoint.name;
                updateMapMarker(null, false, nextMapTargetPoint);
                if (typeof postData.updateMiniMapDisplay === 'function') {
                    let currentUserPosForMiniMap = null;
                    if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                        currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                    } else if (DEV_MODE_NO_GEOFENCE && postData.geoRunPoints && postData.geoRunPoints[0]) {
                        currentUserPosForMiniMap = new google.maps.LatLng(postData.geoRunPoints[0].lat, postData.geoRunPoints[0].lng);
                    }
                    postData.updateMiniMapDisplay(currentUserPosForMiniMap, currentTeamData);
                }
            }
            saveState();
        }
    }


    function handleTaskCheck(postNum, userAnswer) {
        const postData = CoreApp.getPostData(postNum);
        if (!postData || (postData.type !== 'standard' && postData.type !== 'standard_hint')) return;

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
        let isCorrect = false;
        const maxAttemptsForPost = postData.maxAttempts || 5;
        const attemptsMade = currentTeamData.taskAttempts[`post${postNum}`];

        if (postData.answerRange && typeof postData.answerRange.min === 'number' && typeof postData.answerRange.max === 'number') {
            const userAnswerNum = parseInt(userAnswer);
            if (!isNaN(userAnswerNum) && userAnswerNum >= postData.answerRange.min && userAnswerNum <= postData.answerRange.max) {
                isCorrect = true;
            }
        } else if (postData.correctAnswer) {
            if (userAnswer.toUpperCase() === postData.correctAnswer.toUpperCase()) {
                isCorrect = true;
            }
        }

        if (isCorrect) {
            const pointsAwarded = Math.max(0, 5 - (attemptsMade - 1));
            if(feedbackEl) {
                feedbackEl.textContent = `Riktig svar! Du fikk ${pointsAwarded} poeng.`;
                feedbackEl.className = "feedback success";
            }
            if(inputEl) inputEl.disabled = true;
            if(checkButton) checkButton.disabled = true;
            if(attemptsEl) attemptsEl.textContent = `Post fullført! Poeng: ${pointsAwarded}`;
            logToMobile(`Post ${postNum} korrekt besvart på forsøk ${attemptsMade}. Poeng: ${pointsAwarded}.`, "info");
            CoreApp.markPostAsCompleted(postNum, pointsAwarded);
        } else {
            const remainingAttempts = maxAttemptsForPost - attemptsMade;
            if(feedbackEl) {
                feedbackEl.textContent = "Feil svar.";
                feedbackEl.className = "feedback error shake";
            }
            if(inputEl) { inputEl.value = ""; inputEl.focus(); }
            logToMobile(`Post ${postNum} feil besvart. Forsøk ${attemptsMade} av ${maxAttemptsForPost}.`, "warn");

            if (postData.type === 'standard_hint' && postData.hints && postData.hints.length > 0) {
                if (typeof postData.initUI === 'function') {
                    logToMobile(`Post ${postNum} (hint): Viser neste hint etter feil svar.`, "debug");
                    postData.initUI(pageElement, currentTeamData);
                }
            }

            if (remainingAttempts <= 0) {
                if(feedbackEl) feedbackEl.textContent += ` Ingen flere forsøk igjen på denne posten.`;
                if(inputEl) inputEl.disabled = true;
                if(checkButton) checkButton.disabled = true;
                if(attemptsEl) attemptsEl.textContent = "Ingen flere forsøk. 0 poeng.";
                logToMobile(`Post ${postNum}: Ingen flere forsøk. Markerer som fullført med 0 poeng.`, "info");
                CoreApp.markPostAsCompleted(postNum, 0);
            } else {
                if(feedbackEl && !(postData.type === 'standard_hint' && postData.hints && postData.hints.length > attemptsMade)) {
                    feedbackEl.textContent += ` Prøv igjen!`;
                }
                if(attemptsEl) attemptsEl.textContent = `Forsøk igjen: ${remainingAttempts}`;
            }
            saveState();
            setTimeout(() => { if(feedbackEl) feedbackEl.classList.remove('shake'); }, 500);
        }
    }

    window.proceedToNextPostOrFinishGlobal = function() {
        if (!currentTeamData) return;
        logToMobile("proceedToNextPostOrFinishGlobal kalt.", "info");

        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
            logToMobile("Alle poster fullført. Viser finalesiden.", "info");
            showRebusPage('finale');
            updateMapMarker(null, true);
        } else {
            currentTeamData.currentPostArrayIndex++;
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                logToMobile(`Går til neste post: ${nextPostGlobalId} (Indeks: ${currentTeamData.currentPostArrayIndex})`, "info");
                showRebusPage(`post-${nextPostGlobalId}`);
                updateMapMarker(nextPostGlobalId, false);
                saveState();
            } else {
                logToMobile("Feil: Prøvde å gå forbi siste post i sekvensen, men ikke alle er fullført (eller ingen poster registrert)?", "error");
                showRebusPage('finale');
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

        if (userAnswer.toUpperCase() === FINISH_UNLOCK_CODE.toUpperCase()) {
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
            clearMapMarker();
            updateMapMarker(null, true);
            const finaleContentWrapper = document.getElementById('finale-content-wrapper');
            if (finaleContentWrapper) {
                showRebusPage('finale');
            }

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

    // === EVENT LISTENERS (inne i DOMContentLoaded) ===
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) ) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; const postData = CoreApp.getPostData(currentPostGlobalId); if(postData) { if(postData.type === 'georun' && currentTeamData.geoRunState[`post${currentPostGlobalId}`] && postData.geoRunPoints && postData.geoRunPoints[0]) { const runState = currentTeamData.geoRunState[`post${currentPostGlobalId}`]; if (runState.active && runState.lap > 0 && runState.lap <= postData.runTargetIndices.length) { const targetIdx = postData.runTargetIndices[runState.lap -1]; targetLocation = postData.geoRunPoints[targetIdx]; } else { targetLocation = postData.geoRunPoints[0]; } } else { targetLocation = {lat: postData.lat, lng: postData.lng}; } } } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
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
                const dynamicTeamPasswordInput = postContentContainer.querySelector('#team-password-input-dynamic');
                if (dynamicTeamCodeInput && dynamicTeamPasswordInput) { initializeTeam(dynamicTeamCodeInput.value, dynamicTeamPasswordInput.value.trim()); }
                else { logToMobile("FEIL: Fant ikke team-code-input-dynamic eller team-password-input-dynamic.", "error"); }
            } else if (target.classList.contains('check-task-btn') && !target.disabled) {
                const postNum = parseInt(target.getAttribute('data-post'));
                const postData = CoreApp.getPostData(postNum);
                if (postData && (postData.type === 'standard' || postData.type === 'standard_hint')) {
                    const taskInput = postContentContainer.querySelector(`#post-${postNum}-task-input`);
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim());
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
            else if (target.id.startsWith('start-georun-btn-post') && !target.disabled) {
                logToMobile(`GeoRun Startknapp klikket: ID ${target.id}`, "debug");
                const postIdString = target.id.replace('start-georun-btn-post', '');
                const postId = parseInt(postIdString);

                const postData = CoreApp.getPostData(postId);
                const runState = currentTeamData ? currentTeamData.geoRunState[`post${postId}`] : null;

                logToMobile(`GeoRun Startknapp: postId=${postId}, postData=${!!postData}, runState=${!!runState}`, "debug");
                if (runState) {
                    logToMobile(`GeoRun Startknapp: runState.awaitingGeoRunStartConfirmation = ${runState.awaitingGeoRunStartConfirmation}`, "debug");
                }

                if (postData && runState && runState.awaitingGeoRunStartConfirmation) {
                    logToMobile(`GeoRun Post ${postId}: Startknapp trykket! Løpet starter NÅ!`, "info");
                    runState.active = true;
                    runState.awaitingGeoRunStartConfirmation = false;
                    runState.startTime = Date.now();
                    runState.lap = 1;

                    const pageElement = document.getElementById(`post-${postId}-content-wrapper`);
                    if (pageElement) {
                        const initialInstructionsEl = pageElement.querySelector('#georun-instructions-initial');
                        const beforeStartInstructionsEl = pageElement.querySelector('#georun-instructions-before-start');
                        const startButtonSection = pageElement.querySelector('.geo-run-start-button-section');
                        const activeSection = pageElement.querySelector('.geo-run-active-section');
                        const currentLapEl = pageElement.querySelector('.geo-run-current-lap');
                        const nextTargetEl = pageElement.querySelector('.geo-run-next-target');

                        if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
                        if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';
                        if(startButtonSection) startButtonSection.style.display = 'none';
                        if(activeSection) activeSection.style.display = 'block';

                        if(currentLapEl) currentLapEl.textContent = `${runState.lap}`;

                        const firstTargetPointActualIndex = postData.runTargetIndices[0];
                        const firstMapTargetPoint = postData.geoRunPoints[firstTargetPointActualIndex];

                        if(nextTargetEl) nextTargetEl.textContent = firstMapTargetPoint.name;
                        updateMapMarker(null, false, firstMapTargetPoint);
                        if (typeof postData.updateMiniMapDisplay === 'function') {
                            let currentUserPosForMiniMap = null;
                            if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                                currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                            } else if (DEV_MODE_NO_GEOFENCE && postData.geoRunPoints && postData.geoRunPoints[0]) {
                                currentUserPosForMiniMap = new google.maps.LatLng(postData.geoRunPoints[0].lat, postData.geoRunPoints[0].lng);
                            }
                            postData.updateMiniMapDisplay(currentUserPosForMiniMap, currentTeamData);
                        }
                        playGeoRunStartSoundSequence();
                        saveState();
                    } else {
                        logToMobile(`GeoRun Post ${postId} Start: Fant ikke pageElement.`, "error");
                    }
                } else {
                     logToMobile(`GeoRun Post ${postId} Start: Betingelse for start feilet. postData: ${!!postData}, runState: ${!!runState}, awaiting: ${runState ? runState.awaitingGeoRunStartConfirmation : 'N/A'}`, "warn");
                }
            }
            else if (target.id === 'skip-georun-btn-post7' && !target.disabled) {
                if (confirm("Er du sikker på at du vil hoppe over Geo-løpet? Du vil få 0 poeng for denne posten.")) {
                    logToMobile(`Bruker valgte å hoppe over Geo-løp (Post ${GEO_RUN_POST_ID}). Gir 0 poeng.`, "info");
                    CoreApp.markPostAsCompleted(GEO_RUN_POST_ID, 0);
                    window.proceedToNextPostOrFinishGlobal();
                }
            }
            else if (target.id.startsWith('geo-run-proceed-btn-post') && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'finish-unlock-btn' && !target.disabled) {
                const finishCodeInput = postContentContainer.querySelector('#finish-unlock-input');
                if (finishCodeInput && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE) ) { handleFinishCodeInput(finishCodeInput.value.trim()); }
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
                if (target.id === 'team-code-input-dynamic' || target.id === 'team-password-input-dynamic') {
                    event.preventDefault();
                    const dynamicStartButton = postContentContainer.querySelector('#start-with-team-code-button-dynamic');
                    if (dynamicStartButton && !dynamicStartButton.disabled) { dynamicStartButton.click(); }
                } else if (target.classList.contains('post-task-input') && !target.disabled) {
                    const postWrapperDiv = target.closest('div[id$="-content-wrapper"]');
                    if (postWrapperDiv) {
                        const pageId = postWrapperDiv.id.replace('-content-wrapper', '');
                        const postNum = parseInt(pageId.split('-')[1]);
                        const postData = CoreApp.getPostData(postNum);
                        if (postData && (postData.type === 'standard' || postData.type === 'standard_hint')) {
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
                    if (associatedButton && !associatedButton.disabled && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE)) { handleFinishCodeInput(target.value.trim()); }
                }
            }
        });
    }

    document.addEventListener('postReached', function(event) {
        if (event.detail && event.detail.pageId) {
            logToMobile(`Custom event 'postReached' for pageId: ${event.detail.pageId}.`, "debug");
            const pageElement = document.getElementById(event.detail.pageId + "-content-wrapper");
            if (pageElement) {
                logToMobile(`postReached event: pageElement ${pageElement.id} funnet. Kaller resetPageUI.`, "debug");
                resetPageUI(event.detail.pageId, pageElement); 
            } else {
                logToMobile(`postReached event: Kunne ikke finne pageElement for ${event.detail.pageId}-content-wrapper`, "error");
            }
        } else {
            logToMobile(`Custom event 'postReached' mottatt, men mangler detail eller pageId.`, "warn");
        }
    });
    document.addEventListener('geoRunLogicTrigger', function(event) { if (event.detail) { logToMobile(`Custom event 'geoRunLogicTrigger' for target: ${event.detail.targetPointId}, postId: ${event.detail.postId}`, "debug"); handleGeoRunLogic(event.detail.isAtTargetPoint, event.detail.targetPointId, event.detail.postId); }});
    document.addEventListener('startGeoRunPrePipsTrigger', function(event) { /* Ikke lenger i bruk */ });
    document.addEventListener('scoreUpdated', updateScoreDisplay);
    document.addEventListener('requestProceedToNext', window.proceedToNextPostOrFinishGlobal);

    // === INITALISERING VED LASTING AV SIDE ===
    const postScriptsToLoad = [];
    for (let i = 1; i <= TOTAL_POSTS; i++) {
        postScriptsToLoad.push(`posts/post${i}.js`);
    }

    Promise.all(postScriptsToLoad.map(scriptPath => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = false;
            script.onload = () => {
                logToMobile(`${scriptPath} lastet.`, "debug");
                resolve(true);
            };
            script.onerror = () => {
                logToMobile(`FEIL ved lasting av ${scriptPath}.`, "error");
                reject(new Error(`Failed to load ${scriptPath}`));
            };
            document.head.appendChild(script);
        });
    }))
    .then(async () => {
        logToMobile(`Alle ${postScriptsToLoad.length} post-spesifikke scripts lastet. Registrerer poster...`, "info");
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const defineFunctionName = `definePost${i}`;
            if (typeof window[defineFunctionName] === 'function') {
                try {
                    const postData = window[defineFunctionName]();
                    if (postData) {
                        CoreApp.registerPost(postData);
                    } else {
                        logToMobile(`${defineFunctionName} returnerte ikke data. Post ${i} ikke registrert.`, "warn");
                    }
                } catch (e) {
                    logToMobile(`Feil under kjøring av ${defineFunctionName} eller registrering av post ${i}: ${e.message}`, "error");
                }
            } else {
                logToMobile(`${defineFunctionName} er ikke definert. Post ${i} kan ikke registreres.`, "warn");
            }
        }
        logToMobile(`Post-registrering fullført. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}.`, "info");
        CoreApp.setReady();

        if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }

        if (loadState()) {
            logToMobile("Tilstand lastet fra localStorage.", "info");
            showTabContent('rebus');
            if (currentTeamData.endTime) {
                await showRebusPage('finale');
                if (map) updateMapMarker(null, true);
            } else if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
                await showRebusPage('finale');
                if (map) updateMapMarker(null, true);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && currentTeamData.postSequence.length > 0 && Object.keys(CoreApp.registeredPostsData).length > 0) {
                const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                 if (CoreApp.getPostData(currentExpectedPostId)) {
                    await showRebusPage(`post-${currentExpectedPostId}`);
                    if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
                 } else {
                    logToMobile(`Post ${currentExpectedPostId} fra lagret state er ikke registrert (Antall registrerte: ${Object.keys(CoreApp.registeredPostsData).length}). Nullstiller.`, "warn");
                    clearState();
                    await showRebusPage('intro');
                 }
            } else {
                logToMobile("Uventet tilstand ved lasting (eller ingen poster registrert), nullstiller.", "warn");
                clearState();
                await showRebusPage('intro');
            }
            updateUIAfterLoad();
        } else {
            logToMobile("Ingen lagret tilstand funnet, viser introduksjonsside.", "info");
            showTabContent('rebus');
            await showRebusPage('intro');
        }
        logToMobile("Initial page setup complete.", "info");
    });
});
/* Version: #89 */
