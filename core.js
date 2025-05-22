/* Version: #39 */
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
    // setReady fjernes her, kalles etter Promise.all
};

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10; // Kan potensielt fjernes hvis vi alltid stoler på lengden av registeredPostsData
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
    
    const currentPostDataFromCore = CoreApp.getPostData(currentGlobalIdOriginal);

    if (currentGlobalIdOriginal === GEO_RUN_POST_ID && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] && currentPostDataFromCore && currentPostDataFromCore.type === 'georun') {
        const runState = currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]; 
        isGeoRunActiveForCurrentPost = true; 
        logToMobile(`handlePositionUpdate: Er på Post 7 (GeoRun). RunState active: ${runState.active}, finished: ${runState.finished}, prePipsDone: ${runState.preCountdownPipsDone}`, "debug");

        const geoRunPoint1Data = currentPostDataFromCore.geoRunPoint1 || GEO_RUN_POINT1; 
        const geoRunPoint2Data = currentPostDataFromCore.geoRunPoint2 || GEO_RUN_POINT2;
        const prePipsForThisRun = currentPostDataFromCore.preCountdownPips || GEO_RUN_PRE_COUNTDOWN_PIPS;


        if (runState.preCountdownPipsDone < prePipsForThisRun && !runState.active && !runState.finished && !runState.preRunPipTimerId) { 
            targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${GEO_RUN_POST_ID}`, globalId: `geoRunPreCountdown`, name: geoRunPoint1Data.name };
            logToMobile("handlePositionUpdate: Mål for GeoRun er preCountdown.", "debug");
        } else if (!runState.active && !runState.finished) { 
            targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${GEO_RUN_POST_ID}`, globalId: `geoRunStart`, name: geoRunPoint1Data.name }; 
            logToMobile("handlePositionUpdate: Mål for GeoRun er startpunkt.", "debug");
        } else if (runState.active && !runState.finished) { 
            if (runState.lap % 2 !== 0) { targetLocationDetails = { location: geoRunPoint2Data, pageId: `post-${GEO_RUN_POST_ID}`, globalId: `geoRunPoint2`, name: geoRunPoint2Data.name }; } 
            else { targetLocationDetails = { location: geoRunPoint1Data, pageId: `post-${GEO_RUN_POST_ID}`, globalId: `geoRunPoint1`, name: geoRunPoint1Data.name }; } 
            logToMobile(`handlePositionUpdate: Mål for GeoRun er aktivt løp, target: ${targetLocationDetails.name}`, "debug");
        } else {
            isGeoRunActiveForCurrentPost = false; 
            logToMobile("handlePositionUpdate: GeoRun er ferdig, bruker vanlig postlogikk.", "debug");
        }
    }

    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) {
        if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) { 
            targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale', globalId: 'finish', name: FINISH_LOCATION.name }; 
            isCurrentTargetTheFinishLine = true; 
            logToMobile("handlePositionUpdate: Mål er FINISH_LOCATION.", "debug");
        } else { 
            const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; 
            const postDataForNav = CoreApp.getPostData(currentGlobalId);
            if (postDataForNav && typeof postDataForNav.lat !== 'undefined' && typeof postDataForNav.lng !== 'undefined') { 
                targetLocationDetails = { location: {lat: postDataForNav.lat, lng: postDataForNav.lng}, pageId: `post-${currentGlobalId}`, globalId: currentGlobalId, name: postDataForNav.name || `Post ${currentGlobalId}` }; 
                logToMobile(`handlePositionUpdate: Mål er Post ${currentGlobalId}.`, "debug");
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
    logToMobile(`handlePositionUpdate: Target: ${targetLocationDetails.name}, Avstand: ${distance.toFixed(1)}m, InnenforRange: ${isWithinRange}, EffektivtInnenfor: ${isEffectivelyWithinRange}`, "debug");
    
    let canCurrentlyInteract = false; 
    if (isCurrentTargetTheFinishLine) {
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange; 
        const finishUnlockInput = document.getElementById('finish-unlock-input'); 
        const finishUnlockButton = document.getElementById('finish-unlock-btn'); 
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
                const thisPostData = CoreApp.getPostData(postGlobalId);
                if (thisPostData && thisPostData.type === 'georun') { 
                    const runStateForPips = currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]; 
                    if (runStateForPips && !runStateForPips.preRunPipTimerId && runStateForPips.preCountdownPipsDone < (thisPostData.preCountdownPips || GEO_RUN_PRE_COUNTDOWN_PIPS) ) {
                        document.dispatchEvent(new CustomEvent('startGeoRunPrePipsTrigger'));
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
    if (!isGeoRunActiveForCurrentPost || (currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) { updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract); }
}

function startContinuousUserPositionUpdate() { if (!navigator.geolocation) { logToMobile("Geolocation ikke støttet.", "warn"); return; } if (mapPositionWatchId !== null) return; logToMobile("Starter kontinuerlig GPS posisjonssporing.", "info"); mapPositionWatchId = navigator.geolocation.watchPosition( handlePositionUpdate, (error) => { handleGeolocationError(error); if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) {} }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }); }
function stopContinuousUserPositionUpdate() { if (mapPositionWatchId !== null) { navigator.geolocation.clearWatch(mapPositionWatchId); mapPositionWatchId = null; logToMobile("Stoppet kontinuerlig GPS sporing.", "info"); updateGeofenceFeedback(null, false, true, null, false); } }


document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output'); 
    logToMobile("DEBUG_V38: DOMContentLoaded event fired.", "info");
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
            const geoRunSetupInstructions = pageElement.querySelector('.geo-run-setup-section p:not(:first-child)'); 
            if (geoRunSetupInstructions && postData.instructionsTask) {
                geoRunSetupInstructions.textContent = postData.instructionsTask;
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
        logToMobile("DEBUG_V38: Displaying final results.", "info");
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
                        const fromPoint = (i === 0) ? "Start" : CoreApp.getPostData(currentTeamData.postSequence[i-1]).name;
                        li.textContent = `${fromPoint} til ${postName}: ${formatTimeFromMs(stageTime)}`;
                        stageTimesList.appendChild(li);
                    } else if (i === 0) { 
                        const li = document.createElement('li');
                        li.textContent = `Start til ${postName}: Tid ukjent`;
                        stageTimesList.appendChild(li);
                    }
                } else {
                     const li = document.createElement('li');
                     const fromPoint = (i === 0) ? "Start" : CoreApp.getPostData(currentTeamData.postSequence[i-1]).name;
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
                        updateMapMarker(null, false, postData.geoRunPoint1 || GEO_RUN_POINT1); 
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
        const nextContent = document.getElementById(tabId + '-content');
        if (nextContent) nextContent.classList.add('visible');
        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabId) button.classList.add('active');
        });
    }
    
    function loadState() { 
        const savedData = localStorage.getItem('activeTeamData_Skolerebus');
        if (savedData) {
            try {
                currentTeamData = JSON.parse(savedData);
                if (!currentTeamData || typeof currentTeamData.completedPostsCount === 'undefined' ||
                    !currentTeamData.postSequence || !currentTeamData.unlockedPosts ||
                    typeof currentTeamData.score === 'undefined' || !currentTeamData.taskAttempts ||
                    currentTeamData.postSequence.length !== TOTAL_POSTS || // Bruk TOTAL_POSTS her for sekvenslengde
                    typeof currentTeamData.startTime === 'undefined' ||
                    typeof currentTeamData.taskCompletionTimes === 'undefined' || 
                    typeof currentTeamData.canEnterFinishCode === 'undefined' ||
                    typeof currentTeamData.mannedPostTeacherVerified === 'undefined' || 
                    typeof currentTeamData.arrivalSoundPlayed === 'undefined' || 
                    typeof currentTeamData.geoRunState === 'undefined' 
                ) { logToMobile("Lagret data er korrupt/utdatert (hovedsjekk), nullstiller.", "warn"); clearState(); return false; } 
                
                // Detaljert sjekk for bemannede poster og geo-løp
                if (currentTeamData.mannedPostTeacherVerified && (typeof currentTeamData.mannedPostTeacherVerified.post1 === 'undefined' || typeof currentTeamData.mannedPostTeacherVerified.post8 === 'undefined')) {
                     logToMobile("Lagret data mangler mannedPostTeacherVerified-detaljer, nullstiller.", "warn"); clearState(); return false;
                }
                if (!currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] || typeof currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].preCountdownPipsDone === 'undefined') {
                    logToMobile("Lagret data mangler geoRunState-detaljer for Post 7, nullstiller.", "warn"); clearState(); return false;
                }


                if (typeof currentTeamData.startTime === 'string') currentTeamData.startTime = parseInt(currentTeamData.startTime,10);
                if (currentTeamData.startTime && isNaN(currentTeamData.startTime)) currentTeamData.startTime = null; 
                
                if (!currentTeamData.minigolfScores) currentTeamData.minigolfScores = { post1: {} };
                if (!currentTeamData.pyramidPoints) currentTeamData.pyramidPoints = {};
                if (!currentTeamData.arrivalSoundPlayed) { 
                    currentTeamData.arrivalSoundPlayed = {};
                    // Initialiser basert på registrerte poster, ikke POST_LOCATIONS direkte
                    Object.keys(CoreApp.registeredPostsData).forEach(postId => currentTeamData.arrivalSoundPlayed[`post${postId}`] = false);
                    currentTeamData.arrivalSoundPlayed.finish = false;
                }
                if (!currentTeamData.geoRunState) { 
                     currentTeamData.geoRunState = {};
                }
                // Sikre at geoRunState for post 7 har alle nødvendige felter, selv om den er tom
                 if (!currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]) {
                    currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] = { 
                        active: false, lap: 0, startTime: null, lapStartTime: null, 
                        atPoint1: false, atPoint2: false, countdownTimerId: null, 
                        finished: false, totalTime: null, pointsAwarded: null,
                        preCountdownPipsDone: 0, 
                        preRunPipTimerId: null 
                    };
                }

                logToMobile("Lagret tilstand lastet.", "info");
                return true;
            } catch (e) { logToMobile(`Feil ved parsing av lagret data: ${e.message}`, "error"); clearState(); return false; }
        }
        currentTeamData = null; return false;
    }

    function clearState() { 
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
        
        const introTeamCodeInput = document.getElementById('team-code-input-dynamic'); 
        const introStartButton = document.getElementById('start-with-team-code-button-dynamic');
        const introFeedback = document.getElementById('team-code-feedback-dynamic');

        if(introTeamCodeInput) { introTeamCodeInput.value = ''; introTeamCodeInput.disabled = false;}
        if(introStartButton) introStartButton.disabled = false;
        if(introFeedback) { introFeedback.textContent = ''; introFeedback.className = 'feedback';}
        
        if (geofenceFeedbackElement) { geofenceFeedbackElement.style.display = 'none'; geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = ''; }
        logToMobile("State cleared by clearState().", "info");
    }

    function resetPageUI(pageIdentifier, pageElementContext = null) { 
        const pageElement = pageElementContext || document.getElementById(`${pageIdentifier}-content-wrapper`) || (postContentContainer ? postContentContainer.firstChild : null); 
        
        if (!pageElement) { logToMobile(`resetPageUI: Finner ikke pageElement for '${pageIdentifier}'.`, "warn"); return; }
        
        let postNum = null;
        if (pageIdentifier.startsWith('post-')) { postNum = parseInt(pageIdentifier.split('-')[1]); }

        logToMobile(`resetPageUI for pageIdentifier: '${pageIdentifier}', postNum: ${postNum}`, "debug");

        if (pageIdentifier === 'intro') { 
            const teamCodeInputForIntroReset = pageElement.querySelector('#team-code-input-dynamic'); 
            const startButtonForIntroReset = pageElement.querySelector('#start-with-team-code-button-dynamic');
            if(teamCodeInputForIntroReset) teamCodeInputForIntroReset.disabled = false;
            if(startButtonForIntroReset) startButtonForIntroReset.disabled = false;
            return;
        }

        if (pageIdentifier === 'finale') {
            const unlockInput = pageElement.querySelector('#finish-unlock-input'); 
            const unlockButton = pageElement.querySelector('#finish-unlock-btn');
            const unlockFeedback = pageElement.querySelector('#feedback-unlock-finish'); 
            const shouldBeDisabled = !(currentTeamData && currentTeamData.canEnterFinishCode) && !DEV_MODE_NO_GEOFENCE;
            if (unlockInput) { unlockInput.disabled = shouldBeDisabled; unlockInput.value = ''; } 
            if (unlockButton) unlockButton.disabled = shouldBeDisabled; 
            if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            return;
        }
        
        if (postNum) {
            const postData = CoreApp.getPostData(postNum);
            if (!postData) { logToMobile(`resetPageUI: Finner ikke postData for post ${postNum}`, "error"); return; }

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
            const isTeacherVerified = postData.type && postData.type.startsWith('manned_') && currentTeamData?.mannedPostTeacherVerified?.[`post${postNum}`];

            if(postInfoSection) postInfoSection.style.display = 'none';
            if(taskSection) taskSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(minigolfFormSection) minigolfFormSection.style.display = 'none';
            if(pyramidPointsSection) pyramidPointsSection.style.display = 'none';
            if(geoRunSetupSection) geoRunSetupSection.style.display = 'none';
            if(geoRunActiveSection) geoRunActiveSection.style.display = 'none';
            if(geoRunResultsSection) geoRunResultsSection.style.display = 'none';
            
            if (postData.type === 'manned_minigolf') { const minigolfProceedButton = pageElement.querySelector('#minigolf-proceed-btn-post1'); if (minigolfProceedButton) minigolfProceedButton.style.display = 'none'; }
            if (postData.type === 'georun') { const geoRunProceedButton = pageElement.querySelector(`#geo-run-proceed-btn-post${GEO_RUN_POST_ID}`); if (geoRunProceedButton) geoRunProceedButton.style.display = 'none'; }
            
            if (postData.type && postData.type.startsWith('manned_')) {
                const teacherPassInput = pageElement.querySelector('.teacher-password-input');
                if (teacherPassInput) { teacherPassInput.value = ''; teacherPassInput.disabled = false; }
                const teacherPassButton = pageElement.querySelector('.submit-teacher-password-btn');
                if (teacherPassButton) teacherPassButton.disabled = false;
                const teacherPassFeedback = pageElement.querySelector('.feedback-teacher-password');
                if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }
            }

            if (isTaskCompleted) { 
                if (postData.type === 'manned_minigolf' && minigolfFormSection) { 
                    minigolfFormSection.style.display = 'block'; 
                    minigolfFormSection.querySelectorAll('input, button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true); 
                    const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                    if(mgFeedback) { const sgP = currentTeamData?.minigolfScores?.[`post${postNum}`]?.pointsAwarded; const sgA = currentTeamData?.minigolfScores?.[`post${postNum}`]?.average; if (sgP!==undefined && sgA!==undefined) { mgFeedback.textContent = `Snitt: ${sgA.toFixed(2)}. Poeng: ${sgP}!`; } else { mgFeedback.textContent = "Minigolf fullført!"; } mgFeedback.className = "feedback success"; }
                    const btn = pageElement.querySelector('#minigolf-proceed-btn-post1'); if (btn) { btn.style.display = 'inline-block'; btn.disabled = false; }
                } else if (postData.type === 'manned_pyramid' && pyramidPointsSection) { 
                    pyramidPointsSection.style.display = 'block';
                    pyramidPointsSection.querySelectorAll('input, button').forEach(el => el.disabled = true); 
                     const ppFeedback = pageElement.querySelector('#pyramid-results-feedback');
                    if(ppFeedback) { const spP = currentTeamData?.pyramidPoints?.[`post${postNum}`]; if (spP !== undefined) { ppFeedback.textContent = `Poeng: ${spP}!`; } else { ppFeedback.textContent = "Pyramide fullført!"; } ppFeedback.className = "feedback success"; }
                } else if (postData.type === 'georun' && geoRunResultsSection) { 
                    geoRunResultsSection.style.display = 'block';
                    const timeDisplay = geoRunResultsSection.querySelector('.geo-run-total-time'); const pointsDisplay = geoRunResultsSection.querySelector('.geo-run-points-awarded');
                    const runState = currentTeamData.geoRunState[`post${postNum}`];
                    if(timeDisplay && runState?.totalTime !== null) timeDisplay.textContent = formatTimeFromMs(runState.totalTime);
                    if(pointsDisplay && runState?.pointsAwarded !== null) pointsDisplay.textContent = runState.pointsAwarded;
                    const geoRunProceedButton = pageElement.querySelector(`#geo-run-proceed-btn-post${GEO_RUN_POST_ID}`); if (geoRunProceedButton) { geoRunProceedButton.style.display = 'inline-block'; geoRunProceedButton.disabled = false; }
                }
                 else if (postData.type === 'standard' && taskSection) { 
                    taskSection.style.display = 'block';
                    taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const taskFeedback = taskSection.querySelector('.feedback-task'); if(taskFeedback) {taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success';}
                }
            } else if (isPostUnlocked) { 
                if (postData.type.startsWith('manned_')) {
                    if (isTeacherVerified) { 
                        if (postData.type === 'manned_minigolf' && minigolfFormSection) {
                            minigolfFormSection.style.display = 'block';
                            for (let i = 1; i <= (postData.maxPlayers || 6); i++) { const si = pageElement.querySelector(`#player-${i}-score-post${postNum}`); if (si) { si.value = ''; si.disabled = false;} }
                            const sgb = pageElement.querySelector(`#submit-minigolf-post${postNum}`); if(sgb) sgb.disabled = false;
                            const mgf = pageElement.querySelector('#minigolf-results-feedback'); if(mgf) { mgf.textContent = ""; mgf.className = "feedback";}
                            const mpb = pageElement.querySelector('#minigolf-proceed-btn-post1'); if (mpb) mpb.style.display = 'none';
                        } else if (postData.type === 'manned_pyramid' && pyramidPointsSection) {
                            pyramidPointsSection.style.display = 'block';
                            const pi = pageElement.querySelector(`#pyramid-points-input-post${postNum}`); if(pi) {pi.value = ''; pi.disabled = false;}
                            const spb = pageElement.querySelector(`#submit-pyramid-points-post${postNum}`); if(spb) spb.disabled = false;
                            const ppf = pageElement.querySelector('#pyramid-results-feedback'); if(ppf) { ppf.textContent = ""; ppf.className = "feedback";}
                        }
                    } else if (teacherPasswordSection) { teacherPasswordSection.style.display = 'block'; }
                } else if (postData.type === 'georun' && currentTeamData && currentTeamData.geoRunState) { 
                    const runState = currentTeamData.geoRunState[`post${postNum}`];
                    if (runState.active) {
                        if(geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                         const lapDisplay = geoRunActiveSection.querySelector('.geo-run-current-lap'); const nextPointDisplay = geoRunActiveSection.querySelector('.geo-run-next-target');
                         if(lapDisplay) lapDisplay.textContent = runState.lap; if(nextPointDisplay) nextPointDisplay.textContent = (runState.lap % 2 !== 0) ? (postData.geoRunPoint2.name || 'Vendepunkt 2') : (postData.geoRunPoint1.name || 'Start/Vendepunkt 1');
                    } else if (geoRunSetupSection) { 
                        geoRunSetupSection.style.display = 'block';
                        const countdownDisplay = geoRunSetupSection.querySelector('.geo-run-countdown'); const prePipInfo = geoRunSetupSection.querySelector('.geo-run-pre-pip-info');
                        const prePips = postData.preCountdownPips || GEO_RUN_PRE_COUNTDOWN_PIPS;
                        const prePipInterval = postData.preCountdownInterval || GEO_RUN_PRE_COUNTDOWN_INTERVAL_SECONDS;
                        if (runState.preRunPipTimerId || (runState.preCountdownPipsDone > 0 && runState.preCountdownPipsDone < prePips)) { 
                            if(prePipInfo) prePipInfo.textContent = `Vent på signal... Pip ${runState.preCountdownPipsDone +1} av ${prePips} om ca. ${prePipInterval} sek.`;
                            if(countdownDisplay) countdownDisplay.style.display = 'none'; 
                        } else if (runState.countdownTimerId == null && runState.preCountdownPipsDone >= prePips) { 
                             if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) { countdownDisplay.textContent = postData.countdownSeconds || GEO_RUN_COUNTDOWN_SECONDS; countdownDisplay.style.display = 'inline';}
                        } else if (runState.countdownTimerId != null) { if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) countdownDisplay.style.display = 'inline';
                        } else { if(prePipInfo) prePipInfo.textContent = ""; if(countdownDisplay) {countdownDisplay.textContent = postData.countdownSeconds || GEO_RUN_COUNTDOWN_SECONDS; countdownDisplay.style.display = 'inline';} }
                    } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
                }
                 else if (postData.type === 'standard' && taskSection) { 
                    taskSection.style.display = 'block';
                    const taskInput = taskSection.querySelector('.post-task-input'); const taskButton = taskSection.querySelector('.check-task-btn'); const taskFeedback = taskSection.querySelector('.feedback-task'); const attemptCounterElement = taskSection.querySelector('.attempt-counter');
                    if(taskInput) {taskInput.value = ''; taskInput.disabled = false;} if(taskButton) taskButton.disabled = false; if(taskFeedback) {taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task';}
                    const maxAttempts = postData.maxAttempts || MAX_ATTEMPTS_PER_TASK;
                    if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) { const attemptsLeft = maxAttempts - currentTeamData.taskAttempts[`post${postNum}`]; attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : maxAttempts }`; } 
                    else if (attemptCounterElement) { attemptCounterElement.textContent = `Forsøk igjen: ${maxAttempts}`; }
                }
            } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
        }
    }

    function resetAllPostUIs() { 
        if(postContentContainer) postContentContainer.innerHTML = '';
        const introTeamCodeInput = document.getElementById('team-code-input-dynamic'); 
        const introStartButton = document.getElementById('start-with-team-code-button-dynamic');
        const introFeedback = document.getElementById('team-code-feedback-dynamic');
        if(introTeamCodeInput) { introTeamCodeInput.value = ''; introTeamCodeInput.disabled = false; }
        if(introStartButton) introStartButton.disabled = false;
        if(introFeedback) { introFeedback.textContent = ''; introFeedback.className = 'feedback';}
    }
    
    function initializeTeam(teamCode) {
        const dynamicTeamCodeInput = postContentContainer.querySelector('#team-code-input-dynamic'); 
        const dynamicStartButton = postContentContainer.querySelector('#start-with-team-code-button-dynamic');
        const dynamicTeamCodeFeedback = postContentContainer.querySelector('#team-code-feedback-dynamic');

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
                mannedPostTeacherVerified: { }, 
                minigolfScores: { }, 
                pyramidPoints: {},
                arrivalSoundPlayed: {}, 
                geoRunState: {} 
            };
            
            Object.keys(CoreApp.registeredPostsData).forEach(postIdKey => {
                const postIdNum = parseInt(postIdKey);
                const postData = CoreApp.getPostData(postIdNum);
                if (postData) {
                    currentTeamData.arrivalSoundPlayed[`post${postIdNum}`] = false;
                    currentTeamData.taskAttempts[`post${postIdNum}`] = 0;
                    if (postData.type === 'manned_minigolf' || postData.type === 'manned_pyramid') {
                        currentTeamData.mannedPostTeacherVerified[`post${postIdNum}`] = false;
                    }
                    if (postData.type === 'manned_minigolf') currentTeamData.minigolfScores[`post${postIdNum}`] = {};
                    if (postData.type === 'manned_pyramid') currentTeamData.pyramidPoints[`post${postIdNum}`] = null;
                    if (postData.type === 'georun') {
                         currentTeamData.geoRunState[`post${postIdNum}`] = { 
                            active: false, lap: 0, startTime: null, lapStartTime: null, 
                            atPoint1: false, atPoint2: false, countdownTimerId: null, 
                            finished: false, totalTime: null, pointsAwarded: null,
                            preCountdownPipsDone: 0, preRunPipTimerId: null 
                        };
                    }
                }
            });
            currentTeamData.arrivalSoundPlayed.finish = false;
            
            saveState(); 
            if (dynamicTeamCodeInput) dynamicTeamCodeInput.disabled = true; 
            if (dynamicStartButton) dynamicStartButton.disabled = true;

            clearFinishMarker(); updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            logToMobile(`Team ${currentTeamData.name} starter. Første post: ${firstPostInSequence}`, "info");
            showRebusPage(`post-${firstPostInSequence}`); 
            
            if (map) updateMapMarker(firstPostInSequence, false);
            startContinuousUserPositionUpdate(); 
        } else {
            if (dynamicStartButton) dynamicStartButton.disabled = false;
            if(dynamicTeamCodeFeedback) { dynamicTeamCodeFeedback.textContent = 'Ugyldig lagkode! (Eks: LAG1)'; dynamicTeamCodeFeedback.classList.add('error', 'shake'); }
            if (dynamicTeamCodeInput) { dynamicTeamCodeInput.classList.add('shake'); setTimeout(() => { if(dynamicTeamCodeFeedback) dynamicTeamCodeFeedback.classList.remove('shake'); if(dynamicTeamCodeInput) dynamicTeamCodeInput.classList.remove('shake'); }, 400); dynamicTeamCodeInput.focus(); dynamicTeamCodeInput.select(); }
            logToMobile(`Ugyldig lagkode: ${teamCode}`, "warn");
        }
    }

    function handleTeacherPassword(postNum, password) { /* ... (som i v38) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (som i v38) ... */ }
    function handlePyramidPointsSubmit(postNum, points) { /* ... (som i v38) ... */ }
    function startGeoRunPreCountdownPips() { /* ... (som i v38) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId) { /* ... (som i v38) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (som i v38) ... */ }
    
    window.proceedToNextPostOrFinishGlobal = function() { /* ... (som i v38) ... */ }
    function updateUIAfterLoad() { /* ... (som i v38) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (som i v38) ... */ }

    // === EVENT LISTENERS ===
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; const postData = CoreApp.getPostData(currentPostGlobalId); if(postData) targetLocation = {lat: postData.lat, lng: postData.lng}; } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
    
    const globalDevResetButtons = document.querySelectorAll('.container > .dev-reset-button'); 
    globalDevResetButtons.forEach(button => { button.addEventListener('click', () => { if (confirm("Nullstille rebusen (global)?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); } }); });
    
    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { toggleLogBtn.addEventListener('click', () => { mobileLogContainer.style.display = mobileLogContainer.style.display === 'none' ? 'block' : 'none'; }); }
    if (clearLogBtn && mobileLogContainer) { clearLogBtn.addEventListener('click', () => { mobileLogContainer.innerHTML = ''; }); }

    if (postContentContainer) {
        postContentContainer.addEventListener('click', (event) => {
            const target = event.target;
            logToMobile(`Klikk i postContentContainer. Target ID: ${target.id}, Class: ${target.className}`, "debug");

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
                const postData = CoreApp.getPostData(1);
                if(postData && postData.type === 'manned_minigolf' && typeof postData.handleSubmit === 'function') {
                     postData.handleSubmit(postContentContainer.firstChild, currentTeamData); 
                } else {
                    handleMinigolfSubmit(1); 
                }
            }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { logToMobile("Minigolf proceed button clicked.", "debug"); window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) { 
                const postData = CoreApp.getPostData(8);
                const pointsInput = postContentContainer.querySelector('#pyramid-points-input-post8'); 
                if(pointsInput) {
                    if (postData && postData.type === 'manned_pyramid' && typeof postData.handleSubmit === 'function') {
                        postData.handleSubmit(postContentContainer.firstChild, currentTeamData, pointsInput.value.trim());
                    } else {
                        handlePyramidPointsSubmit(8, pointsInput.value.trim());
                    }
                }
            }
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { logToMobile("Geo-run proceed button clicked.", "debug"); window.proceedToNextPostOrFinishGlobal(); }
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
                    if (associatedButton && !associatedButton.disabled && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(target.value.trim().toUpperCase()); }
                }
            }
        });
    }
    
    document.addEventListener('postReached', function(event) { if (event.detail && event.detail.pageId) { logToMobile(`Custom event 'postReached' for pageId: ${event.detail.pageId}. Calling resetPageUI.`, "debug"); resetPageUI(event.detail.pageId); } });
    document.addEventListener('geoRunLogicTrigger', function(event) { if (event.detail) { logToMobile(`Custom event 'geoRunLogicTrigger' for target: ${event.detail.targetPointId}`, "debug"); handleGeoRunLogic(event.detail.isAtTargetPoint, event.detail.targetPointId); }});
    document.addEventListener('startGeoRunPrePipsTrigger', function() { logToMobile("Custom event 'startGeoRunPrePipsTrigger' mottatt.", "debug"); startGeoRunPreCountdownPips(); });
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
            script.onload = () => { logToMobile(`${scriptPath} lastet og kjørt.`, "debug"); resolve(true); }; 
            script.onerror = () => { logToMobile(`FEIL ved lasting av ${scriptPath}.`, "error"); resolve(false); }; 
            document.head.appendChild(script);
        });
    }))
    .then((results) => {
        const successfullyLoaded = results.filter(res => res).length;
        logToMobile(`${successfullyLoaded} av ${postScriptsToLoad.length} post-spesifikke scripts lastet OK. Initialiserer app-tilstand...`, "info");
        
        CoreApp.setReady(); // VIKTIG: Signaliser at CoreApp er klar ETTER at post-scripts er forsøkt lastet

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
/* Version: #38 */
