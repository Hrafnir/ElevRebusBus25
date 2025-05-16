/* Version: #19 */

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
const DEV_MODE_NO_GEOFENCE = true; 

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

const POST_UNLOCK_HINTS = {
    1: "Hvor starter eventyret?", 2: "Høyt og synlig, vaier i vinden.", 3: "Et tre med historie.",
    4: "Der kunnskap bor.", 5: "Parkeringsplass for tohjulinger.", 6: "Noe vakkert å se på.",
    7: "Der baller spretter og svette renner.", 8: "En av flere veier inn.",
    9: "Et sted å hvile i sola.", 10: "Der mål scores."
};

const POST_UNLOCK_CODES = {
    post1: "START", post2: "FLAGG", post3: "TRE", post4: "BOK", post5: "SYKKEL",
    post6: "KUNST", post7: "BALL", post8: "DØR", post9: "SOL", post10: "MÅL"
};

const CORRECT_TASK_ANSWERS = {
    post1: "SVARPOST1", post2: "SVARPOST2", post3: "SVARPOST3", post4: "SVARPOST4", post5: "SVARPOST5",
    post6: "SVARPOST6", post7: "SVARPOST7", post8: "SVARPOST8", post9: "SVARPOST9", post10: "SVARPOST10"
};

const MAX_ATTEMPTS_PER_TASK = 5;
const POINTS_PER_CORRECT_TASK = 10;

// === HJELPEFUNKSJONER ===
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; 
    const φ1 = lat1 * Math.PI / 180; const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180; const Δλ = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
}

function formatTime(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return "00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');
    if (hours > 0) return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    else return `${paddedMinutes}:${paddedSeconds}`;
}

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() {
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
function updateMapMarker(postGlobalId, isFinalTarget = false) { 
    if (!map) { console.warn("Kart ikke initialisert for updateMapMarker."); return; }
    clearMapMarker();
    clearFinishMarker();
    let location, markerTitle, markerIconUrl;

    if (isFinalTarget) {
        location = FINISH_LOCATION; markerTitle = FINISH_LOCATION.title;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        finishMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng }, map: map, title: markerTitle,
            animation: google.maps.Animation.DROP, icon: { url: markerIconUrl }
        });
    } else {
        if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) {
            console.warn("Ugyldig postGlobalId for updateMapMarker:", postGlobalId); return;
        }
        location = POST_LOCATIONS[postGlobalId - 1];
        markerTitle = `Neste: ${location.name || location.title}`;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
        currentMapMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng }, map: map, title: markerTitle,
            animation: google.maps.Animation.DROP, icon: { url: markerIconUrl }
        });
    }
    if(location) { map.panTo({ lat: location.lat, lng: location.lng }); if (map.getZoom() < 17) map.setZoom(17); }
}
function clearMapMarker() { if (currentMapMarker) { currentMapMarker.setMap(null); currentMapMarker = null; } }
function clearFinishMarker() { if (finishMarker) { finishMarker.setMap(null); finishMarker = null; } }

function handleGeolocationError(error) { 
    let msg = "Posisjonsfeil: ";
    switch (error.code) {
        case error.PERMISSION_DENIED: msg += "Du må tillate posisjonstilgang i nettleseren."; break;
        case error.POSITION_UNAVAILABLE: msg += "Posisjonen din er utilgjengelig."; break;
        case error.TIMEOUT: msg += "Tok for lang tid å hente posisjonen."; break;
        default: msg += "Ukjent GPS-feil.";
    }
    console.warn(msg);
    if (geofenceFeedbackElement) {
        geofenceFeedbackElement.textContent = msg;
        geofenceFeedbackElement.className = 'geofence-error permanent'; 
        geofenceFeedbackElement.style.display = 'block';
    }
}

// === KARTPOSISJON OG GEOFENCE FUNKSJONER ===
function updateUserPositionOnMap(position) { 
    if (!map) return;
    const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (userPositionMarker) {
        userPositionMarker.setPosition(userPos);
    } else {
        userPositionMarker = new google.maps.Marker({
            position: userPos, map: map, title: "Din Posisjon",
            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" }
        });
    }
}

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

    if (DEV_MODE_NO_GEOFENCE) { 
        geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. Du kan taste kode. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`;
        geofenceFeedbackElement.className = 'geofence-info dev-mode'; 
        return; 
    }

    if (distance === null) {
         geofenceFeedbackElement.textContent = 'Leter etter neste post...';
         geofenceFeedbackElement.className = 'geofence-info';
         return;
    }

    const distanceFormatted = Math.round(distance);
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
    const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange; 

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
            unlockInput.disabled = !isEffectivelyWithinRange; 
            unlockButton.disabled = !isEffectivelyWithinRange; 
            if (!isEffectivelyWithinRange && document.activeElement === unlockInput) {
                unlockInput.blur();
            }
        }
    }
    updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name);
}


function startContinuousUserPositionUpdate() { 
    if (!navigator.geolocation) { console.warn("Geolocation ikke støttet."); return; }
    if (mapPositionWatchId !== null) return;
    console.log("Starter kontinuerlig GPS posisjonssporing.");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
            handleGeolocationError(error);
            if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) { 
                // stopContinuousUserPositionUpdate(); 
            }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}
function stopContinuousUserPositionUpdate() { 
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        console.log("Stoppet kontinuerlig GPS sporing.");
        updateGeofenceFeedback(null, false, true, null); 
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG_V19: DOMContentLoaded event fired.");
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

    console.log(`DEBUG_V19: Pages NodeList length: ${pages ? pages.length : 'null'}`);
    if (!teamCodeInput) console.error("DEBUG_V19: teamCodeInput is NULL!");
    if (!startWithTeamCodeButton) console.error("DEBUG_V19: startWithTeamCodeButton is NULL!");
    if (!rebusContentElement) console.error("DEBUG_V19: rebusContentElement is NULL! Critical for delegated listeners.");


    const TEAM_CONFIG = {
        "LAG1": { name: "Lag 1", postSequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        "LAG2": { name: "Lag 2", postSequence: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] },
        "LAG3": { name: "Lag 3", postSequence: [3, 4, 5, 6, 7, 8, 9, 10, 1, 2] },
        "LAG4": { name: "Lag 4", postSequence: [4, 5, 6, 7, 8, 9, 10, 1, 2, 3] },
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
        const introElement = pageElement.querySelector('.post-intro-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder');
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder');

        if (globalPostId === null || globalPostId === undefined || globalPostId === 'finish') return;

        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) titleElement.textContent = `Post ${teamPostNumber}/${TOTAL_POSTS}: ${postName}`;
        if (introElement) {
            const commonInstruction = "Bruk kartet for å finne posten. Når du er nær nok, kan du taste ankomstkoden.";
            let specificHint = POST_UNLOCK_HINTS[globalPostId] ? ` Hint for koden: ${POST_UNLOCK_HINTS[globalPostId]}` : "";
            introElement.textContent = `${commonInstruction}${specificHint}`;
        }
        if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
        if (taskQuestionElement) {
            taskQuestionElement.textContent = `Spørsmål for ${postName}. (Fasit: ${CORRECT_TASK_ANSWERS['post'+globalPostId]})`;
        }
    }

    function showRebusPage(pageId) {
        console.log(`DEBUG_V19: --- showRebusPage CALLED with pageId: '${pageId}' ---`);
        pages = document.querySelectorAll('#rebus-content .page');
        if (!pages || pages.length === 0) {
            console.error("DEBUG_V19: CRITICAL - 'pages' NodeList is EMPTY or UNDEFINED in showRebusPage! Cannot switch pages.");
            return; 
        }
        console.log(`DEBUG_V19: 'pages' NodeList has ${pages.length} elements inside showRebusPage.`);

        let foundTargetPageAndMadeVisible = false;
        pages.forEach((page, index) => {
            if (page.id === pageId) {
                page.classList.add('visible');
                foundTargetPageAndMadeVisible = true;
            } else {
                page.classList.remove('visible');
            }
        });

        if (!foundTargetPageAndMadeVisible) console.error(`DEBUG_V19: CRITICAL - Page with ID '${pageId}' was NOT FOUND.`);
        
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
            }
        }
        resetPageUI(pageId); 
        if (currentTeamData && pageId !== 'intro-page') { updateScoreDisplay(); } 
        else if (scoreDisplayElement) { scoreDisplayElement.style.display = 'none'; }
        
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
                currentTeamData.atFinishLineInput = true; saveState(); showRebusPage('finale-page'); return;
            } else { clearState(); showRebusPage('intro-page'); return; }
        }
        console.log(`DEBUG_V19: --- showRebusPage COMPLETED for pageId: '${pageId}' ---`);
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
    function saveState() { 
        if (currentTeamData) localStorage.setItem('activeTeamData_Skolerebus', JSON.stringify(currentTeamData));
        else localStorage.removeItem('activeTeamData_Skolerebus');
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
                    typeof currentTeamData.atFinishLineInput === 'undefined' 
                ) { clearState(); return false; }
                if (typeof currentTeamData.startTime === 'string') currentTeamData.startTime = parseInt(currentTeamData.startTime,10);
                if (currentTeamData.startTime && isNaN(currentTeamData.startTime)) currentTeamData.startTime = null; 
                return true;
            } catch (e) { console.warn("Feil ved parsing av lagret data:", e); clearState(); return false; }
        }
        currentTeamData = null; return false;
    }
    function clearState() { 
        localStorage.removeItem('activeTeamData_Skolerebus'); currentTeamData = null;
        resetAllPostUIs(); clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); 
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        if (geofenceFeedbackElement) {
            geofenceFeedbackElement.style.display = 'none';
            geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = '';
        }
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
                const shouldBeDisabledDueToGeofence = !DEV_MODE_NO_GEOFENCE;
                if (unlockInput) { unlockInput.disabled = shouldBeDisabledDueToGeofence; unlockInput.value = ''; } 
                if (unlockButton) unlockButton.disabled = shouldBeDisabledDueToGeofence; 
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
                const shouldBeDisabledDueToGeofence = !DEV_MODE_NO_GEOFENCE;
                if (unlockInput) { unlockInput.disabled = shouldBeDisabledDueToGeofence; unlockInput.value = ''; } 
                if (unlockButton) unlockButton.disabled = shouldBeDisabledDueToGeofence; 
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
     }
    function resetAllPostUIs() { 
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const pageElement = document.getElementById(`post-${i}-page`);
            if (!pageElement) continue;
            resetPageUI(`post-${i}-page`); 
            const titlePlaceholder = pageElement.querySelector('.post-title-placeholder');
            if(titlePlaceholder) titlePlaceholder.textContent = `Post ${i}: Tittel`;
            const introPlaceholder = pageElement.querySelector('.post-intro-placeholder');
            if(introPlaceholder) introPlaceholder.textContent = "Finn koden...";
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
        console.log(`DEBUG_V19: --- initializeTeam CALLED with code: '${teamCode}' ---`);
        if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = true;

        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        if(teamCodeFeedback) { teamCodeFeedback.className = 'feedback'; teamCodeFeedback.textContent = ''; }

        if (config) {
            console.log(`DEBUG_V19: Valid team config found for '${teamKey}'.`);
            currentTeamData = {
                ...config, id: teamKey, currentPostArrayIndex: 0, completedPostsCount: 0,
                completedGlobalPosts: {}, unlockedPosts: {}, score: 0, taskAttempts: {},
                startTime: Date.now(), endTime: null, totalTimeSeconds: null, atFinishLineInput: false 
            };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            
            saveState(); resetAllPostUIs(); 
            if (teamCodeInput) teamCodeInput.disabled = true;

            clearFinishMarker(); updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            const targetPageId = `post-${firstPostInSequence}-page`;
            console.log(`DEBUG_V19: First post ID: ${firstPostInSequence}. Target page ID: '${targetPageId}'. Calling showRebusPage...`);
            showRebusPage(targetPageId); 
            
            if (map) updateMapMarker(firstPostInSequence, false);
            else console.warn("DEBUG_V19: Map NOT ready for marker update at team init.");
            startContinuousUserPositionUpdate(); 
            console.log(`DEBUG_V19: Team ${currentTeamData.name} started!`);
        } else {
            console.warn(`DEBUG_V19: Invalid team config for '${teamKey}'.`);
            if(teamCodeFeedback) { teamCodeFeedback.textContent = 'Ugyldig lagkode! (Eks: LAG1)'; teamCodeFeedback.classList.add('error', 'shake'); }
            if (teamCodeInput) {
                teamCodeInput.classList.add('shake');
                setTimeout(() => { if(teamCodeFeedback) teamCodeFeedback.classList.remove('shake'); if(teamCodeInput) teamCodeInput.classList.remove('shake'); }, 400);
                teamCodeInput.focus(); teamCodeInput.select();
            }
            if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
        }
        console.log("DEBUG_V19: --- initializeTeam COMPLETED ---");
    }

    function handlePostUnlock(postNum, userAnswer) { 
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if (!pageElement) return;
        const unlockInput = pageElement.querySelector('.post-unlock-input');
        const feedbackElement = pageElement.querySelector('.feedback-unlock');
        const unlockButton = pageElement.querySelector('.unlock-post-btn');

        if (!currentTeamData) return; 
        const correctUnlockCode = POST_UNLOCK_CODES[`post${postNum}`];
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }

        if (!userAnswer) { 
            if(feedbackElement) { feedbackElement.textContent = 'Skriv ankomstkoden!'; feedbackElement.classList.add('error', 'shake'); }
            if(unlockInput) { unlockInput.classList.add('shake'); setTimeout(() => unlockInput.classList.remove('shake'), 400); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            return;
        }

        if (userAnswer.toUpperCase() === correctUnlockCode.toUpperCase() || userAnswer.toUpperCase() === 'ÅPNE') {
            if(feedbackElement) { feedbackElement.textContent = 'Post låst opp!'; feedbackElement.classList.add('success'); }
            if (unlockInput) unlockInput.disabled = true;
            if (unlockButton) unlockButton.disabled = true;
            if (!currentTeamData.unlockedPosts) currentTeamData.unlockedPosts = {};
            currentTeamData.unlockedPosts[`post${postNum}`] = true;
            if (!currentTeamData.taskAttempts[`post${postNum}`]) currentTeamData.taskAttempts[`post${postNum}`] = 0;
            saveState();
            setTimeout(() => { resetPageUI(`post-${postNum}-page`); updateScoreDisplay(); }, 800);
        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil ankomstkode.'; feedbackElement.classList.add('error', 'shake'); }
            if(unlockInput) { unlockInput.classList.add('shake'); setTimeout(() => unlockInput.classList.remove('shake'), 400); unlockInput.focus(); unlockInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }
    function handleFinishCodeUnlock(userAnswer) { 
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const feedbackElement = document.getElementById('feedback-unlock-finish');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');

        if (!currentTeamData) return; 
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }
        if (!userAnswer) { 
             if(feedbackElement) { feedbackElement.textContent = 'Skriv målkoden!'; feedbackElement.classList.add('error', 'shake'); }
            if(finishUnlockInput) { finishUnlockInput.classList.add('shake'); setTimeout(() => finishUnlockInput.classList.remove('shake'), 400); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            return;
        }

        if (userAnswer.toUpperCase() === FINISH_UNLOCK_CODE.toUpperCase() || userAnswer.toUpperCase() === 'ÅPNE') {
            if(feedbackElement) { feedbackElement.textContent = 'Målgang registrert! Gratulerer!'; feedbackElement.classList.add('success'); }
            if (finishUnlockInput) finishUnlockInput.disabled = true;
            if (finishUnlockButton) finishUnlockButton.disabled = true;

            currentTeamData.endTime = Date.now();
            if (currentTeamData.startTime) {
                currentTeamData.totalTimeSeconds = Math.round((currentTeamData.endTime - currentTeamData.startTime) / 1000);
            }
            saveState(); stopContinuousUserPositionUpdate(); 
            setTimeout(() => { showRebusPage('finale-page'); }, 1200);
        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil målkode.'; feedbackElement.classList.add('error', 'shake'); }
            if(finishUnlockInput) { finishUnlockInput.classList.add('shake'); setTimeout(() => finishUnlockInput.classList.remove('shake'), 400); finishUnlockInput.focus(); finishUnlockInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }
    function proceedToNextPostOrFinish() { 
        saveState(); 
        if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            currentTeamData.currentPostArrayIndex++;
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                setTimeout(() => {
                    showRebusPage(`post-${nextPostGlobalId}-page`);
                    if (map) updateMapMarker(nextPostGlobalId, false);
                }, 1200);
            } else { 
                currentTeamData.atFinishLineInput = true; saveState();
                showRebusPage('finale-page'); if (map) updateMapMarker(null, true);
            }
        } else { 
            currentTeamData.atFinishLineInput = true; saveState();
            setTimeout(() => {
                showRebusPage('finale-page'); if (map) updateMapMarker(null, true); 
            }, 1200);
        }
    }
    function handleTaskCheck(postNum, userAnswer) { 
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if(!pageElement) return;
        const taskInput = pageElement.querySelector('.post-task-input');
        const feedbackElement = pageElement.querySelector('.feedback-task');
        const attemptCounterElement = pageElement.querySelector('.attempt-counter');
        const taskButton = pageElement.querySelector('.check-task-btn');

        if (!currentTeamData) { 
            if(feedbackElement) { feedbackElement.textContent = 'Feil: Lag ikke startet.'; feedbackElement.className = 'feedback feedback-task error'; }
            return;
        }
        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`];
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-task'; feedbackElement.textContent = '';}

        if (!userAnswer) { 
            if(feedbackElement) { feedbackElement.textContent = 'Svar på oppgaven!'; feedbackElement.classList.add('error', 'shake'); }
            if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => taskInput.classList.remove('shake'), 400); }
             setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            return;
        }
        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');
        
        if (currentTeamData.taskAttempts[`post${postNum}`] === undefined) { 
            currentTeamData.taskAttempts[`post${postNum}`] = 0;
        }
        
        if (isCorrect) {
            if(feedbackElement) { feedbackElement.textContent = userAnswer.toUpperCase() === 'FASIT' ? 'FASIT godkjent! (Ingen poeng)' : 'Korrekt svar! Bra jobba!'; feedbackElement.classList.add('success');}
            if (taskInput) taskInput.disabled = true;
            if(taskButton) taskButton.disabled = true;

            if (userAnswer.toUpperCase() !== 'FASIT') {
                let pointsAwarded = POINTS_PER_CORRECT_TASK - ((currentTeamData.taskAttempts[`post${postNum}`] || 0) * 2);
                pointsAwarded = Math.max(1, pointsAwarded);
                currentTeamData.score += pointsAwarded;
            }
            updateScoreDisplay();
            if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                currentTeamData.completedGlobalPosts[`post${postNum}`] = true;
                currentTeamData.completedPostsCount++;
            }
            proceedToNextPostOrFinish(); 
        } else { 
            currentTeamData.taskAttempts[`post${postNum}`]++; updateScoreDisplay();
            const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
            if (attemptCounterElement) attemptCounterElement.textContent = `Feil svar. Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : 0}`;
            if(feedbackElement){ feedbackElement.textContent = 'Feil svar, prøv igjen!'; feedbackElement.classList.add('error', 'shake'); }
            if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => { if(taskInput) taskInput.classList.remove('shake'); }, 400); taskInput.focus(); taskInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);

            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                if(feedbackElement) { feedbackElement.textContent = `Ingen flere forsøk. Går videre... (0 poeng)`; feedbackElement.className = 'feedback feedback-task error'; }
                if (taskInput) taskInput.disabled = true; if(taskButton) taskButton.disabled = true;
                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++;
                }
                proceedToNextPostOrFinish(); 
            } else { saveState(); }
        }
    }
    function updateUIAfterLoad() { 
        if (!currentTeamData) { resetAllPostUIs(); return; }
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            if (document.getElementById(`post-${i}-page`)) resetPageUI(`post-${i}-page`);
        }
        resetPageUI('finale-page'); 
        if (currentTeamData.score !== undefined) updateScoreDisplay();
    }

    // === EVENT LISTENERS ===
    console.log("DEBUG_V19: Setting up event listeners...");

    if (startWithTeamCodeButton && teamCodeInput) {
        startWithTeamCodeButton.addEventListener('click', () => {
            initializeTeam(teamCodeInput.value);
        });
        console.log("DEBUG_V19: Event listener for startWithTeamCodeButton ADDED.");
    } else {
        console.error("DEBUG_V19: FAILED to add listener for startWithTeamCodeButton (button or input missing).");
    }

    if (teamCodeInput) { 
        teamCodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                if (startWithTeamCodeButton && !startWithTeamCodeButton.disabled) {
                    console.log("DEBUG_V19: Enter pressed in teamCodeInput, clicking start button.");
                    startWithTeamCodeButton.click();
                }
            }
        });
        console.log("DEBUG_V19: Event listener for teamCodeInput (keypress) ADDED.");
    } else {
         console.error("DEBUG_V19: FAILED to add keypress listener for teamCodeInput (input missing).");
    }

    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('unlock-post-btn') && !target.disabled) { 
                const postNum = target.getAttribute('data-post');
                console.log(`DEBUG_V19: Unlock button for post ${postNum} clicked via delegation.`);
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const unlockInput = pageElement.querySelector('.post-unlock-input');
                    if(unlockInput) handlePostUnlock(postNum, unlockInput.value.trim().toUpperCase());
                }
            } else if (target.classList.contains('check-task-btn') && !target.disabled) { 
                const postNum = target.getAttribute('data-post');
                console.log(`DEBUG_V19: Check task button for post ${postNum} clicked via delegation.`);
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const taskInput = pageElement.querySelector('.post-task-input');
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase());
                }
            }
        });
        console.log("DEBUG_V19: Click event listener for rebusContentElement (delegation) ADDED.");

        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-unlock-input') && !target.disabled) { 
                    event.preventDefault();
                    const postPage = target.closest('.page');
                    if (postPage) {
                        const postNum = postPage.id.split('-')[1];
                        const unlockButton = postPage.querySelector(`.unlock-post-btn[data-post="${postNum}"]`);
                        if (unlockButton && !unlockButton.disabled) unlockButton.click();
                    }
                } else if (target.classList.contains('post-task-input') && !target.disabled) { 
                    event.preventDefault();
                     const postPage = target.closest('.page');
                    if (postPage) {
                        const postNum = postPage.id.split('-')[1];
                        const taskButton = postPage.querySelector(`.check-task-btn[data-post="${postNum}"]`);
                        if (taskButton && !taskButton.disabled) taskButton.click();
                    }
                }
            }
        });
        console.log("DEBUG_V19: Keypress event listener for rebusContentElement (delegation) ADDED.");
    } else {
        console.error("DEBUG_V19: rebusContentElement NOT FOUND. Failed to add delegated listeners.");
    }

    const finishUnlockButton = document.getElementById('finish-unlock-btn');
    if (finishUnlockButton) {
        finishUnlockButton.addEventListener('click', () => {
            if (finishUnlockButton.disabled) return; 
            console.log("DEBUG_V19: Finish unlock button clicked.");
            const finishInput = document.getElementById('finish-unlock-input');
            if(finishInput) handleFinishCodeUnlock(finishInput.value.trim().toUpperCase());
        });
        console.log("DEBUG_V19: Event listener for finishUnlockButton ADDED.");
    } else { console.error("DEBUG_V19: finishUnlockButton NOT FOUND."); }

    const finishUnlockInput = document.getElementById('finish-unlock-input');
    if(finishUnlockInput){
        finishUnlockInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !finishUnlockInput.disabled) { 
                event.preventDefault();
                const associatedButton = document.getElementById('finish-unlock-btn');
                if (associatedButton && !associatedButton.disabled) associatedButton.click();
            }
        });
        console.log("DEBUG_V19: Event listener for finishUnlockInput (keypress) ADDED.");
    } else { console.error("DEBUG_V19: finishUnlockInput NOT FOUND."); }
    
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => { 
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                showTabContent(tabId);
                if (tabId === 'map' && map && currentTeamData) {
                    let targetLocation = null; let zoomLevel = 17;
                    if (currentTeamData.atFinishLineInput || currentTeamData.endTime) { 
                        targetLocation = FINISH_LOCATION; zoomLevel = 18; 
                    } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
                        const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                        targetLocation = POST_LOCATIONS[currentPostGlobalId - 1];
                    }
                    if (targetLocation) {
                        let bounds = new google.maps.LatLngBounds();
                        bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));
                        if (userPositionMarker && userPositionMarker.getPosition()) {
                             bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds);
                             if (map.getZoom() > 18) map.setZoom(18); 
                        } else {
                            map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel);
                        }
                    } else if (userPositionMarker && userPositionMarker.getPosition()){ 
                         map.panTo(userPositionMarker.getPosition()); map.setZoom(17);
                    } else { map.panTo(START_LOCATION); map.setZoom(17); }
                }
            });
        });
        console.log(`DEBUG_V19: Event listeners for ${tabButtons.length} tabButtons ADDED.`);
    } else { console.warn("DEBUG_V19: No tabButtons found."); }

    if (devResetButtons.length > 0 ) {
        devResetButtons.forEach(button => { 
            button.addEventListener('click', () => {
                if (confirm("Nullstille rebusen? All fremgang for aktivt lag vil bli slettet.")) {
                    clearState(); showRebusPage('intro-page'); showTabContent('rebus'); 
                    if (teamCodeInput) teamCodeInput.disabled = false; 
                    if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
                }
            });
        });
        console.log(`DEBUG_V19: Event listeners for ${devResetButtons.length} devResetButtons ADDED.`);
    } else { console.warn("DEBUG_V19: No devResetButtons found."); }
    console.log("DEBUG_V19: All standard event listeners setup attempted.");

    // === INITALISERING VED LASTING AV SIDE ===
    console.log("DEBUG_V19: Starting initial page load sequence...");
    if (DEV_MODE_NO_GEOFENCE) {
        console.warn("DEBUG_V19: DEV MODE ACTIVE - Geofence is OFF.");
        if (geofenceFeedbackElement) { 
            geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert.";
            geofenceFeedbackElement.className = 'geofence-info dev-mode';
            geofenceFeedbackElement.style.display = 'block';
        }
    }

    if (loadState()) {
        console.log("DEBUG_V19: Loaded state successfully.");
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
        console.log("DEBUG_V19: No valid state loaded or new user. Showing intro page.");
        showTabContent('rebus'); 
        showRebusPage('intro-page'); 
        resetAllPostUIs();
    }
    console.log("DEBUG_V19: Initial page setup complete.");
});
/* Version: #19 */
