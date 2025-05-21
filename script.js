/* Version: #31 */

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

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10;
const GEOFENCE_RADIUS = 25; 
const DEV_MODE_NO_GEOFENCE = true; 
const FINISH_UNLOCK_CODE = "FASTLAND24"; 

const MANNED_POST_PASSWORDS = { post1: "GOLFMESTER", post8: "PYRAMIDEBYGGER" };
const MAX_PLAYERS_PER_TEAM = 6; 

const GEO_RUN_POST_ID = 7;
const GEO_RUN_LAPS = 5; 
const GEO_RUN_COUNTDOWN_SECONDS = 10;
const GEO_RUN_POINT1 = { lat: 60.8006280021653, lng: 10.683461472668988, name: "Start/Vendepunkt 1 (Geo-løp)" };
const GEO_RUN_POINT2 = { lat: 60.79971947637134, lng: 10.683614899042398, name: "Vendepunkt 2 (Geo-løp)" };
const GEO_RUN_POINTS_SCALE = {
    60: 10, 75: 9, 90: 8, 105: 7, 120: 6, 150: 5, 180: 4, 210: 3, 240: 2, Infinity: 1 
};

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

// === Globale State Management Funksjoner ===
function saveState() { if (currentTeamData) { localStorage.setItem('activeTeamData_Skolerebus', JSON.stringify(currentTeamData)); console.log("DEBUG_V31: State saved."); } else { localStorage.removeItem('activeTeamData_Skolerebus'); console.log("DEBUG_V31: State cleared (no team data)."); } }

// === LYDFUNKSJONER ===
function initializeSounds() {
    try {
        // Bruker de nye filstiene
        generalArrivalAudio = new Audio('audio/arrival_medium_pip.wav'); 
        shortPipAudio = new Audio('audio/short_high_pip.wav');
        longPipAudio = new Audio('audio/long_high_pip.wav');

        console.log("Lydobjekter initialisert med faktiske filer.");
        // Preload for å forbedre responsivitet ved første avspilling
        if(generalArrivalAudio) generalArrivalAudio.load();
        if(shortPipAudio) shortPipAudio.load();
        if(longPipAudio) longPipAudio.load();

    } catch (e) {
        console.warn("Kunne ikke initialisere Audio objekter:", e);
        generalArrivalAudio = null; shortPipAudio = null; longPipAudio = null;
    }
}

function playSound(audioObject) {
    if (audioObject && typeof audioObject.play === 'function') {
        audioObject.currentTime = 0; 
        audioObject.play().catch(e => console.warn("Feil ved avspilling av lyd:", e, audioObject.src ? audioObject.src : 'Ukjent lydkilde'));
    } else {
        console.log("Fallback: Lydobjekt ikke gyldig for avspilling.");
    }
}

function playArrivalSound() {
    console.log("AUDIO: Spiller ankomstlyd...");
    playSound(generalArrivalAudio);
}

async function playGeoRunStartSoundSequence() {
    console.log("AUDIO: Starter Geo-løp lydsekvens...");
    if (shortPipAudio && longPipAudio) {
        try {
            await playSoundPromise(shortPipAudio); await delay(150); 
            await playSoundPromise(shortPipAudio); await delay(150);
            await playSoundPromise(shortPipAudio); await delay(150);
            await playSoundPromise(longPipAudio);
            console.log("AUDIO: Geo-løp lydsekvens fullført.");
        } catch (e) {
            console.warn("Feil i lydsekvens:", e);
        }
    } else {
        console.log("Fallback: Pip, Pip, Pip, PIIIIIP (Geo-løp start)!");
    }
}

function playGeoRunTurnSound() {
    console.log("AUDIO: Spiller Geo-løp vendelyd...");
    playSound(longPipAudio);
}

function playSoundPromise(audioObject) {
    return new Promise((resolve, reject) => {
        if (audioObject && typeof audioObject.play === 'function') {
            audioObject.currentTime = 0;
            const playPromise = audioObject.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    // Noen nettlesere krever at onended settes etter at play() er kalt
                    // og har returnert et promise som løses.
                    audioObject.onended = resolve;
                }).catch(error => {
                    console.warn("Avspillingsfeil (Promise):", error, audioObject.src);
                    reject(error); // Avvis promise ved feil
                });
            } else { // Fallback for eldre nettlesere som ikke returnerer promise fra play()
                 audioObject.onended = resolve;
                 audioObject.onerror = reject; // Legg til onerror her også
            }
        } else {
            console.log("Fallback: Lydobjekt ikke gyldig for promise-avspilling.");
            resolve(); 
        }
    });
}
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { mapElement = document.getElementById('dynamic-map-container'); if (!mapElement) { setTimeout(window.initMap, 500); return; } geofenceFeedbackElement = document.getElementById('geofence-feedback'); const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ]; map = new google.maps.Map(mapElement, { center: START_LOCATION, zoom: 15, mapTypeId: google.maps.MapTypeId.HYBRID, styles: mapStyles, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true, mapTypeControlOptions: { style: google.maps.MapTypeControlStyle.DROPDOWN_MENU, mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID] } }); if (currentTeamData) { if (currentTeamData.completedPostsCount >= TOTAL_POSTS && !currentTeamData.endTime) { updateMapMarker(null, true); } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; updateMapMarker(currentPostGlobalId, false); } else { updateMapMarker(null, true); } startContinuousUserPositionUpdate(); } console.log("Skolerebus Kart initialisert"); }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false, customLocation = null) { if (!map) { console.warn("Kart ikke initialisert for updateMapMarker."); return; } clearMapMarker(); if (!customLocation) clearFinishMarker(); let locationDetails, markerTitle, markerIconUrl; if (customLocation) { locationDetails = customLocation; markerTitle = customLocation.name || "Geo-løp Punkt"; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png'; } else if (isFinalTarget) { locationDetails = FINISH_LOCATION; markerTitle = FINISH_LOCATION.title; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'; if (finishMarker) finishMarker.setMap(null); finishMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < 16) map.setZoom(16); } return; } else { if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) { console.warn("Ugyldig postGlobalId for updateMapMarker:", postGlobalId); return; } locationDetails = POST_LOCATIONS[postGlobalId - 1]; markerTitle = `Neste: ${locationDetails.name || locationDetails.title}`; markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'; } currentMapMarker = new google.maps.Marker({ position: { lat: locationDetails.lat, lng: locationDetails.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } }); if(locationDetails) { map.panTo({ lat: locationDetails.lat, lng: locationDetails.lng }); if (map.getZoom() < (customLocation ? 18 : 15) ) map.setZoom((customLocation ? 18 : 15)); } }
function clearMapMarker() { if (currentMapMarker) { currentMapMarker.setMap(null); currentMapMarker = null; } }
function clearFinishMarker() { if (finishMarker) { finishMarker.setMap(null); finishMarker = null; } }
function handleGeolocationError(error) { let msg = "Posisjonsfeil: "; switch (error.code) { case error.PERMISSION_DENIED: msg += "Du må tillate posisjonstilgang."; break; case error.POSITION_UNAVAILABLE: msg += "Posisjonen din er utilgjengelig."; break; case error.TIMEOUT: msg += "Tok for lang tid å hente posisjonen."; break; default: msg += "Ukjent GPS-feil."; } console.warn(msg); if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = msg; geofenceFeedbackElement.className = 'geofence-error permanent'; geofenceFeedbackElement.style.display = 'block'; } }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
function updateUserPositionOnMap(position) { if (!map) return; const userPos = { lat: position.coords.latitude, lng: position.coords.longitude }; if (userPositionMarker) { userPositionMarker.setPosition(userPos); } else { userPositionMarker = new google.maps.Marker({ position: userPos, map: map, title: "Din Posisjon", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } }); } }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) { if (!geofenceFeedbackElement) return; if (isFullyCompleted || (!currentTeamData)) { geofenceFeedbackElement.style.display = 'none'; return; } geofenceFeedbackElement.style.display = 'block'; geofenceFeedbackElement.classList.remove('permanent'); if (DEV_MODE_NO_GEOFENCE) { geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`; geofenceFeedbackElement.className = 'geofence-info dev-mode'; return; } if (distance === null) { geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`; geofenceFeedbackElement.className = 'geofence-info'; return; } const distanceFormatted = Math.round(distance); if (isEffectivelyWithinRange) { if (canInteractWithTarget) { geofenceFeedbackElement.textContent = targetName.toLowerCase().includes("mål") ? `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Tast inn målkoden!` : `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Lærer må taste passord eller oppgaven vises.`; } else { geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`; } geofenceFeedbackElement.className = 'geofence-success'; } else { geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`; geofenceFeedbackElement.className = 'geofence-error'; } }

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);
    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) { updateGeofenceFeedback(null, false, true, null, false); return; }
    let targetLocationDetails = null; let isCurrentTargetTheFinishLine = false; let isGeoRunActiveForCurrentPost = false;
    const currentGlobalIdOriginal = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];

    if (currentGlobalIdOriginal === GEO_RUN_POST_ID && currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]) {
        const runState = currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]; isGeoRunActiveForCurrentPost = true;
        if (!runState.active && !runState.finished) { targetLocationDetails = { location: GEO_RUN_POINT1, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunStart`, name: GEO_RUN_POINT1.name }; }
        else if (runState.active && !runState.finished) { if (runState.lap % 2 !== 0) { targetLocationDetails = { location: GEO_RUN_POINT2, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunPoint2`, name: GEO_RUN_POINT2.name }; } else { targetLocationDetails = { location: GEO_RUN_POINT1, pageId: `post-${GEO_RUN_POST_ID}-page`, globalId: `geoRunPoint1`, name: GEO_RUN_POINT1.name }; } }
    }
    if (!isGeoRunActiveForCurrentPost || (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) {
        if (currentTeamData.completedPostsCount >= TOTAL_POSTS) { targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale-page', globalId: 'finish', name: FINISH_LOCATION.name }; isCurrentTargetTheFinishLine = true; }
        else { const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; if (currentGlobalId && POST_LOCATIONS[currentGlobalId - 1]) { const postData = POST_LOCATIONS[currentGlobalId - 1]; targetLocationDetails = { location: postData, pageId: `post-${currentGlobalId}-page`, globalId: currentGlobalId, name: postData.name || `Post ${currentGlobalId}` }; } }
    }
    if (!targetLocationDetails) { updateGeofenceFeedback(null, false, false, null, false); return; }
    const userLat = position.coords.latitude; const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS; const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange; 
    let canCurrentlyInteract = false; 
    if (isCurrentTargetTheFinishLine) {
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange; 
        const finishUnlockInput = document.getElementById('finish-unlock-input'); const finishUnlockButton = document.getElementById('finish-unlock-btn');
        if(finishUnlockInput) finishUnlockInput.disabled = !isEffectivelyWithinRange; if(finishUnlockButton) finishUnlockButton.disabled = !isEffectivelyWithinRange;
        if (isEffectivelyWithinRange && !currentTeamData.arrivalSoundPlayed.finish) { playArrivalSound(); currentTeamData.arrivalSoundPlayed.finish = true; saveState(); } 
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else if (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].finished) {
        handleGeoRunLogic(isEffectivelyWithinRange, targetLocationDetails.globalId); 
    } else { 
        const postGlobalId = targetLocationDetails.globalId; const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];
        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            console.log(`DEBUG_V31: Post ${postGlobalId} reached. Unlocking.`); currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            if (!currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`]) { playArrivalSound(); currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`] = true; } 
            saveState(); document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
            canCurrentlyInteract = true; 
        } else if (isPostAlreadyUnlocked) { if (postGlobalId === 1 || postGlobalId === 8) { canCurrentlyInteract = !currentTeamData.mannedPostTeacherVerified[`post${postGlobalId}`]; } else { canCurrentlyInteract = false; } }
    }
    if (!isGeoRunActiveForCurrentPost || (currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) { updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract); }
}

function startContinuousUserPositionUpdate() { if (!navigator.geolocation) { console.warn("Geolocation ikke støttet."); return; } if (mapPositionWatchId !== null) return; console.log("Starter kontinuerlig GPS posisjonssporing."); mapPositionWatchId = navigator.geolocation.watchPosition( handlePositionUpdate, (error) => { handleGeolocationError(error); if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) {} }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }); }
function stopContinuousUserPositionUpdate() { if (mapPositionWatchId !== null) { navigator.geolocation.clearWatch(mapPositionWatchId); mapPositionWatchId = null; console.log("Stoppet kontinuerlig GPS sporing."); updateGeofenceFeedback(null, false, true, null, false); } }


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG_V31: DOMContentLoaded event fired.");
    initializeSounds(); 
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    const teamCodeFeedback = document.getElementById('team-code-feedback');
    let pages = document.querySelectorAll('#rebus-content .page'); 
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    const rebusContentElement = document.getElementById('rebus-content'); 

    if (!rebusContentElement) console.error("DEBUG_V31: rebusContentElement is NULL!");

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
        const titleElement = pageElement.querySelector('.post-title-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder'); 
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder'); 
        const postInfoElement = pageElement.querySelector('.post-info-placeholder'); 
        const mannedPostTitleElement = pageElement.querySelector('.manned-post-title-placeholder'); 
        const mannedPostInstructionElement = pageElement.querySelector('.manned-post-instruction-placeholder');

        if (globalPostId === null || globalPostId === undefined || globalPostId === 'finish') return;
        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) titleElement.textContent = `Post ${teamPostNumber}/${TOTAL_POSTS}: ${postName}`;
        if (postInfoElement) postInfoElement.textContent = `Bruk kartet for å finne ${postName}.`;

        if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
        if (taskQuestionElement) {
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

    function displayFinalResults() {
        console.log("DEBUG_V31: Displaying final results.");
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
            
            const firstPostInSequence = currentTeamData.postSequence[0];
            const firstPostName = POST_LOCATIONS[firstPostInSequence-1].name;
            if (currentTeamData.taskCompletionTimes['post' + firstPostInSequence]) {
                const timeToFirstPost = currentTeamData.taskCompletionTimes['post' + firstPostInSequence] - lastTimestamp;
                const li = document.createElement('li');
                li.textContent = `Start til ${firstPostName}: ${formatTimeFromMs(timeToFirstPost)}`;
                stageTimesList.appendChild(li);
                lastTimestamp = currentTeamData.taskCompletionTimes['post' + firstPostInSequence];
            } else {
                 const li = document.createElement('li');
                 li.textContent = `Start til ${firstPostName}: Ikke fullført`;
                 stageTimesList.appendChild(li);
            }

            for (let i = 1; i < currentTeamData.postSequence.length; i++) {
                const prevPostGlobalId = currentTeamData.postSequence[i-1];
                const currentPostGlobalId = currentTeamData.postSequence[i];
                const prevPostName = POST_LOCATIONS[prevPostGlobalId-1].name;
                const currentPostName = POST_LOCATIONS[currentPostGlobalId-1].name;

                if (currentTeamData.taskCompletionTimes['post' + currentPostGlobalId] && currentTeamData.taskCompletionTimes['post' + prevPostGlobalId]) {
                    const stageTime = currentTeamData.taskCompletionTimes['post' + currentPostGlobalId] - currentTeamData.taskCompletionTimes['post' + prevPostGlobalId];
                    const li = document.createElement('li');
                    li.textContent = `${prevPostName} til ${currentPostName}: ${formatTimeFromMs(stageTime)}`;
                    stageTimesList.appendChild(li);
                    lastTimestamp = currentTeamData.taskCompletionTimes['post' + currentPostGlobalId];
                } else if (currentTeamData.taskCompletionTimes['post' + prevPostGlobalId]) {
                    const li = document.createElement('li');
                    li.textContent = `${prevPostName} til ${currentPostName}: Ikke fullført`;
                    stageTimesList.appendChild(li);
                    break; 
                }
            }

            if (currentTeamData.endTime && currentTeamData.completedPostsCount === TOTAL_POSTS) {
                const lastCompletedPostInSequence = currentTeamData.postSequence[TOTAL_POSTS -1]; 
                const lastPostName = POST_LOCATIONS[lastCompletedPostInSequence-1].name;
                 if (currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence]) { 
                    const timeToFinish = currentTeamData.endTime - currentTeamData.taskCompletionTimes['post' + lastCompletedPostInSequence];
                    const li = document.createElement('li');
                    li.textContent = `${lastPostName} til Mål: ${formatTimeFromMs(timeToFinish)}`;
                    stageTimesList.appendChild(li);
                }
            }
        }
    }

    function showRebusPage(pageId) {
        console.log(`DEBUG_V31: --- showRebusPage CALLED with pageId: '${pageId}' ---`);
        pages = document.querySelectorAll('#rebus-content .page');
        if (!pages || pages.length === 0) { console.error("DEBUG_V31: CRITICAL - 'pages' NodeList is EMPTY!"); return; }

        pages.forEach((page) => {
            if (page.id === pageId) { page.classList.add('visible'); } 
            else { page.classList.remove('visible'); }
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (pageId === 'intro-page') { 
            const teamCodeInputForIntro = document.getElementById('team-code-input');
            const startButtonForIntro = document.getElementById('start-with-team-code-button');
            if (teamCodeInputForIntro) teamCodeInputForIntro.disabled = false;
            if (startButtonForIntro) startButtonForIntro.disabled = false;
        }
        
        if (currentTeamData && pageId.startsWith('post-') && pageId !== 'finale-page') {
            const globalPostNumMatch = pageId.match(/post-(\d+)-page/);
            if (globalPostNumMatch && globalPostNumMatch[1]) {
                const globalPostNum = parseInt(globalPostNumMatch[1]);
                const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                updatePageText(document.getElementById(pageId), teamPostNum, globalPostNum);
                
                if (globalPostNum === GEO_RUN_POST_ID && currentTeamData.geoRunState && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].active && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].finished) {
                    updateMapMarker(null, false, GEO_RUN_POINT1);
                }
            }
        }
        resetPageUI(pageId); 
        
        if (currentTeamData && pageId !== 'intro-page') { updateScoreDisplay(); } 
        else if (document.getElementById('score-display')) { document.getElementById('score-display').style.display = 'none'; }
        
        if (pageId === 'finale-page') {
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
                if (pageId === 'finale-page' && !currentTeamData) { clearState(); showRebusPage('intro-page'); return; }
            }
        }
        console.log(`DEBUG_V31: --- showRebusPage COMPLETED for pageId: '${pageId}' ---`);
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
                    currentTeamData.postSequence.length !== TOTAL_POSTS ||
                    typeof currentTeamData.startTime === 'undefined' ||
                    typeof currentTeamData.taskCompletionTimes === 'undefined' || 
                    typeof currentTeamData.canEnterFinishCode === 'undefined' ||
                    typeof currentTeamData.mannedPostTeacherVerified === 'undefined' || 
                    (currentTeamData.mannedPostTeacherVerified && (typeof currentTeamData.mannedPostTeacherVerified.post1 === 'undefined' || typeof currentTeamData.mannedPostTeacherVerified.post8 === 'undefined')) ||
                    typeof currentTeamData.arrivalSoundPlayed === 'undefined' || 
                    typeof currentTeamData.geoRunState === 'undefined' 
                ) { clearState(); return false; } 
                if (typeof currentTeamData.startTime === 'string') currentTeamData.startTime = parseInt(currentTeamData.startTime,10);
                if (currentTeamData.startTime && isNaN(currentTeamData.startTime)) currentTeamData.startTime = null; 
                
                if (!currentTeamData.minigolfScores) currentTeamData.minigolfScores = { post1: {} };
                if (!currentTeamData.pyramidPoints) currentTeamData.pyramidPoints = {};
                if (!currentTeamData.arrivalSoundPlayed) { 
                    currentTeamData.arrivalSoundPlayed = {};
                    POST_LOCATIONS.forEach((_,i) => currentTeamData.arrivalSoundPlayed[`post${i+1}`] = false);
                    currentTeamData.arrivalSoundPlayed.finish = false;
                }
                if (!currentTeamData.geoRunState) { 
                     currentTeamData.geoRunState = {};
                     currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] = { active: false, lap: 0, startTime: null, lapStartTime: null, atPoint1: false, atPoint2: false, countdownTimerId: null, finished: false, totalTime: null, pointsAwarded: null };
                }
                return true;
            } catch (e) { console.warn("Feil ved parsing av lagret data:", e); clearState(); return false; }
        }
        currentTeamData = null; return false;
    }

    function clearState() { 
        localStorage.removeItem('activeTeamData_Skolerebus'); currentTeamData = null;
        resetAllPostUIs(); 
        clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); 
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        if (geofenceFeedbackElement) { geofenceFeedbackElement.style.display = 'none'; geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = ''; }
        console.log("DEBUG_V31: State cleared by clearState().");
    }

    function resetPageUI(pageId) {
        const pageElement = document.getElementById(pageId);
        if (!pageElement) return;
        if (pageId === 'intro-page') { 
            const teamCodeInputForIntroReset = document.getElementById('team-code-input');
            const startButtonForIntroReset = document.getElementById('start-with-team-code-button');
            if(teamCodeInputForIntroReset) teamCodeInputForIntroReset.disabled = false;
            if(startButtonForIntroReset) startButtonForIntroReset.disabled = false;
            return;
        }

        if (pageId === 'finale-page') {
            const unlockInput = document.getElementById('finish-unlock-input');
            const unlockButton = document.getElementById('finish-unlock-btn');
            const unlockFeedback = document.getElementById('feedback-unlock-finish'); 

            const shouldBeDisabled = !(currentTeamData && currentTeamData.canEnterFinishCode) && !DEV_MODE_NO_GEOFENCE;
            if (unlockInput) { unlockInput.disabled = shouldBeDisabled; unlockInput.value = ''; } 
            if (unlockButton) unlockButton.disabled = shouldBeDisabled; 
            if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            return;
        }

        const postNumberMatch = pageId.match(/post-(\d+)-page/);
        if (!postNumberMatch) return;
        const postNum = parseInt(postNumberMatch[1]); 

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
        
        if (postNum === 1) {
            const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1');
            if (minigolfProceedButton) minigolfProceedButton.style.display = 'none';
        }
        if (postNum === GEO_RUN_POST_ID) {
            const geoRunProceedButton = document.getElementById(`geo-run-proceed-btn-post${GEO_RUN_POST_ID}`);
            if (geoRunProceedButton) geoRunProceedButton.style.display = 'none';
        }
        
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
                    if(mgFeedback) { 
                        const savedGolfPoints = currentTeamData?.minigolfScores?.post1?.pointsAwarded;
                        const savedGolfAverage = currentTeamData?.minigolfScores?.post1?.average;
                        if (savedGolfPoints !== undefined && savedGolfAverage !== undefined) {
                            mgFeedback.textContent = `Snitt: ${savedGolfAverage.toFixed(2)}. Poeng: ${savedGolfPoints}!`;
                        } else {
                            mgFeedback.textContent = "Minigolf fullført! Poeng registrert.";
                        }
                        mgFeedback.className = "feedback success";
                    }
                    const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1'); 
                    if (minigolfProceedButton) {
                        minigolfProceedButton.style.display = 'inline-block';
                        minigolfProceedButton.disabled = false;
                    }
                } else if (postNum === 8 && pyramidPointsSection) { 
                    pyramidPointsSection.style.display = 'block';
                    pyramidPointsSection.querySelectorAll('input, button').forEach(el => el.disabled = true); 
                     const ppFeedback = document.getElementById('pyramid-results-feedback');
                    if(ppFeedback) { 
                        const savedPyramidPoints = currentTeamData?.pyramidPoints?.post8;
                        if (savedPyramidPoints !== undefined) {
                            ppFeedback.textContent = `Poeng registrert: ${savedPyramidPoints}!`;
                        } else {
                             ppFeedback.textContent = "Pyramidepoeng registrert!";
                        }
                        ppFeedback.className = "feedback success";
                    }
                }
            } else if (postNum === GEO_RUN_POST_ID && geoRunResultsSection) { 
                geoRunResultsSection.style.display = 'block';
                const timeDisplay = geoRunResultsSection.querySelector('.geo-run-total-time');
                const pointsDisplay = geoRunResultsSection.querySelector('.geo-run-points-awarded');
                const runState = currentTeamData.geoRunState[`post${postNum}`];
                if(timeDisplay && runState?.totalTime !== null) timeDisplay.textContent = formatTimeFromMs(runState.totalTime);
                if(pointsDisplay && runState?.pointsAwarded !== null) pointsDisplay.textContent = runState.pointsAwarded;
                const geoRunProceedButton = document.getElementById(`geo-run-proceed-btn-post${GEO_RUN_POST_ID}`);
                if (geoRunProceedButton) {
                    geoRunProceedButton.style.display = 'inline-block';
                    geoRunProceedButton.disabled = false;
                }
            }
             else if (taskSection) { 
                taskSection.style.display = 'block';
                taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                const taskFeedback = taskSection.querySelector('.feedback-task');
                if(taskFeedback) {taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success';}
            }
        } else if (isPostUnlocked) { 
            if (isMannedPost) {
                if (isTeacherVerified) { 
                    if (postNum === 1 && minigolfFormSection) {
                        minigolfFormSection.style.display = 'block';
                        for (let i = 1; i <= MAX_PLAYERS_PER_TEAM; i++) {
                            const scoreInput = document.getElementById(`player-${i}-score-post1`);
                            if (scoreInput) { scoreInput.value = ''; scoreInput.disabled = false;}
                        }
                        const submitGolfBtn = document.getElementById('submit-minigolf-post1');
                        if(submitGolfBtn) submitGolfBtn.disabled = false;
                        const mgFeedback = document.getElementById('minigolf-results-feedback');
                        if(mgFeedback) { mgFeedback.textContent = ""; mgFeedback.className = "feedback";}
                        const minigolfProceedButton = document.getElementById('minigolf-proceed-btn-post1'); 
                        if (minigolfProceedButton) minigolfProceedButton.style.display = 'none';
                    } else if (postNum === 8 && pyramidPointsSection) {
                        pyramidPointsSection.style.display = 'block';
                        const pointsInput = document.getElementById('pyramid-points-input-post8');
                        if(pointsInput) {pointsInput.value = ''; pointsInput.disabled = false;}
                        const submitPyramidBtn = document.getElementById('submit-pyramid-points-post8');
                        if(submitPyramidBtn) submitPyramidBtn.disabled = false;
                        const ppFeedback = document.getElementById('pyramid-results-feedback');
                        if(ppFeedback) { ppFeedback.textContent = ""; ppFeedback.className = "feedback";}
                    }
                } else if (teacherPasswordSection) { 
                    teacherPasswordSection.style.display = 'block';
                }
            } else if (postNum === GEO_RUN_POST_ID && currentTeamData && currentTeamData.geoRunState) { 
                const runState = currentTeamData.geoRunState[`post${postNum}`];
                if (runState.active) {
                    if(geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                     const lapDisplay = geoRunActiveSection.querySelector('.geo-run-current-lap');
                     const nextPointDisplay = geoRunActiveSection.querySelector('.geo-run-next-target');
                     if(lapDisplay) lapDisplay.textContent = runState.lap;
                     if(nextPointDisplay) nextPointDisplay.textContent = (runState.lap % 2 !== 0) ? GEO_RUN_POINT2.name : GEO_RUN_POINT1.name;
                } else if (geoRunSetupSection) { 
                    geoRunSetupSection.style.display = 'block';
                    const countdownDisplay = geoRunSetupSection.querySelector('.geo-run-countdown');
                    if(countdownDisplay && runState.countdownTimerId == null) countdownDisplay.textContent = GEO_RUN_COUNTDOWN_SECONDS; 
                } else if (postInfoSection) { 
                     postInfoSection.style.display = 'block';
                }
            }
             else if (taskSection) { 
                taskSection.style.display = 'block';
                const taskInput = taskSection.querySelector('.post-task-input');
                const taskButton = taskSection.querySelector('.check-task-btn');
                const taskFeedback = taskSection.querySelector('.feedback-task');
                const attemptCounterElement = taskSection.querySelector('.attempt-counter');
                if(taskInput) {taskInput.value = ''; taskInput.disabled = false;}
                if(taskButton) taskButton.disabled = false;
                if(taskFeedback) {taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task';}
                if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`;
                } else if (attemptCounterElement) { attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`; }
            }
        } else if (postInfoSection) { 
            postInfoSection.style.display = 'block';
        }
     }
    function resetAllPostUIs() { 
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const pageElement = document.getElementById(`post-${i}-page`);
            if (!pageElement) continue;
            resetPageUI(`post-${i}-page`); 
            const titlePlaceholder = pageElement.querySelector('.post-title-placeholder');
            if(titlePlaceholder) titlePlaceholder.textContent = `Post ${i}: Tittel`;
            const postInfoPlaceholder = pageElement.querySelector('.post-info-placeholder');
            if(postInfoPlaceholder) postInfoPlaceholder.textContent = "Gå til posten for å se oppgaven.";
            const taskTitlePlaceholder = pageElement.querySelector('.post-task-title-placeholder');
            if(taskTitlePlaceholder) taskTitlePlaceholder.textContent = `Oppgave ${i}`;
            const taskQuestionPlaceholder = pageElement.querySelector('.post-task-question-placeholder');
            if(taskQuestionPlaceholder) taskQuestionPlaceholder.textContent = `Spørsmål for post ${i}.`;
        }
        resetPageUI('finale-page');
        if(teamCodeInput) { teamCodeInput.value = ''; teamCodeInput.disabled = false; }
        if(startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }
    
    function initializeTeam(teamCode) {
        if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = true;
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
            currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] = { active: false, lap: 0, startTime: null, lapStartTime: null, atPoint1: false, atPoint2: false, countdownTimerId: null, finished: false, totalTime: null, pointsAwarded: null };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            
            saveState(); resetAllPostUIs(); 
            if (teamCodeInput) teamCodeInput.disabled = true;
            clearFinishMarker(); updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}-page`); 
            if (map) updateMapMarker(firstPostInSequence, false);
            startContinuousUserPositionUpdate(); 
        } else {
            if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
            if(teamCodeFeedback) { teamCodeFeedback.textContent = 'Ugyldig lagkode! (Eks: LAG1)'; teamCodeFeedback.classList.add('error', 'shake'); }
            if (teamCodeInput) { teamCodeInput.classList.add('shake'); setTimeout(() => { if(teamCodeFeedback) teamCodeFeedback.classList.remove('shake'); if(teamCodeInput) teamCodeInput.classList.remove('shake'); }, 400); teamCodeInput.focus(); teamCodeInput.select(); }
        }
    }

    function handleTeacherPassword(postNum, password) {
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if (!pageElement || !currentTeamData) return;
        const feedbackElement = pageElement.querySelector('.feedback-teacher-password');
        const passInput = pageElement.querySelector('.teacher-password-input');
        const passButton = pageElement.querySelector('.submit-teacher-password-btn');
        if (!password) { if(feedbackElement) {feedbackElement.textContent = "Lærerpassord mangler!"; feedbackElement.className = "feedback feedback-teacher-password error shake";} if(passInput) {passInput.classList.add('shake'); setTimeout(()=>passInput.classList.remove('shake'), 400);} return; }
        if (MANNED_POST_PASSWORDS[`post${postNum}`] && password.toUpperCase() === MANNED_POST_PASSWORDS[`post${postNum}`].toUpperCase()) {
            if(feedbackElement) {feedbackElement.textContent = "Passord godkjent! Fortsett med oppgaven."; feedbackElement.className = "feedback feedback-teacher-password success";}
            if(passInput) passInput.disabled = true; if(passButton) passButton.disabled = true;
            currentTeamData.mannedPostTeacherVerified[`post${postNum}`] = true; saveState();
            setTimeout(() => resetPageUI(`post-${postNum}-page`), 800); 
        } else {
            if(feedbackElement) {feedbackElement.textContent = "Feil lærerpassord."; feedbackElement.className = "feedback feedback-teacher-password error shake";}
            if(passInput) {passInput.value=''; passInput.classList.add('shake'); setTimeout(()=>passInput.classList.remove('shake'), 400); passInput.focus();}
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }

    function handleMinigolfSubmit(postNum) {
        if (!currentTeamData || postNum !== 1) return;
        const pageElement = document.getElementById(`post-${postNum}-page`);
        const feedbackElement = document.getElementById('minigolf-results-feedback'); 
        let totalScore = 0; let playerCount = 0; let scoresValid = true;
        for (let i = 1; i <= MAX_PLAYERS_PER_TEAM; i++) {
            const scoreInput = document.getElementById(`player-${i}-score-post${postNum}`);
            if (scoreInput && scoreInput.value !== '') {
                const score = parseInt(scoreInput.value, 10);
                if (isNaN(score) || score < 3) { scoresValid = false; if(feedbackElement) {feedbackElement.textContent = `Ugyldig score for Spiller ${i}. Minimum 3 slag.`; feedbackElement.className = "feedback error";} scoreInput.classList.add('shake'); setTimeout(()=>scoreInput.classList.remove('shake'), 400); break; }
                currentTeamData.minigolfScores[`post${postNum}`]['player' + i] = score; totalScore += score; playerCount++;
            } else if (scoreInput && scoreInput.value === '' && playerCount > 0 && i <= playerCount+1) { currentTeamData.minigolfScores[`post${postNum}`]['player' + i] = null;
            } else if (scoreInput && scoreInput.value === '' && i === 1) { scoresValid = false; if(feedbackElement) {feedbackElement.textContent = `Minst én spiller må ha score.`; feedbackElement.className = "feedback error";} break; }
        }
        if (!scoresValid || playerCount === 0) { if (playerCount === 0 && scoresValid && feedbackElement) { feedbackElement.textContent = `Minst én spiller må ha score.`; feedbackElement.className = "feedback error"; } return; }
        const averageScore = totalScore / playerCount; currentTeamData.minigolfScores[`post${postNum}`].average = averageScore;
        let pointsAwarded = 0; if (averageScore <= 8) pointsAwarded = 10; else if (averageScore <= 9) pointsAwarded = 9; else if (averageScore <= 10) pointsAwarded = 8; else if (averageScore <= 11) pointsAwarded = 7; else if (averageScore <= 12) pointsAwarded = 6; else if (averageScore <= 13) pointsAwarded = 5; else if (averageScore <= 14) pointsAwarded = 4; else if (averageScore <= 15) pointsAwarded = 3; else if (averageScore <= 16) pointsAwarded = 2; else pointsAwarded = 1; 
        currentTeamData.minigolfScores[`post${postNum}`].pointsAwarded = pointsAwarded; currentTeamData.score += pointsAwarded; updateScoreDisplay();
        if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) { currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++; currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); }
        saveState(); if(feedbackElement) {feedbackElement.textContent = `Snitt: ${averageScore.toFixed(2)}. Poeng: ${pointsAwarded}!`; feedbackElement.className = "feedback success";}
        pageElement.querySelectorAll('.minigolf-form-section input, #submit-minigolf-post1').forEach(el => el.disabled = true);
        const proceedButton = document.getElementById('minigolf-proceed-btn-post1'); if (proceedButton) { proceedButton.style.display = 'inline-block'; proceedButton.disabled = false; }
    }

    function handlePyramidPointsSubmit(postNum, points) {
        if (!currentTeamData || postNum !== 8) return;
        const pageElement = document.getElementById(`post-${postNum}-page`);
        const feedbackElement = document.getElementById('pyramid-results-feedback'); 
        const pointsInput = document.getElementById(`pyramid-points-input-post${postNum}`);
        const pointsAwarded = parseInt(points, 10);
        if (isNaN(pointsAwarded) || pointsAwarded < 0 || pointsAwarded > 10) { if(feedbackElement) {feedbackElement.textContent = "Ugyldig poengsum (0-10)."; feedbackElement.className = "feedback error";} if(pointsInput) {pointsInput.classList.add('shake'); setTimeout(()=>pointsInput.classList.remove('shake'), 400); pointsInput.focus();} return; }
        currentTeamData.pyramidPoints[`post${postNum}`] = pointsAwarded; currentTeamData.score += pointsAwarded; updateScoreDisplay();
        if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) { currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++; currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); }
        saveState(); if(feedbackElement) {feedbackElement.textContent = `Poeng registrert: ${pointsAwarded}!`; feedbackElement.className = "feedback success";}
        if(pointsInput) pointsInput.disabled = true; const submitBtn = document.getElementById(`submit-pyramid-points-post${postNum}`); if(submitBtn) submitBtn.disabled = true;
        setTimeout(() => proceedToNextPostOrFinish(), 1500);
    }

    function handleGeoRunLogic(isAtTargetPoint, targetPointId) { 
        if (!currentTeamData || currentTeamData.postSequence[currentTeamData.currentPostArrayIndex] !== GEO_RUN_POST_ID) return;
        const runState = currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`];
        const pageElement = document.getElementById(`post-${GEO_RUN_POST_ID}-page`);
        if (runState.finished) return;

        if (!runState.active) { 
            if (targetPointId === 'geoRunStart' && isAtTargetPoint && !runState.countdownTimerId && !runState.atPoint1) {
                console.log("DEBUG_V31: Geo-løp: Nådd startpunkt 1. Starter nedtelling."); runState.atPoint1 = true; 
                updateMapMarker(null, false, GEO_RUN_POINT1); resetPageUI(`post-${GEO_RUN_POST_ID}-page`); 
                let countdown = GEO_RUN_COUNTDOWN_SECONDS; const countdownDisplay = pageElement.querySelector('.geo-run-countdown');
                if(countdownDisplay) countdownDisplay.textContent = countdown;
                runState.countdownTimerId = setInterval(() => {
                    countdown--; if(countdownDisplay) countdownDisplay.textContent = countdown;
                    if (countdown <= 0) {
                        clearInterval(runState.countdownTimerId); runState.countdownTimerId = null;
                        console.log("DEBUG_V31: Geo-løp: Nedtelling ferdig. Starter løpet!"); playGeoRunStartSoundSequence();
                        runState.active = true; runState.lap = 1; runState.startTime = Date.now(); runState.lapStartTime = runState.startTime;
                        updateMapMarker(null, false, GEO_RUN_POINT2); resetPageUI(`post-${GEO_RUN_POST_ID}-page`); saveState();
                    }
                }, 1000);
            }
        } else { 
            if (isAtTargetPoint) {
                playGeoRunTurnSound(); console.log(`DEBUG_V31: Geo-løp: Nådd vendepunkt. Lap: ${runState.lap}`);
                if (targetPointId === 'geoRunPoint2') { runState.atPoint1 = false; runState.atPoint2 = true; updateMapMarker(null, false, GEO_RUN_POINT1); }
                else if (targetPointId === 'geoRunPoint1') { runState.atPoint1 = true; runState.atPoint2 = false; runState.lap++; if (runState.lap <= GEO_RUN_LAPS) { updateMapMarker(null, false, GEO_RUN_POINT2); } }
                runState.lapStartTime = Date.now(); 
                if (runState.lap > GEO_RUN_LAPS) {
                    console.log("DEBUG_V31: Geo-løp: Ferdig!"); runState.finished = true; runState.active = false; 
                    runState.totalTime = Date.now() - runState.startTime;
                    let points = 0; const totalSeconds = runState.totalTime / 1000;
                    for (const timeThreshold in GEO_RUN_POINTS_SCALE) { if (totalSeconds <= parseFloat(timeThreshold)) { points = GEO_RUN_POINTS_SCALE[timeThreshold]; break; } }
                    runState.pointsAwarded = points; currentTeamData.score += points; updateScoreDisplay();
                    if (!currentTeamData.completedGlobalPosts[`post${GEO_RUN_POST_ID}`]) { currentTeamData.completedGlobalPosts[`post${GEO_RUN_POST_ID}`] = true; currentTeamData.completedPostsCount++; currentTeamData.taskCompletionTimes[`post${GEO_RUN_POST_ID}`] = Date.now(); }
                    updateMapMarker(currentTeamData.postSequence[currentTeamData.currentPostArrayIndex +1] || null, currentTeamData.completedPostsCount >= TOTAL_POSTS); 
                    const geoRunProceedButton = document.getElementById(`geo-run-proceed-btn-post${GEO_RUN_POST_ID}`);
                    if (geoRunProceedButton) { geoRunProceedButton.style.display = 'inline-block'; geoRunProceedButton.disabled = false; }
                }
                resetPageUI(`post-${GEO_RUN_POST_ID}-page`); saveState();
            }
        }
    }

    function handleTaskCheck(postNum, userAnswer) { 
        if (postNum === 1 || postNum === 8 || postNum === GEO_RUN_POST_ID) { console.warn(`DEBUG_V31: handleTaskCheck kalt for spesiell post ${postNum}.`); return; }
        const pageElement = document.getElementById(`post-${postNum}-page`); if(!pageElement) return;
        const taskInput = pageElement.querySelector('.post-task-input'); const feedbackElement = pageElement.querySelector('.feedback-task'); const taskButton = pageElement.querySelector('.check-task-btn');
        if (!currentTeamData) { if(feedbackElement) { feedbackElement.textContent = 'Feil: Lag ikke startet.'; feedbackElement.className = 'feedback feedback-task error'; } return; }
        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`]; if(feedbackElement) { feedbackElement.className = 'feedback feedback-task'; feedbackElement.textContent = '';}
        if (!userAnswer) { if(feedbackElement) { feedbackElement.textContent = 'Svar på oppgaven!'; feedbackElement.classList.add('error', 'shake'); } if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => taskInput.classList.remove('shake'), 400); } setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400); return; }
        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');
        if (currentTeamData.taskAttempts[`post${postNum}`] === undefined) { currentTeamData.taskAttempts[`post${postNum}`] = 0; }
        if (isCorrect) {
            if(feedbackElement) { feedbackElement.textContent = userAnswer.toUpperCase() === 'FASIT' ? 'FASIT godkjent! (Ingen poeng)' : 'Korrekt svar! Bra jobba!'; feedbackElement.classList.add('success');}
            if (taskInput) taskInput.disabled = true; if(taskButton) taskButton.disabled = true;
            if (userAnswer.toUpperCase() !== 'FASIT') { let pointsAwarded = POINTS_PER_CORRECT_TASK - ((currentTeamData.taskAttempts[`post${postNum}`] || 0) * 2); pointsAwarded = Math.max(1, pointsAwarded); currentTeamData.score += pointsAwarded; }
            updateScoreDisplay(); if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) { currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++; currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); }
            proceedToNextPostOrFinish(); 
        } else { 
            currentTeamData.taskAttempts[`post${postNum}`]++; updateScoreDisplay();
            const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
            if (pageElement.querySelector('.attempt-counter')) pageElement.querySelector('.attempt-counter').textContent = `Feil svar. Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : 0}`;
            if(feedbackElement){ feedbackElement.textContent = 'Feil svar, prøv igjen!'; feedbackElement.classList.add('error', 'shake'); }
            if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => { if(taskInput) taskInput.classList.remove('shake'); }, 400); taskInput.focus(); taskInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                if(feedbackElement) { feedbackElement.textContent = `Ingen flere forsøk. Går videre... (0 poeng)`; feedbackElement.className = 'feedback feedback-task error'; }
                if (taskInput) taskInput.disabled = true; if(taskButton) taskButton.disabled = true;
                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) { currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++; currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); }
                proceedToNextPostOrFinish(); 
            } else { saveState(); }
        }
    }
    
    function proceedToNextPostOrFinish() { 
        saveState(); 
        if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            currentTeamData.currentPostArrayIndex++;
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                setTimeout(() => { showRebusPage(`post-${nextPostGlobalId}-page`); if (map) updateMapMarker(nextPostGlobalId, false); }, 1200);
            } else { 
                console.error("DEBUG_V31: Ulogisk tilstand i proceedToNextPostOrFinish. Går til finale.");
                setTimeout(() => { showRebusPage('finale-page'); if (map) updateMapMarker(null, true); }, 1200);
            }
        } else { 
            setTimeout(() => { showRebusPage('finale-page'); if (map) updateMapMarker(null, true); }, 1200);
        }
    }
    function updateUIAfterLoad() { 
        if (!currentTeamData) { resetAllPostUIs(); return; }
        for (let i = 1; i <= TOTAL_POSTS; i++) { if (document.getElementById(`post-${i}-page`)) resetPageUI(`post-${i}-page`); }
        resetPageUI('finale-page'); 
        if (currentTeamData.score !== undefined) updateScoreDisplay();
    }

    function handleFinishCodeInput(userAnswer) {
        console.log("DEBUG_V31: handleFinishCodeInput called with:", userAnswer);
        const feedbackElement = document.getElementById('feedback-unlock-finish');
        const finishCodeInput = document.getElementById('finish-unlock-input');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');
        if (!currentTeamData || !currentTeamData.canEnterFinishCode) { if(feedbackElement) { feedbackElement.textContent = 'Du må være ved målet for å taste kode.'; feedbackElement.className = 'feedback feedback-unlock error';} return; }
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }
        if (!userAnswer) { if(feedbackElement) { feedbackElement.textContent = 'Skriv målkoden!'; feedbackElement.classList.add('error', 'shake'); } if(finishCodeInput) { finishCodeInput.classList.add('shake'); setTimeout(() => finishCodeInput.classList.remove('shake'), 400); } setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400); return; }
        if (userAnswer.toUpperCase() === FINISH_UNLOCK_CODE.toUpperCase() || (DEV_MODE_NO_GEOFENCE && userAnswer.toUpperCase() === 'ÅPNE')) {
            if(feedbackElement) { feedbackElement.textContent = 'Målgang registrert! Gratulerer!'; feedbackElement.classList.add('success'); }
            if (finishCodeInput) finishCodeInput.disabled = true; if (finishUnlockButton) finishUnlockButton.disabled = true;
            currentTeamData.endTime = Date.now(); if (currentTeamData.startTime) { currentTeamData.totalTimeSeconds = Math.round((currentTeamData.endTime - currentTeamData.startTime) / 1000); }
            saveState(); stopContinuousUserPositionUpdate(); updateGeofenceFeedback(null, false, true, null, false); 
            setTimeout(() => { showRebusPage('finale-page'); }, 1200);
        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil målkode. Prøv igjen!'; feedbackElement.classList.add('error', 'shake'); }
            if(finishCodeInput) { finishCodeInput.classList.add('shake'); setTimeout(() => finishCodeInput.classList.remove('shake'), 400); finishCodeInput.focus(); finishCodeInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton && teamCodeInput) { startWithTeamCodeButton.addEventListener('click', () => { initializeTeam(teamCodeInput.value); }); }
    if (teamCodeInput) { teamCodeInput.addEventListener('keypress', function(event) { if (event.key === 'Enter' && !startWithTeamCodeButton.disabled) { event.preventDefault(); startWithTeamCodeButton.click(); } }); }
    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('check-task-btn') && !target.disabled) { 
                const postNum = parseInt(target.getAttribute('data-post'));
                if (postNum !== 1 && postNum !== 8 && postNum !== GEO_RUN_POST_ID) { 
                    const pageElement = document.getElementById(`post-${postNum}-page`);
                    if(pageElement) { const taskInput = pageElement.querySelector('.post-task-input'); if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase()); }
                }
            } else if (target.classList.contains('submit-teacher-password-btn') && !target.disabled) { 
                const postNum = parseInt(target.getAttribute('data-post'));
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) { const passInput = pageElement.querySelector('.teacher-password-input'); if(passInput) handleTeacherPassword(postNum, passInput.value.trim()); }
            } else if (target.id === 'submit-minigolf-post1' && !target.disabled) { handleMinigolfSubmit(1); }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { console.log("DEBUG_V31: Minigolf proceed button clicked."); proceedToNextPostOrFinish(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) { const pointsInput = document.getElementById('pyramid-points-input-post8'); if(pointsInput) handlePyramidPointsSubmit(8, pointsInput.value.trim()); }
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { console.log("DEBUG_V31: Geo-run proceed button clicked."); proceedToNextPostOrFinish(); }
        });
        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-task-input') && !target.disabled) { 
                    const postPage = target.closest('.page');
                    if (postPage) { 
                        const postNum = parseInt(postPage.id.split('-')[1]);
                        if (postNum !== 1 && postNum !== 8 && postNum !== GEO_RUN_POST_ID) { 
                            event.preventDefault(); const taskButton = postPage.querySelector(`.check-task-btn[data-post="${postNum}"]`); if (taskButton && !taskButton.disabled) taskButton.click(); 
                        }
                    }
                } else if (target.classList.contains('teacher-password-input') && !target.disabled) { 
                     const postPage = target.closest('.page');
                     if(postPage) { event.preventDefault(); const postNum = parseInt(postPage.id.split('-')[1]); const passButton = postPage.querySelector('.submit-teacher-password-btn'); if(passButton && !passButton.disabled) passButton.click(); }
                }
            }
        });
    }
    const finishButton = document.getElementById('finish-unlock-btn'); 
    if (finishButton) { finishButton.addEventListener('click', () => { if (finishButton.disabled) return; const finishCodeInput = document.getElementById('finish-unlock-input'); if (finishCodeInput && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(finishCodeInput.value.trim().toUpperCase()); } }); }
    const finishCodeInputElement = document.getElementById('finish-unlock-input');
    if(finishCodeInputElement){ finishCodeInputElement.addEventListener('keypress', function(event) { if (event.key === 'Enter' && !finishCodeInputElement.disabled) { event.preventDefault(); const associatedButton = document.getElementById('finish-unlock-btn'); if (associatedButton && !associatedButton.disabled && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(finishCodeInputElement.value.trim().toUpperCase()); } } }); }
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || currentTeamData.completedPostsCount >= TOTAL_POSTS) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; targetLocation = POST_LOCATIONS[currentPostGlobalId - 1]; } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
    devResetButtons.forEach(button => { button.addEventListener('click', () => { if (confirm("Nullstille rebusen?")) { clearState(); showRebusPage('intro-page'); showTabContent('rebus'); if (teamCodeInput) teamCodeInput.disabled = false; if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false; } }); });
    document.addEventListener('postReached', function(event) { if (event.detail && event.detail.pageId) { console.log(`DEBUG_V31: Custom event 'postReached' for pageId: ${event.detail.pageId}. Calling resetPageUI.`); resetPageUI(event.detail.pageId); } });
    
    // === INITALISERING VED LASTING AV SIDE ===
    if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }
    if (loadState()) {
        showTabContent('rebus');
        if (currentTeamData.endTime) { showRebusPage('finale-page'); if (map) updateMapMarker(null, true); }
        else if (currentTeamData.completedPostsCount >= TOTAL_POSTS) { showRebusPage('finale-page'); if (map) updateMapMarker(null, true); if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); }
        else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) { clearState(); showRebusPage('intro-page'); }
            else { showRebusPage(`post-${currentExpectedPostId}-page`); if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); }
        } else { clearState(); showRebusPage('intro-page'); }
        updateUIAfterLoad();
    } else { showTabContent('rebus'); showRebusPage('intro-page'); resetAllPostUIs(); }
    console.log("DEBUG_V31: Initial page setup complete.");
});
/* Version: #31 */
