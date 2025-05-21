/* Version: #30 */

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
let shortPipAudio = null; // For Geo-løp start
let longPipAudio = null;  // For Geo-løp start og vending

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
const GEO_RUN_POINTS_SCALE = { /* ... (som i v29) ... */ };

const START_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Start: Fastland", name: "Start: Fastland" };
const FINISH_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Mål: Fastland", name: "Mål: Fastland" };

const POST_LOCATIONS = [
    { lat: 60.7962307499199, lng: 10.667771549607588, title: "Post 1", name: "Bassengparken"},
    { lat: 60.7941862597763, lng: 10.656946793729826, title: "Post 2", name: "Hunn Kirke"},
    { lat: 60.80121161360927, lng: 10.645440903323017, title: "Post 3", name: "Lavvoen Øverby"},
    { lat: 60.80469643634315, lng: 10.646298022954033, title: "Post 4", name: "Åttekanten på Eiktunet"},
    { lat: 60.803527350299944, lng: 10.66552015165931, title: "Post 5", name: "Krysset Øverbyvegen/Prost Bloms Gate"},
    { lat: 60.80202682020165, lng: 10.673687047853834, title: "Post 6", name: "Hunn Gravlund"},
    // Post 7 bruker nå GEO_RUN_POINT1 som sitt "hovedpunkt" for ankomst før løpet starter
    { lat: GEO_RUN_POINT1.lat, lng: GEO_RUN_POINT1.lng, title: "Post 7", name: "Geo-løp Start"},
    { lat: 60.794004447513956, lng: 10.692558505369421, title: "Post 8", name: "Scenen Gjøvik Gård"},
    { lat: 60.793249975246106, lng: 10.685006947085599, title: "Post 9", name: "Gjøvik Olympiske Fjellhall"},
    { lat: 60.793880419179715, lng: 10.678003145501888, title: "Post 10", name: "Hovdetoppen Restaurant"}
];
const CORRECT_TASK_ANSWERS = { /* ... (som i v29) ... */ };
const MAX_ATTEMPTS_PER_TASK = 5; 
const POINTS_PER_CORRECT_TASK = 10; 

// === HJELPEFUNKSJONER (Globale) ===
function calculateDistance(lat1, lon1, lat2, lon2) { /* ... (uendret) ... */ }
function formatTime(totalSeconds) { /* ... (uendret) ... */ }
function formatTimeFromMs(ms) { /* ... (uendret) ... */ }

// === Globale State Management Funksjoner ===
function saveState() { /* ... (uendret) ... */ }

// === LYDFUNKSJONER ===
function initializeSounds() {
    try {
        // ERSTATT 'path/to/...' MED FAKTISKE URL-ER TIL LYDFILER
        // Du kan finne gratis .wav eller .mp3 pipelyder på nettet.
        // generalArrivalAudio = new Audio('path/to/arrival_short_beep.mp3'); 
        // shortPipAudio = new Audio('path/to/short_pip_for_sequence.mp3');
        // longPipAudio = new Audio('path/to/long_pip_for_sequence_and_turn.mp3');

        // For testing uten faktiske filer, kan vi la dem være null
        // og kun stole på console.log
        generalArrivalAudio = null; // Fjern eller kommenter ut for å teste med console.log
        shortPipAudio = null;
        longPipAudio = null;

        console.log("Lydobjekter initialisert (eller satt til null for testing).");
        if(generalArrivalAudio) generalArrivalAudio.load(); // Preload
        if(shortPipAudio) shortPipAudio.load();
        if(longPipAudio) longPipAudio.load();

    } catch (e) {
        console.warn("Kunne ikke initialisere Audio objekter:", e);
        generalArrivalAudio = null; shortPipAudio = null; longPipAudio = null;
    }
}

function playSound(audioObject) {
    if (audioObject && typeof audioObject.play === 'function') {
        audioObject.currentTime = 0; // Start fra begynnelsen hver gang
        audioObject.play().catch(e => console.warn("Feil ved avspilling av lyd:", e, audioObject.src));
    } else {
        // Fallback console.log hvis audioObject ikke er gyldig
        // Dette er allerede dekket av de spesifikke play... funksjonene
    }
}

function playArrivalSound() {
    console.log("AUDIO: *Ankomstlyd spilles*");
    playSound(generalArrivalAudio);
}

async function playGeoRunStartSoundSequence() {
    console.log("AUDIO: Pip, Pip, Pip, PIIIIIP (Geo-løp start)!");
    if (shortPipAudio && longPipAudio) {
        try {
            await playSoundPromise(shortPipAudio); await delay(150); // Kort pause
            await playSoundPromise(shortPipAudio); await delay(150);
            await playSoundPromise(shortPipAudio); await delay(150);
            await playSoundPromise(longPipAudio);
        } catch (e) {
            console.warn("Feil i lydsekvens:", e);
        }
    }
}

function playGeoRunTurnSound() {
    console.log("AUDIO: PIIIP (Geo-løp vending)!");
    playSound(longPipAudio);
}

// Hjelpefunksjon for å spille lyd og returnere et Promise
function playSoundPromise(audioObject) {
    return new Promise((resolve, reject) => {
        if (audioObject && typeof audioObject.play === 'function') {
            audioObject.currentTime = 0;
            audioObject.onended = resolve;
            audioObject.onerror = reject;
            audioObject.play().catch(reject);
        } else {
            resolve(); // Løs umiddelbart hvis ingen lyd å spille
        }
    });
}
// Hjelpefunksjon for forsinkelse
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { /* ... (uendret) ... */ }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false, customLocation = null) { /* ... (uendret) ... */ }
function clearMapMarker() { /* ... (uendret) ... */ }
function clearFinishMarker() { /* ... (uendret) ... */ }
function handleGeolocationError(error) { /* ... (uendret) ... */ }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
function updateUserPositionOnMap(position) { /* ... (uendret) ... */ }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) { /* ... (uendret) ... */ }
function handlePositionUpdate(position) { /* ... (som i v29, men med playArrivalSound kall) ... */
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
        if (isEffectivelyWithinRange && !currentTeamData.arrivalSoundPlayed.finish) { playArrivalSound(); currentTeamData.arrivalSoundPlayed.finish = true; saveState(); } // Ankomstlyd MÅL
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else if (isGeoRunActiveForCurrentPost && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`] && !currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`].finished) {
        handleGeoRunLogic(isEffectivelyWithinRange, targetLocationDetails.globalId); 
    } else { 
        const postGlobalId = targetLocationDetails.globalId; const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];
        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            console.log(`DEBUG_V30: Post ${postGlobalId} reached. Unlocking.`); currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            if (!currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`]) { playArrivalSound(); currentTeamData.arrivalSoundPlayed[`post${postGlobalId}`] = true; } // Ankomstlyd POST
            saveState(); document.dispatchEvent(new CustomEvent('postReached', { detail: { pageId: targetLocationDetails.pageId } }));
            canCurrentlyInteract = true; 
        } else if (isPostAlreadyUnlocked) { if (postGlobalId === 1 || postGlobalId === 8) { canCurrentlyInteract = !currentTeamData.mannedPostTeacherVerified[`post${postGlobalId}`]; } else { canCurrentlyInteract = false; } }
    }
    if (!isGeoRunActiveForCurrentPost || (currentTeamData.geoRunState && currentTeamData.geoRunState[`post${GEO_RUN_POST_ID}`]?.finished)) { updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract); }
}

function startContinuousUserPositionUpdate() { /* ... (uendret) ... */ }
function stopContinuousUserPositionUpdate() { /* ... (uendret) ... */ }


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG_V30: DOMContentLoaded event fired.");
    initializeSounds(); 
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    let pages = document.querySelectorAll('#rebus-content .page');
    const rebusContentElement = document.getElementById('rebus-content');
    if (!rebusContentElement) console.error("DEBUG_V30: rebusContentElement is NULL!");
    const scoreDisplayElement = document.getElementById('score-display'); // Flyttet opp for clearState
    const currentScoreSpan = document.getElementById('current-score'); // Flyttet opp
    const teamCodeFeedback = document.getElementById('team-code-feedback'); // Flyttet opp
    const tabButtons = document.querySelectorAll('.tab-button'); // Flyttet opp
    const tabContents = document.querySelectorAll('.tab-content'); // Flyttet opp
    const devResetButtons = document.querySelectorAll('.dev-reset-button'); // Flyttet opp


    const TEAM_CONFIG = { /* ... (som i v29) ... */ };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }
    function displayFinalResults() { /* ... (uendret) ... */ }
    function showRebusPage(pageId) { /* ... (som i v29) ... */ }
    function showTabContent(tabId) { /* ... (uendret) ... */ }
    
    function loadState() { /* ... (som i v29) ... */ } 
    function clearState() { /* ... (som i v29, men med DEBUG_V30) ... */
        localStorage.removeItem('activeTeamData_Skolerebus'); currentTeamData = null;
        resetAllPostUIs(); 
        clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); 
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        if (geofenceFeedbackElement) { geofenceFeedbackElement.style.display = 'none'; geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = ''; }
        console.log("DEBUG_V30: State cleared by clearState().");
    }

    function resetPageUI(pageId) { /* ... (som i v29) ... */ }
    function resetAllPostUIs() { /* ... (uendret) ... */ }
    function initializeTeam(teamCode) { /* ... (som i v29) ... */ }
    function handleTeacherPassword(postNum, password) { /* ... (uendret) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (uendret) ... */ }
    function handlePyramidPointsSubmit(postNum, points) { /* ... (uendret) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId) { /* ... (som i v29) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (som i v29) ... */ }
    function proceedToNextPostOrFinish() { /* ... (uendret) ... */ }
    function updateUIAfterLoad() { /* ... (uendret) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (uendret) ... */ }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton && teamCodeInput) { /* ... (uendret) ... */ }
    if (teamCodeInput) { /* ... (uendret) ... */ }
    if (rebusContentElement) { /* ... (uendret) ... */ }
    const finishButton = document.getElementById('finish-unlock-btn'); 
    if (finishButton) { /* ... (uendret) ... */ }
    const finishCodeInputElement = document.getElementById('finish-unlock-input');
    if(finishCodeInputElement){ /* ... (uendret) ... */ }
    tabButtons.forEach(button => { /* ... (uendret) ... */ });
    devResetButtons.forEach(button => { /* ... (uendret) ... */ });
    document.addEventListener('postReached', function(event) { /* ... (uendret) ... */ });
    
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
    console.log("DEBUG_V30: Initial page setup complete.");
});
/* Version: #30 */
