/* Version: #22 */

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
const GEOFENCE_RADIUS = 25; 
const DEV_MODE_NO_GEOFENCE = false; 
const FINISH_UNLOCK_CODE = "FASTLAND24"; 

const START_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Start: Fastland", name: "Start: Fastland" };
const FINISH_LOCATION = { lat: 60.79823355219047, lng: 10.674827839521527, title: "Mål: Fastland", name: "Mål: Fastland" };

const POST_LOCATIONS = [
    { lat: 60.7962307499199, lng: 10.667771549607588, title: "Post 1", name: "Bassengparken"},
    { lat: 60.7941862597763, lng: 10.656946793729826, title: "Post 2", name: "Hunn Kirke"},
    { lat: 60.80121161360927, lng: 10.645440903323017, title: "Post 3", name: "Lavvoen Øverby"},
    { lat: 60.80469643634315, lng: 10.646298022954033, title: "Post 4", name: "Åttekanten på Eiktunet"},
    { lat: 60.803527350299944, lng: 10.66552015165931, title: "Post 5", name: "Krysset Øverbyvegen/Prost Bloms Gate"},
    { lat: 60.80202682020165, lng: 10.673687047853834, title: "Post 6", name: "Hunn Gravlund"},
    { lat: 60.79987829729577, lng: 10.684058486843965, title: "Post 7", name: "Kunstgresset Gjøvik Stadion"},
    { lat: 60.794004447513956, lng: 10.692558505369421, title: "Post 8", name: "Scenen Gjøvik Gård"},
    { lat: 60.793249975246106, lng: 10.685006947085599, title: "Post 9", name: "Gjøvik Olympiske Fjellhall"},
    { lat: 60.793880419179715, lng: 10.678003145501888, title: "Post 10", name: "Hovdetoppen Restaurant"}
];

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
function formatTimeFromMs(ms) {
    if (ms === null || ms === undefined || ms < 0) return "00:00";
    return formatTime(Math.round(ms / 1000));
}

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { 
    mapElement = document.getElementById('dynamic-map-container');
    if (!mapElement) { setTimeout(window.initMap, 500); return; }
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ];
    map = new google.maps.Map(mapElement, {
        center: START_LOCATION, zoom: 15, 
        mapTypeId: google.maps.MapTypeId.HYBRID, 
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
        } else { updateMapMarker(null, true); }
        startContinuousUserPositionUpdate(); 
    }
    console.log("Skolerebus Kart initialisert");
}

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false) { 
    if (!map) { console.warn("Kart ikke initialisert for updateMapMarker."); return; }
    clearMapMarker(); clearFinishMarker();
    let location, markerTitle, markerIconUrl;
    if (isFinalTarget) {
        location = FINISH_LOCATION; markerTitle = FINISH_LOCATION.title;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        finishMarker = new google.maps.Marker({ position: { lat: location.lat, lng: location.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } });
    } else {
        if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) { console.warn("Ugyldig postGlobalId for updateMapMarker:", postGlobalId); return; }
        location = POST_LOCATIONS[postGlobalId - 1];
        markerTitle = `Neste: ${location.name || location.title}`;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
        currentMapMarker = new google.maps.Marker({ position: { lat: location.lat, lng: location.lng }, map: map, title: markerTitle, animation: google.maps.Animation.DROP, icon: { url: markerIconUrl } });
    }
    if(location) { map.panTo({ lat: location.lat, lng: location.lng }); if (map.getZoom() < 15) map.setZoom(15); }
}
function clearMapMarker() { if (currentMapMarker) { currentMapMarker.setMap(null); currentMapMarker = null; } }
function clearFinishMarker() { if (finishMarker) { finishMarker.setMap(null); finishMarker = null; } }
function handleGeolocationError(error) { 
    let msg = "Posisjonsfeil: ";
    switch (error.code) {
        case error.PERMISSION_DENIED: msg += "Du må tillate posisjonstilgang."; break;
        case error.POSITION_UNAVAILABLE: msg += "Posisjonen din er utilgjengelig."; break;
        case error.TIMEOUT: msg += "Tok for lang tid å hente posisjonen."; break;
        default: msg += "Ukjent GPS-feil.";
    }
    console.warn(msg);
    if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = msg; geofenceFeedbackElement.className = 'geofence-error permanent'; geofenceFeedbackElement.style.display = 'block'; }
}

// === KARTPOSISJON OG GEOFENCE FUNKSJONER ===
function updateUserPositionOnMap(position) { 
    if (!map) return;
    const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (userPositionMarker) { userPositionMarker.setPosition(userPos); } 
    else { userPositionMarker = new google.maps.Marker({ position: userPos, map: map, title: "Din Posisjon", icon: { path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 2, strokeColor: "white" } }); }
}

function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten", canInteractWithTarget = false) {
    if (!geofenceFeedbackElement) return;
    if (isFullyCompleted || (!currentTeamData)) { geofenceFeedbackElement.style.display = 'none'; return; }
    
    geofenceFeedbackElement.style.display = 'block';
    geofenceFeedbackElement.classList.remove('permanent'); 

    if (DEV_MODE_NO_GEOFENCE) { 
        geofenceFeedbackElement.textContent = `DEV MODE: Geofence deaktivert. (Reell avstand: ${distance !== null ? Math.round(distance) + 'm' : 'ukjent'})`;
        geofenceFeedbackElement.className = 'geofence-info dev-mode'; return; 
    }
    if (distance === null) { geofenceFeedbackElement.textContent = `Leter etter ${targetName.toLowerCase()}...`; geofenceFeedbackElement.className = 'geofence-info'; return; }

    const distanceFormatted = Math.round(distance);
    if (isEffectivelyWithinRange) {
        if (canInteractWithTarget) {
             geofenceFeedbackElement.textContent = targetName.toLowerCase().includes("mål") 
                ? `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Tast inn målkoden!`
                : `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m). Her er oppgaven!`;
        } else { 
            geofenceFeedbackElement.textContent = `Du er ved ${targetName.toLowerCase()} (${distanceFormatted}m).`;
        }
        geofenceFeedbackElement.className = 'geofence-success';
    } else {
        geofenceFeedbackElement.textContent = `Gå til ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`;
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

    if (currentTeamData.completedPostsCount >= TOTAL_POSTS) {
        targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale-page', globalId: 'finish', name: FINISH_LOCATION.name };
        isCurrentTargetTheFinishLine = true;
    } else { 
        const currentGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        if (currentGlobalId && POST_LOCATIONS[currentGlobalId - 1]) {
            const postData = POST_LOCATIONS[currentGlobalId - 1];
            targetLocationDetails = { location: postData, pageId: `post-${currentGlobalId}-page`, globalId: currentGlobalId, name: postData.name || `Post ${currentGlobalId}` };
        }
    }

    if (!targetLocationDetails) { updateGeofenceFeedback(null, false, false, null, false); return; }

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS;
    const isEffectivelyWithinRange = DEV_MODE_NO_GEOFENCE || isWithinRange; 
    
    let canCurrentlyInteract = false; 

    if (isCurrentTargetTheFinishLine) {
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');
        currentTeamData.canEnterFinishCode = isEffectivelyWithinRange; 
        if(finishUnlockInput) finishUnlockInput.disabled = !isEffectivelyWithinRange;
        if(finishUnlockButton) finishUnlockButton.disabled = !isEffectivelyWithinRange;
        canCurrentlyInteract = isEffectivelyWithinRange;
    } else { 
        const postGlobalId = targetLocationDetails.globalId;
        const isPostAlreadyUnlocked = currentTeamData.unlockedPosts[`post${postGlobalId}`];

        if (isEffectivelyWithinRange && !isPostAlreadyUnlocked) {
            currentTeamData.unlockedPosts[`post${postGlobalId}`] = true;
            saveState();
            resetPageUI(targetLocationDetails.pageId); 
            canCurrentlyInteract = true; 
        } else if (isPostAlreadyUnlocked) {
            canCurrentlyInteract = false; 
        }
    }
    updateGeofenceFeedback(distance, isEffectivelyWithinRange, false, targetLocationDetails.name, canCurrentlyInteract);
}

function startContinuousUserPositionUpdate() { 
    if (!navigator.geolocation) { console.warn("Geolocation ikke støttet."); return; }
    if (mapPositionWatchId !== null) return;
    console.log("Starter kontinuerlig GPS posisjonssporing.");
    mapPositionWatchId = navigator.geolocation.watchPosition( handlePositionUpdate,
        (error) => { handleGeolocationError(error); if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) {} },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
}
function stopContinuousUserPositionUpdate() { 
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        console.log("Stoppet kontinuerlig GPS sporing.");
        updateGeofenceFeedback(null, false, true, null, false); 
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG_V22: DOMContentLoaded event fired."); // Endret versjonsnummer i logg
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

    if (!rebusContentElement) console.error("DEBUG_V22: rebusContentElement is NULL!");

    const TEAM_CONFIG = {
        "LAG1": { name: "Lag 1", postSequence: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        "LAG2": { name: "Lag 2", postSequence: [2, 3, 4, 5, 6, 7, 8, 9, 10, 1] },
        "LAG3": { name: "Lag 3", postSequence: [3, 4, 2, 5, 6, 7, 8, 9, 10, 1] }, // OPPDATERT
        "LAG4": { name: "Lag 4", postSequence: [4, 3, 2, 5, 6, 7, 8, 9, 10, 1] }, // OPPDATERT
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

        if (globalPostId === null || globalPostId === undefined || globalPostId === 'finish') return;
        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) titleElement.textContent = `Post ${teamPostNumber}/${TOTAL_POSTS}: ${postName}`;
        if (postInfoElement) postInfoElement.textContent = `Bruk kartet for å finne ${postName}. Når du er nær nok, vil oppgaven vises her.`;
        if (taskTitleElement) taskTitleElement.textContent = `Oppgave: ${postName}`;
        if (taskQuestionElement) {
            taskQuestionElement.textContent = `Her kommer oppgaven for ${postName}. (Svar med fasit: ${CORRECT_TASK_ANSWERS['post'+globalPostId]})`;
        }
    }

    function displayFinalResults() {
        console.log("DEBUG_V22: Displaying final results.");
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
        console.log(`DEBUG_V22: --- showRebusPage CALLED with pageId: '${pageId}' ---`);
        pages = document.querySelectorAll('#rebus-content .page');
        if (!pages || pages.length === 0) { console.error("DEBUG_V22: CRITICAL - 'pages' NodeList is EMPTY!"); return; }

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
            }
        }
        resetPageUI(pageId); 
        if (currentTeamData && pageId !== 'intro-page') { updateScoreDisplay(); } 
        else if (scoreDisplayElement) { scoreDisplayElement.style.display = 'none'; }
        
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
        console.log(`DEBUG_V22: --- showRebusPage COMPLETED for pageId: '${pageId}' ---`);
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
                    typeof currentTeamData.taskCompletionTimes === 'undefined' || 
                    typeof currentTeamData.canEnterFinishCode === 'undefined' 
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
        if (geofenceFeedbackElement) { geofenceFeedbackElement.style.display = 'none'; geofenceFeedbackElement.textContent = ''; geofenceFeedbackElement.className = ''; }
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
        const postNum = postNumberMatch[1];

        const postInfoSection = pageElement.querySelector('.post-info-section'); 
        const taskSection = pageElement.querySelector('.post-task-section');
        const taskInput = pageElement.querySelector('.post-task-input');
        const taskButton = pageElement.querySelector('.check-task-btn');
        const taskFeedback = pageElement.querySelector('.feedback-task');
        const attemptCounterElement = pageElement.querySelector('.attempt-counter');

        if(attemptCounterElement) attemptCounterElement.textContent = '';
        const isPostUnlocked = currentTeamData?.unlockedPosts?.[`post${postNum}`]; 
        const isTaskCompleted = currentTeamData?.completedGlobalPosts?.[`post${postNum}`];

        if (postInfoSection && taskSection) {
            if (isTaskCompleted) { 
                if(postInfoSection) postInfoSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = true; } 
                if (taskButton) taskButton.disabled = true;
                if (taskFeedback) { taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success'; }
            } else if (isPostUnlocked) { 
                if(postInfoSection) postInfoSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = false; taskInput.value = ''; } 
                if (taskButton) taskButton.disabled = false;
                if (taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task'; }
                if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`;
                } else if (attemptCounterElement) { attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`; }
            } else { 
                if(postInfoSection) postInfoSection.style.display = 'block';
                taskSection.style.display = 'none';
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
                canEnterFinishCode: false 
            };
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

    function handleTaskCheck(postNum, userAnswer) { 
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if(!pageElement) return;
        const taskInput = pageElement.querySelector('.post-task-input');
        const feedbackElement = pageElement.querySelector('.feedback-task');
        const taskButton = pageElement.querySelector('.check-task-btn');

        if (!currentTeamData) { if(feedbackElement) { feedbackElement.textContent = 'Feil: Lag ikke startet.'; feedbackElement.className = 'feedback feedback-task error'; } return; }
        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`];
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-task'; feedbackElement.textContent = '';}

        if (!userAnswer) { 
            if(feedbackElement) { feedbackElement.textContent = 'Svar på oppgaven!'; feedbackElement.classList.add('error', 'shake'); }
            if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => taskInput.classList.remove('shake'), 400); }
             setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            return;
        }
        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');
        
        if (currentTeamData.taskAttempts[`post${postNum}`] === undefined) { currentTeamData.taskAttempts[`post${postNum}`] = 0; }
        
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
                currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); 
            }
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
                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true; currentTeamData.completedPostsCount++;
                    currentTeamData.taskCompletionTimes['post' + postNum] = Date.now(); 
                }
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
                console.error("DEBUG_V22: Ulogisk tilstand i proceedToNextPostOrFinish. Går til finale.");
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
        console.log("DEBUG_V22: handleFinishCodeInput called with:", userAnswer);
        const feedbackElement = document.getElementById('feedback-unlock-finish');
        const finishCodeInput = document.getElementById('finish-unlock-input');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');

        if (!currentTeamData || !currentTeamData.canEnterFinishCode) {
            if(feedbackElement) { feedbackElement.textContent = 'Du må være ved målet for å taste kode.'; feedbackElement.className = 'feedback feedback-unlock error';}
            return;
        }
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }
        if (!userAnswer) { 
            if(feedbackElement) { feedbackElement.textContent = 'Skriv målkoden!'; feedbackElement.classList.add('error', 'shake'); }
            if(finishCodeInput) { finishCodeInput.classList.add('shake'); setTimeout(() => finishCodeInput.classList.remove('shake'), 400); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
            return;
        }

        if (userAnswer.toUpperCase() === FINISH_UNLOCK_CODE.toUpperCase() || (DEV_MODE_NO_GEOFENCE && userAnswer.toUpperCase() === 'ÅPNE')) {
            if(feedbackElement) { feedbackElement.textContent = 'Målgang registrert! Gratulerer!'; feedbackElement.classList.add('success'); }
            if (finishCodeInput) finishCodeInput.disabled = true;
            if (finishUnlockButton) finishUnlockButton.disabled = true;

            currentTeamData.endTime = Date.now();
            if (currentTeamData.startTime) { currentTeamData.totalTimeSeconds = Math.round((currentTeamData.endTime - currentTeamData.startTime) / 1000); }
            saveState();
            stopContinuousUserPositionUpdate(); 
            updateGeofenceFeedback(null, false, true, null, false); 
            
            setTimeout(() => { showRebusPage('finale-page'); }, 1200);
        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil målkode. Prøv igjen!'; feedbackElement.classList.add('error', 'shake'); }
            if(finishCodeInput) { finishCodeInput.classList.add('shake'); setTimeout(() => finishCodeInput.classList.remove('shake'), 400); finishCodeInput.focus(); finishCodeInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton && teamCodeInput) {
        startWithTeamCodeButton.addEventListener('click', () => { initializeTeam(teamCodeInput.value); });
    }
    if (teamCodeInput) { 
        teamCodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !startWithTeamCodeButton.disabled) { event.preventDefault(); startWithTeamCodeButton.click(); }
        });
    }
    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('check-task-btn') && !target.disabled) { 
                const postNum = target.getAttribute('data-post');
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) { const taskInput = pageElement.querySelector('.post-task-input'); if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase()); }
            }
        });
        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-task-input') && !target.disabled) { 
                    event.preventDefault(); const postPage = target.closest('.page');
                    if (postPage) { const postNum = postPage.id.split('-')[1]; const taskButton = postPage.querySelector(`.check-task-btn[data-post="${postNum}"]`); if (taskButton && !taskButton.disabled) taskButton.click(); }
                }
            }
        });
    }
    const finishButton = document.getElementById('finish-unlock-btn'); 
    if (finishButton) {
        finishButton.addEventListener('click', () => {
            if (finishButton.disabled) return;
            const finishCodeInput = document.getElementById('finish-unlock-input');
            if (finishCodeInput && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(finishCodeInput.value.trim().toUpperCase()); }
        });
    }
    const finishCodeInputElement = document.getElementById('finish-unlock-input');
    if(finishCodeInputElement){
        finishCodeInputElement.addEventListener('keypress', function(event) {
            if (event.key === 'Enter' && !finishCodeInputElement.disabled) { 
                event.preventDefault(); const associatedButton = document.getElementById('finish-unlock-btn');
                if (associatedButton && !associatedButton.disabled && currentTeamData && currentTeamData.canEnterFinishCode) { handleFinishCodeInput(finishCodeInputElement.value.trim().toUpperCase()); }
            }
        });
    }
    tabButtons.forEach(button => { 
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab'); showTabContent(tabId);
            if (tabId === 'map' && map && currentTeamData) {
                let targetLocation = null; let zoomLevel = 15;
                if (currentTeamData.endTime || currentTeamData.completedPostsCount >= TOTAL_POSTS) { targetLocation = FINISH_LOCATION; zoomLevel = 16; }
                else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; targetLocation = POST_LOCATIONS[currentPostGlobalId - 1]; }
                if (targetLocation) {
                    let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));
                    if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); }
                    else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); }
                } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); }
                else { map.panTo(START_LOCATION); map.setZoom(15); }
            }
        });
    });
    devResetButtons.forEach(button => { 
        button.addEventListener('click', () => {
            if (confirm("Nullstille rebusen?")) { clearState(); showRebusPage('intro-page'); showTabContent('rebus'); if (teamCodeInput) teamCodeInput.disabled = false; if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false; }
        });
    });
    
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
    console.log("DEBUG_V22: Initial page setup complete."); // Endret versjonsnummer i logg
});
/* Version: #22 */
