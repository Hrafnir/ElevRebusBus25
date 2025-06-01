/* Version: #81 */
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
            currentTeamData.pointsPerPost[`post${postId}`] = pointsAwarded; // Lagre poeng for denne posten

            if (postData.type === 'georun' && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${postId}`]) {
                currentTeamData.geoRunState[`post${postId}`].pointsAwarded = pointsAwarded;
            }

            logToMobile(`Post ${postId} markert som fullført. Poeng totalt: ${currentTeamData.score}, Poeng for post: ${pointsAwarded}, Fullførte: ${currentTeamData.completedPostsCount}`, "info");
            saveState();
            document.dispatchEvent(new CustomEvent('scoreUpdated'));

            const requiresManualProceed = ['manned_minigolf', 'manned_pyramid', 'georun'];
            if (!requiresManualProceed.includes(postData.type)) {
                logToMobile(`Post ${postId} (type: ${postData.type}) går automatisk videre.`, "debug");
                document.dispatchEvent(new CustomEvent('requestProceedToNext'));
            } else {
                logToMobile(`Post ${postId} (type: ${postData.type}) krever manuell 'Gå Videre'. Viser resultat/ferdig-UI.`, "debug");
                const currentPageId = `post-${postId}`;
                const pageElement = document.getElementById(`${currentPageId}-content-wrapper`);
                if (pageElement) {
                    resetPageUI(currentPageId, pageElement);
                } else {
                    logToMobile(`Sideelement for post ${postId} ikke funnet for umiddelbar UI-oppdatering etter markPostAsCompleted.`, "warn");
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
const DEV_MODE_NO_GEOFENCE = false; // ENDRET TIL false
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
    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) {
        updateGeofenceFeedback(null, false, true, null, false); return;
    }

    let targetLocationDetails = null;
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
            } else if (!runState.active && !runState.finished && !runState.awaitingGeoRunStartConfirmation && !runState.processingResults) {
                 targetLocationDetails = { location: allGeoRunPoints[0], pageId: `post-${currentGlobalIdOriginal}`, globalId: `geoRunInitialArrival`, name: allGeoRunPoints[0].name };
                 currentGeofenceRadius = GEOFENCE_RADIUS;
            } else {
                isGeoRunActiveForCurrentPost = false;
            }
        }
    }

    if (!isGeoRunActiveForCurrentPost ||
        (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.finished && !currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.awaitingGeoRunStartConfirmation) ||
        (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${currentGlobalIdOriginal}`]?.processingResults)
       ) {
        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name };
            isCurrentTargetTheFinishLine = true;
            currentGeofenceRadius = GEOFENCE_RADIUS;
        } else if (Object.keys(CoreApp.registeredPostsData).length > 0) {
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            const postDataForNav = CoreApp.getPostData(currentGlobalId);
            if (postDataForNav && typeof postDataForNav.lat !== 'undefined' && typeof postDataForNav.lng !== 'undefined') {
                if (!(currentPostDataFromCore && currentPostDataFromCore.id === postDataForNav.id && currentPostDataFromCore.type === 'georun' && currentTeamData.geoRunState[`post${currentPostDataFromCore.id}`]?.processingResults)) {
                    targetLocationDetails = { location: {lat: postDataForNav.lat, lng: postDataForNav.lng}, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postDataForNav.name || `Post ${currentGlobalId}` };
                    currentGeofenceRadius = GEOFENCE_RADIUS;
                }
            } else { logToMobile(`handlePositionUpdate: Kunne ikke finne data eller koordinater for post ${currentGlobalId}.`, "warn"); }
        } else { logToMobile("handlePositionUpdate: Ingen registrerte poster, kan ikke bestemme mål.", "warn"); }
    }

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

document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output');
    logToMobile(`DEBUG_V77: DOMContentLoaded event fired.`, "info");
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

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }
    function displayFinalResults() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V77: Displaying final results.`, "info");
        // ... (resten av funksjonen uendret)
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

    async function showRebusPage(pageIdentifier) { /* ... (uendret fra v68) ... */ }
    function showTabContent(tabId) { /* ... (uendret) ... */ }
    function loadState() { /* ... (uendret) ... */ }
    function clearState() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V77: clearState kalt`, "info");
        // ... (resten uendret)
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
    function resetPageUI(pageIdentifier, pageElementContext = null) { /* ... (uendret fra v68) ... */ }
    function resetAllPostUIs() { /* ... (uendret) ... */ }

    async function initializeTeam(teamCode, teamPassword) {
        logToMobile(`DEBUG_V77: initializeTeam kalt med kode: ${teamCode}`, "info");
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
                    processingResults: false,
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

    function handleTeacherPassword(postNum, password) { /* ... (uendret fra v68) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (uendret fra v68) ... */ }
    function handlePyramidPointsSubmit(postNum, pointsStr) { /* ... (uendret fra v68) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId, currentGeoRunPostId = null) { /* ... (uendret fra v68, men med forsinkelse for resultatvisning) ... */
        if (!currentTeamData) return;

        const postId = currentGeoRunPostId || currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        const postData = CoreApp.getPostData(postId);
        const runState = currentTeamData.geoRunState[`post${postId}`];
        const pageElement = document.getElementById(`post-${postId}-content-wrapper`);

        if (!postData || postData.type !== 'georun' || !runState || !pageElement || !runState.active || runState.finished || runState.processingResults) {
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
                runState.active = false;
                runState.processingResults = true;
                saveState();
                logToMobile(`GeoRun Post ${postId}: Siste etappe fullført. Viser "behandler resultat"-melding.`, "info");

                if (typeof postData.initUI === 'function') {
                    postData.initUI(pageElement, currentTeamData);
                }

                setTimeout(() => {
                    if (!currentTeamData || !currentTeamData.geoRunState[`post${postId}`]) return;
                    const currentRunState = currentTeamData.geoRunState[`post${postId}`];
                    if (!currentRunState || !currentRunState.processingResults) return;


                    currentRunState.finished = true;
                    currentRunState.processingResults = false;
                    currentRunState.endTime = Date.now();
                    const totalTimeMs = currentRunState.endTime - currentRunState.startTime;
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
                    currentRunState.pointsAwarded = pointsAwarded;
                    CoreApp.markPostAsCompleted(postId, pointsAwarded);
                }, 2000);

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
                saveState();
            }
        }
    }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret fra v68) ... */ }
    window.proceedToNextPostOrFinishGlobal = function() { /* ... (uendret fra v68) ... */ }
    function updateUIAfterLoad() { /* ... (uendret fra v68) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (uendret fra v68) ... */ }

    // === EVENT LISTENERS ===
    tabButtons.forEach(button => { /* ... (uendret fra v68) ... */ });
    const globalDevResetButtons = document.querySelectorAll('.container > .dev-reset-button');
    globalDevResetButtons.forEach(button => { /* ... (uendret fra v68) ... */ });
    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { /* ... (uendret fra v68) ... */ }
    if (clearLogBtn && mobileLogContainer) { /* ... (uendret fra v68) ... */ }

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
                const postIdString = target.id.replace('start-georun-btn-post', ''); // KORRIGERT
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
        postContentContainer.addEventListener('keypress', (event) => { /* ... (uendret fra v68) ... */ });
    }

    document.addEventListener('postReached', function(event) { /* ... (uendret fra v68) ... */ });
    document.addEventListener('geoRunLogicTrigger', function(event) { /* ... (uendret fra v68) ... */ });
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
    })
    .catch(error => {
        logToMobile(`Alvorlig feil under lasting av post-skript: ${error.message}. Applikasjonen kan være ustabil.`, "error");
        postContentContainer.innerHTML = `<p class="feedback error">En kritisk feil oppstod under lasting av spillets data. Prøv å laste siden på nytt, eller kontakt en arrangør.</p>`;
    });
});
/* Version: #81 */
