/* Version: #15 */

// === GLOBALE VARIABLER ===
let map;
let currentMapMarker;
let userPositionMarker;
let mapElement;
let currentTeamData = null;
let mapPositionWatchId = null;
let finishMarker = null;
let geofenceFeedbackElement = null; 

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10;
const GEOFENCE_RADIUS = 50; 
const FINISH_UNLOCK_CODE = "GRATTIS"; 
const DEV_MODE_NO_GEOFENCE = true; // MIDLERTIDIG BRYTER FOR TESTING UTEN GEOFENCE

const POST_LOCATIONS = [
    { lat: 60.81260478331276, lng: 10.673852939210269, title: "Post 1", name: "Startpunktet"},
    { lat: 60.812993, lng: 10.672853, title: "Post 2", name: "Ved flaggstanga"},
    { lat: 60.813200, lng: 10.674000, title: "Post 3", name: "Gamle Eika"},
    { lat: 60.812800, lng: 10.674500, title: "Post 4", name: "Bibliotekinngangen"},
    { lat: 60.812300, lng: 10.672500, title: "Post 5", name: "Sykkelstativet"},
    { lat: 60.813500, lng: 10.673000, title: "Post 6", name: "Kunstverket"},
    { lat: 60.812000, lng: 10.673800, title: "Post 7", name: "Baksiden av gymsal"},
    { lat: 60.813800, lng: 10.674200, title: "Post 8", name: "Ved hovedinngang A"},
    { lat: 60.812500, lng: 10.675000, title: "Post 9", name: "Benken i solveggen"},
    { lat: 60.814000, lng: 10.672000, title: "Post 10", name: "Fotballbanen"}
];
const START_LOCATION = { lat: 60.8127, lng: 10.6737, title: "Startområde Rebus" };
const FINISH_LOCATION = { lat: 60.8124, lng: 10.6734, title: "Mål: Premieutdeling!" };

const POST_UNLOCK_HINTS = { /* ... (uendret) ... */ };
const POST_UNLOCK_CODES = { /* ... (uendret) ... */ };
const CORRECT_TASK_ANSWERS = { /* ... (uendret) ... */ };
const MAX_ATTEMPTS_PER_TASK = 5;
const POINTS_PER_CORRECT_TASK = 10;

// === HJELPEFUNKSJONER ===
function calculateDistance(lat1, lon1, lat2, lon2) { /* ... (uendret) ... */ }
function formatTime(totalSeconds) { /* ... (uendret) ... */ }

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { /* ... (uendret fra v14, bortsett fra fjernet DEBUG logging) ... */
    mapElement = document.getElementById('dynamic-map-container');
    if (!mapElement) {
        setTimeout(window.initMap, 500);
        return;
    }
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    
    const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ];
    map = new google.maps.Map(mapElement, {
        center: START_LOCATION, zoom: 17, mapTypeId: google.maps.MapTypeId.HYBRID,
        styles: mapStyles, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID]
        }
    });

    if (currentTeamData) {
        if (currentTeamData.completedPostsCount >= TOTAL_POSTS && !currentTeamData.endTime) { 
            updateMapMarker(null, true);
        } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            updateMapMarker(currentPostGlobalId, false);
        } else { 
             updateMapMarker(null, true);
        }
        startContinuousUserPositionUpdate(); 
    }
    console.log("Skolerebus Kart initialisert");
 }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false) { /* ... (uendret) ... */ }
function clearMapMarker() { /* ... (uendret) ... */ }
function clearFinishMarker() { /* ... (uendret) ... */ }
function handleGeolocationError(error) { /* ... (uendret) ... */ }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER ===
function updateUserPositionOnMap(position) { /* ... (uendret) ... */ }

function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten") {
    if (!geofenceFeedbackElement) return;

    if (isFullyCompleted || (!currentTeamData)) {
        geofenceFeedbackElement.style.display = 'none';
        geofenceFeedbackElement.textContent = '';
        geofenceFeedbackElement.className = ''; 
        return;
    }
    
    geofenceFeedbackElement.style.display = 'block';
    geofenceFeedbackElement.classList.remove('permanent'); 

    if (DEV_MODE_NO_GEOFENCE) { // NYTT: Vis melding om at geofence er av
        geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. Du kan taste kode. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`;
        geofenceFeedbackElement.className = 'geofence-info dev-mode'; // Egen klasse for dev-mode info
        return; // Gå ikke videre med vanlig feedback
    }

    if (distance === null) {
         geofenceFeedbackElement.textContent = 'Leter etter neste post...';
         geofenceFeedbackElement.className = 'geofence-info';
         return;
    }

    const distanceFormatted = Math.round(distance);
    // Bruk isEffectivelyWithinRange her for fargelegging, selv om DEV_MODE håndteres over
    if (isEffectivelyWithinRange) { 
        geofenceFeedbackElement.textContent = `Du er nær nok ${targetName.toLowerCase()}! (${distanceFormatted}m). Tast inn koden.`;
        geofenceFeedbackElement.className = 'geofence-success';
    } else {
        geofenceFeedbackElement.textContent = `Du må nærmere ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`;
        geofenceFeedbackElement.className = 'geofence-error';
    }
}

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) { 
        updateGeofenceFeedback(null, false, true, null); 
        return;
    }

    let targetLocationDetails = null; 

    if (currentTeamData.atFinishLineInput) { 
        targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale-page', globalId: 'finish', name: "Målet" };
    } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
        const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        if (currentGlobalId && POST_LOCATIONS[currentGlobalId - 1]) {
            const postData = POST_LOCATIONS[currentGlobalId - 1];
            targetLocationDetails = { location: postData, pageId: `post-${currentGlobalId}-page`, globalId: currentGlobalId, name: postData.name || `Post ${currentGlobalId}` };
        }
    }

    if (!targetLocationDetails) {
        updateGeofenceFeedback(null, false, false, null);
        return;
    }

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS;
    const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange; // NYTT: Bruk DEV_MODE bryter

    const pageElement = document.getElementById(targetLocationDetails.pageId);
    if (!pageElement) return;

    let unlockInput, unlockButton;
    if (targetLocationDetails.globalId === 'finish') {
        unlockInput = document.getElementById('finish-unlock-input');
        unlockButton = document.getElementById('finish-unlock-btn');
    } else {
        unlockInput = pageElement.querySelector('.post-unlock-input');
        unlockButton = pageElement.querySelector('.unlock-post-btn');
    }

    if (unlockInput && unlockButton) {
        let canInteract = false; 
        if (targetLocationDetails.globalId === 'finish' && !currentTeamData.endTime) { 
            canInteract = true;
        } else if (targetLocationDetails.globalId !== 'finish' && !currentTeamData.unlockedPosts[`post${targetLocationDetails.globalId}`]) { 
            canInteract = true;
        }
        
        if (canInteract) {
            unlockInput.disabled = !isEffectivelyWithinRange; // NYTT: Bruk isEffectivelyWithinRange
            unlockButton.disabled = !isEffectivelyWithinRange; // NYTT: Bruk isEffectivelyWithinRange
            if (!isEffectivelyWithinRange && document.activeElement === unlockInput) {
                unlockInput.blur();
            }
        }
    }
    // Send reell 'isWithinRange' til updateGeofenceFeedback for visning av reell avstand,
    // men 'isEffectivelyWithinRange' for å indikere om interaksjon er mulig.
    // Eller, la updateGeofenceFeedback håndtere DEV_MODE meldingen helt selv.
    updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name);
}


function startContinuousUserPositionUpdate() { /* ... (uendret) ... */ }
function stopContinuousUserPositionUpdate() { /* ... (uendret) ... */ }


document.addEventListener('DOMContentLoaded', () => {
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    const teamCodeFeedback = document.getElementById('team-code-feedback');
    const pages = document.querySelectorAll('#rebus-content .page');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    
    const TEAM_CONFIG = { /* ... (uendret) ... */ };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }

    function showRebusPage(pageId) { /* ... (uendret fra v14, med DEBUG logging fjernet) ... */ 
        pages.forEach(page => page.classList.remove('visible'));
        const nextPageElement = document.getElementById(pageId);

        if (nextPageElement) {
            nextPageElement.classList.add('visible');
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
                    updatePageText(nextPageElement, teamPostNum, globalPostNum);
                }
            }
            resetPageUI(pageId); 

            if (currentTeamData && pageId !== 'intro-page') { 
                updateScoreDisplay();
            } else if (scoreDisplayElement) {
                scoreDisplayElement.style.display = 'none';
            }

            if (pageId === 'finale-page') {
                const finaleUnlockSection = document.getElementById('finale-unlock-section');
                const finaleCompletedSection = document.getElementById('finale-completed-section');
                const finalScoreSpan = document.getElementById('final-score'); 
                const totalTimeSpan = document.getElementById('total-time');   

                if (currentTeamData && currentTeamData.endTime) { 
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'block';
                    if(finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
                    if(totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
                        totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
                    }
                    updateGeofenceFeedback(null, false, true, null); 
                } else if (currentTeamData && currentTeamData.atFinishLineInput) { 
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'block';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                } else if (currentTeamData && !currentTeamData.atFinishLineInput && currentTeamData.completedPostsCount >= TOTAL_POSTS) {
                    currentTeamData.atFinishLineInput = true;
                    saveState();
                    showRebusPage('finale-page'); 
                    return;
                }
                 else { 
                    clearState(); showRebusPage('intro-page'); return;
                }
            }

        } else {
            clearState(); showRebusPage('intro-page');
        }
    }

    function showTabContent(tabId) { /* ... (uendret) ... */ }
    function saveState() { /* ... (uendret) ... */ }
    function loadState() { /* ... (uendret) ... */ }
    function clearState() { /* ... (uendret) ... */ }
    function resetPageUI(pageId) { /* ... (uendret fra v14) ... */
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
            const unlockSection = document.getElementById('finale-unlock-section');
            const completedSection = document.getElementById('finale-completed-section');
            const unlockInput = document.getElementById('finish-unlock-input');
            const unlockButton = document.getElementById('finish-unlock-btn');
            const unlockFeedback = document.getElementById('feedback-unlock-finish');

            if (currentTeamData && currentTeamData.endTime) { 
                if(unlockSection) unlockSection.style.display = 'none';
                if(completedSection) completedSection.style.display = 'block';
            } else { 
                if(unlockSection) unlockSection.style.display = 'block';
                if(completedSection) completedSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = !DEV_MODE_NO_GEOFENCE; unlockInput.value = ''; } // NYTT: Ta hensyn til DEV_MODE
                if (unlockButton) unlockButton.disabled = !DEV_MODE_NO_GEOFENCE; // NYTT: Ta hensyn til DEV_MODE
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
            return;
        }

        const postNumberMatch = pageId.match(/post-(\d+)-page/);
        if (!postNumberMatch) return;
        const postNum = postNumberMatch[1];

        const unlockSection = pageElement.querySelector('.post-unlock-section');
        const taskSection = pageElement.querySelector('.post-task-section');
        const unlockInput = pageElement.querySelector('.post-unlock-input');
        const unlockButton = pageElement.querySelector('.unlock-post-btn');
        const unlockFeedback = pageElement.querySelector('.feedback-unlock');
        const taskInput = pageElement.querySelector('.post-task-input');
        const taskButton = pageElement.querySelector('.check-task-btn');
        const taskFeedback = pageElement.querySelector('.feedback-task');
        const attemptCounterElement = pageElement.querySelector('.attempt-counter');

        if(attemptCounterElement) attemptCounterElement.textContent = '';

        const isPostUnlocked = currentTeamData?.unlockedPosts?.[`post${postNum}`];
        const isTaskCompleted = currentTeamData?.completedGlobalPosts?.[`post${postNum}`];

        if (unlockSection && taskSection) {
            if (isTaskCompleted) { 
                unlockSection.style.display = 'none'; taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = true; } if (taskButton) taskButton.disabled = true;
                if (taskFeedback) { taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success'; }
            } else if (isPostUnlocked) { 
                unlockSection.style.display = 'none'; taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = false; taskInput.value = ''; } if (taskButton) taskButton.disabled = false;
                if (taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task'; }
                if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`;
                } else if (attemptCounterElement) { attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`; }
            } else { 
                unlockSection.style.display = 'block'; taskSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = !DEV_MODE_NO_GEOFENCE; unlockInput.value = ''; } // NYTT: Ta hensyn til DEV_MODE
                if (unlockButton) unlockButton.disabled = !DEV_MODE_NO_GEOFENCE; // NYTT: Ta hensyn til DEV_MODE
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
     }
    function resetAllPostUIs() { /* ... (uendret fra v14) ... */ }
    function initializeTeam(teamCode) { /* ... (uendret) ... */ }
    function handlePostUnlock(postNum, userAnswer) { /* ... (uendret) ... */ }
    function handleFinishCodeUnlock(userAnswer) { /* ... (uendret) ... */ }
    function proceedToNextPostOrFinish() { /* ... (uendret) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret) ... */ }
    function updateUIAfterLoad() { /* ... (uendret) ... */ }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton && teamCodeInput) { /* ... (uendret) ... */ }
    if (teamCodeInput) { /* ... (uendret) ... */ }
    const rebusContentElement = document.getElementById('rebus-content');
    if (rebusContentElement) { /* ... (uendret) ... */ }
    const finishUnlockButton = document.getElementById('finish-unlock-btn');
    if (finishUnlockButton) { /* ... (uendret) ... */ }
    const finishUnlockInput = document.getElementById('finish-unlock-input');
    if(finishUnlockInput){ /* ... (uendret) ... */ }
    if (rebusContentElement) { /* ... (uendret, for enter i post-inputs) ... */ }
    tabButtons.forEach(button => { /* ... (uendret) ... */ });
    devResetButtons.forEach(button => { /* ... (uendret) ... */ });

    // === INITALISERING VED LASTING AV SIDE ===
    if (DEV_MODE_NO_GEOFENCE) {
        console.warn("DEV MODE: GEOFENCE ER DEAKTIVERT GLOBALT!");
        if (geofenceFeedbackElement) { // Hvis elementet er klart allerede
            geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert.";
            geofenceFeedbackElement.className = 'geofence-info dev-mode';
            geofenceFeedbackElement.style.display = 'block';
        }
    }

    if (loadState()) {
        showTabContent('rebus');
        if (currentTeamData.endTime) { 
            showRebusPage('finale-page'); if (map) updateMapMarker(null, true);
        } else if (currentTeamData.atFinishLineInput) { 
            showRebusPage('finale-page'); if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); 
        } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) {
                 clearState(); showRebusPage('intro-page');
            } else {
                showRebusPage(`post-${currentExpectedPostId}-page`);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            }
        } else { 
            currentTeamData.atFinishLineInput = true; saveState(); 
            showRebusPage('finale-page'); if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
        }
        updateUIAfterLoad();
    } else {
        showTabContent('rebus'); showRebusPage('intro-page'); resetAllPostUIs();
    }
});
/* Version: #15 */
