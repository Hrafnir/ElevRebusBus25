/* Version: #14 */

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
    console.log("DEBUG: initMap called.");
    mapElement = document.getElementById('dynamic-map-container');
    if (!mapElement) {
        console.error("DEBUG: Map element #dynamic-map-container not found in initMap!");
        setTimeout(window.initMap, 500);
        return;
    }
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    if (!geofenceFeedbackElement) {
        console.warn("DEBUG: Geofence feedback element #geofence-feedback not found in initMap.");
    }

    const mapStyles = [ { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] } ];
    map = new google.maps.Map(mapElement, {
        center: START_LOCATION, zoom: 17, mapTypeId: google.maps.MapTypeId.HYBRID,
        styles: mapStyles, disableDefaultUI: false, streetViewControl: false, fullscreenControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID]
        }
    });

    console.log("DEBUG: Global currentTeamData in initMap (before potential update):", JSON.parse(JSON.stringify(currentTeamData)));
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
function updateMapMarker(postGlobalId, isFinalTarget = false) { /* ... (uendret fra v13) ... */ 
    if (!map) { console.warn("Kart ikke initialisert for updateMapMarker."); return; }
    clearMapMarker();
    clearFinishMarker();
    let location, markerTitle, markerIconUrl;

    if (isFinalTarget) {
        location = FINISH_LOCATION;
        markerTitle = FINISH_LOCATION.title;
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

function handleGeolocationError(error) { /* ... (uendret fra v13) ... */ 
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
function updateUserPositionOnMap(position) { /* ... (uendret fra v13) ... */ 
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
function updateGeofenceFeedback(distance, isWithinRange, isFullyCompleted, targetName = "posten") { /* ... (uendret fra v13) ... */ 
    if (!geofenceFeedbackElement) return;

    if (isFullyCompleted || (!currentTeamData)) {
        geofenceFeedbackElement.style.display = 'none';
        geofenceFeedbackElement.textContent = '';
        geofenceFeedbackElement.className = ''; 
        return;
    }
    
    geofenceFeedbackElement.style.display = 'block';
    geofenceFeedbackElement.classList.remove('permanent'); 

    if (distance === null) {
         geofenceFeedbackElement.textContent = 'Leter etter neste post...';
         geofenceFeedbackElement.className = 'geofence-info';
         return;
    }

    const distanceFormatted = Math.round(distance);
    if (isWithinRange) {
        geofenceFeedbackElement.textContent = `Du er nær nok ${targetName.toLowerCase()}! (${distanceFormatted}m). Tast inn koden.`;
        geofenceFeedbackElement.className = 'geofence-success';
    } else {
        geofenceFeedbackElement.textContent = `Du må nærmere ${targetName.toLowerCase()}. Avstand: ${distanceFormatted}m. (Krever < ${GEOFENCE_RADIUS}m)`;
        geofenceFeedbackElement.className = 'geofence-error';
    }
}
function handlePositionUpdate(position) { /* ... (uendret fra v13, men sjekk at console.logs her er fjernet hvis de fantes) ... */ 
    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) { 
        updateGeofenceFeedback(null, false, true); 
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
        updateGeofenceFeedback(null, false, false);
        return;
    }

    const userLat = position.coords.latitude;
    const userLng = position.coords.longitude;
    const distance = calculateDistance(userLat, userLng, targetLocationDetails.location.lat, targetLocationDetails.location.lng);
    const isWithinRange = distance <= GEOFENCE_RADIUS;

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
            unlockInput.disabled = !isWithinRange;
            unlockButton.disabled = !isWithinRange;
            if (!isWithinRange && document.activeElement === unlockInput) {
                unlockInput.blur();
            }
        }
    }
    updateGeofenceFeedback(distance, isWithinRange, false, targetLocationDetails.name);
}

function startContinuousUserPositionUpdate() { /* ... (uendret fra v13) ... */ 
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
function stopContinuousUserPositionUpdate() { /* ... (uendret fra v13) ... */ 
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        console.log("Stoppet kontinuerlig GPS sporing.");
        updateGeofenceFeedback(null, false, true); 
    }
}


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG: DOMContentLoaded event fired.");
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    const teamCodeFeedback = document.getElementById('team-code-feedback');
    const pages = document.querySelectorAll('#rebus-content .page');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    
    // DEBUGGING FOR teamCodeInput
    if (teamCodeInput) {
        console.log("DEBUG: teamCodeInput element found in DOMContentLoaded:", teamCodeInput);
        console.log("DEBUG: teamCodeInput initial disabled state:", teamCodeInput.disabled);
    } else {
        console.error("DEBUG: teamCodeInput element NOT FOUND in DOMContentLoaded!");
    }
    if (startWithTeamCodeButton) {
        console.log("DEBUG: startWithTeamCodeButton element found.");
    } else {
        console.error("DEBUG: startWithTeamCodeButton element NOT FOUND.");
    }


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
    function updateScoreDisplay() { /* ... (uendret fra v13) ... */ 
        if (currentTeamData && scoreDisplayElement && currentScoreSpan) {
            currentScoreSpan.textContent = currentTeamData.score;
            scoreDisplayElement.style.display = 'block';
        }
    }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret fra v13) ... */ 
        const titleElement = pageElement.querySelector('.post-title-placeholder');
        const introElement = pageElement.querySelector('.post-intro-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder');
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder');

        if (globalPostId === null || globalPostId === undefined || globalPostId === 'finish') return;

        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) {
            titleElement.textContent = `Post ${teamPostNumber}/${TOTAL_POSTS}: ${postName}`;
        }
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
        console.log("DEBUG: showRebusPage called with pageId:", pageId);
        pages.forEach(page => page.classList.remove('visible'));
        const nextPageElement = document.getElementById(pageId);

        if (nextPageElement) {
            nextPageElement.classList.add('visible');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            // START NYTT FOR DEBUGGING/SIKKERHET
            if (pageId === 'intro-page') {
                const teamCodeInputForIntro = document.getElementById('team-code-input');
                const startButtonForIntro = document.getElementById('start-with-team-code-button');
                if (teamCodeInputForIntro) {
                    console.log("DEBUG: Enabling teamCodeInput in showRebusPage('intro-page'). Current disabled state:", teamCodeInputForIntro.disabled);
                    teamCodeInputForIntro.disabled = false;
                     console.log("DEBUG: teamCodeInput after explicit enable:", teamCodeInputForIntro.disabled);
                } else {
                     console.error("DEBUG: teamCodeInput NOT FOUND in showRebusPage('intro-page')!");
                }
                if (startButtonForIntro) {
                    startButtonForIntro.disabled = false;
                }
            }
            // SLUTT NYTT FOR DEBUGGING/SIKKERHET


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
                    updateGeofenceFeedback(null, false, true); 
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
                    console.warn("Uventet tilstand for finale-page eller manglende teamdata, viser intro.");
                    clearState(); showRebusPage('intro-page'); return;
                }
            }

        } else {
            console.error("Side ikke funnet:", pageId, "Tilbakestiller.");
            clearState(); showRebusPage('intro-page');
        }
    }

    function showTabContent(tabId) { /* ... (uendret fra v13) ... */ 
        tabContents.forEach(content => content.classList.remove('visible'));
        const nextContent = document.getElementById(tabId + '-content');
        if (nextContent) nextContent.classList.add('visible');
        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabId) button.classList.add('active');
        });
    }
    function saveState() { /* ... (uendret fra v13) ... */ 
        if (currentTeamData) localStorage.setItem('activeTeamData_Skolerebus', JSON.stringify(currentTeamData));
        else localStorage.removeItem('activeTeamData_Skolerebus');
    }
    function loadState() { /* ... (uendret fra v13) ... */ 
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
                ) {
                    console.warn("Lagret data er korrupt/utdatert, nullstiller.");
                    clearState(); return false;
                }
                if (typeof currentTeamData.startTime === 'string') currentTeamData.startTime = parseInt(currentTeamData.startTime,10);
                if (currentTeamData.startTime && isNaN(currentTeamData.startTime)) currentTeamData.startTime = null; 

                return true;
            } catch (e) { console.warn("Feil ved parsing av lagret data:", e); clearState(); return false; }
        }
        currentTeamData = null; return false;
    }
    function clearState() { /* ... (uendret fra v13) ... */ 
        localStorage.removeItem('activeTeamData_Skolerebus');
        currentTeamData = null;
        resetAllPostUIs();
        clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); 
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        if (geofenceFeedbackElement) {
            geofenceFeedbackElement.style.display = 'none';
            geofenceFeedbackElement.textContent = '';
            geofenceFeedbackElement.className = '';
        }
        console.log("Tilstand nullstilt.");
    }
    function resetPageUI(pageId) { /* ... (uendret fra v13) ... */ 
        const pageElement = document.getElementById(pageId);
        if (!pageElement) return;

        if (pageId === 'intro-page') { // Viktig: eksplisitt håndtering for intro-siden
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
                if (unlockInput) { unlockInput.disabled = true; unlockInput.value = ''; } 
                if (unlockButton) unlockButton.disabled = true; 
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
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = true; }
                if (taskButton) taskButton.disabled = true;
                if (taskFeedback) { taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success'; }
            } else if (isPostUnlocked) { 
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = false; taskInput.value = ''; }
                if (taskButton) taskButton.disabled = false;
                if (taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task'; }
                if (attemptCounterElement && currentTeamData?.taskAttempts?.[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`;
                } else if (attemptCounterElement) {
                     attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`;
                }
            } else { 
                unlockSection.style.display = 'block';
                taskSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = true; unlockInput.value = ''; } 
                if (unlockButton) unlockButton.disabled = true; 
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
    }
    function resetAllPostUIs() { /* ... (uendret fra v13, men sjekk at den nå kaller den oppdaterte resetPageUI) ... */ 
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

        if(teamCodeInput) teamCodeInput.value = '';
        // Sikre at teamCodeInput er enabled etter en full reset også
        if(teamCodeInput) teamCodeInput.disabled = false; 
        if(startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;

        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }
    function initializeTeam(teamCode) { /* ... (uendret fra v13) ... */ 
        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        if(teamCodeFeedback) { teamCodeFeedback.className = 'feedback'; teamCodeFeedback.textContent = ''; }

        if (config) {
            currentTeamData = {
                ...config, id: teamKey, currentPostArrayIndex: 0, completedPostsCount: 0,
                completedGlobalPosts: {}, unlockedPosts: {}, score: 0, taskAttempts: {},
                startTime: Date.now(), 
                endTime: null,
                totalTimeSeconds: null,
                atFinishLineInput: false 
            };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            saveState();
            resetAllPostUIs();
            clearFinishMarker(); 
            updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}-page`);
            if (map) updateMapMarker(firstPostInSequence, false);
            startContinuousUserPositionUpdate(); 
            console.log(`Team ${currentTeamData.name} startet! Første post: ${firstPostInSequence}`);
        } else {
            if(teamCodeFeedback) {
                teamCodeFeedback.textContent = 'Ugyldig lagkode! (Eks: LAG1)';
                teamCodeFeedback.classList.add('error', 'shake');
            }
            if (teamCodeInput) {
                teamCodeInput.classList.add('shake');
                setTimeout(() => { if(teamCodeFeedback) teamCodeFeedback.classList.remove('shake'); if(teamCodeInput) teamCodeInput.classList.remove('shake'); }, 400);
                teamCodeInput.focus(); teamCodeInput.select();
            }
        }
    }
    function handlePostUnlock(postNum, userAnswer) { /* ... (uendret fra v13) ... */ 
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if (!pageElement) return;
        const unlockInput = pageElement.querySelector('.post-unlock-input');
        const feedbackElement = pageElement.querySelector('.feedback-unlock');
        const unlockButton = pageElement.querySelector('.unlock-post-btn');

        if (!currentTeamData) { /* Feilmelding */ return; }
        const correctUnlockCode = POST_UNLOCK_CODES[`post${postNum}`];
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }

        if (!userAnswer) { 
            if(feedbackElement) { feedbackElement.textContent = 'Skriv ankomstkoden!'; feedbackElement.classList.add('error', 'shake'); }
            if(unlockInput) { unlockInput.classList.add('shake'); setTimeout(() => unlockInput.classList.remove('shake'), 400); }
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
    function handleFinishCodeUnlock(userAnswer) { /* ... (uendret fra v13) ... */ 
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const feedbackElement = document.getElementById('feedback-unlock-finish');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');

        if (!currentTeamData) { return; }
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }
        if (!userAnswer) { 
             if(feedbackElement) { feedbackElement.textContent = 'Skriv målkoden!'; feedbackElement.classList.add('error', 'shake'); }
            if(finishUnlockInput) { finishUnlockInput.classList.add('shake'); setTimeout(() => finishUnlockInput.classList.remove('shake'), 400); }
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
            saveState();
            stopContinuousUserPositionUpdate(); 

            setTimeout(() => {
                showRebusPage('finale-page'); 
            }, 1200);

        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil målkode.'; feedbackElement.classList.add('error', 'shake'); }
            if(finishUnlockInput) { finishUnlockInput.classList.add('shake'); setTimeout(() => finishUnlockInput.classList.remove('shake'), 400); finishUnlockInput.focus(); finishUnlockInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);
        }
    }
    function proceedToNextPostOrFinish() { /* ... (uendret fra v13) ... */ 
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
                console.error("Feil i post-sekvens vs antall fullførte.");
                currentTeamData.atFinishLineInput = true; 
                saveState();
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true);
            }
        } else { 
            currentTeamData.atFinishLineInput = true; 
            saveState();
            setTimeout(() => {
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true); 
            }, 1200);
        }
    }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret fra v13, bare fylt ut manglende feilmeldinger) ... */ 
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
            currentTeamData.taskAttempts[`post${postNum}`]++;
            updateScoreDisplay();
            
            const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
            if (attemptCounterElement) {
                attemptCounterElement.textContent = `Feil svar. Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : 0}`;
            }
            if(feedbackElement){ feedbackElement.textContent = 'Feil svar, prøv igjen!'; feedbackElement.classList.add('error', 'shake'); }
            if(taskInput) { taskInput.classList.add('shake'); setTimeout(() => { if(taskInput) taskInput.classList.remove('shake'); }, 400); taskInput.focus(); taskInput.select(); }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);


            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                if(feedbackElement) { feedbackElement.textContent = `Ingen flere forsøk. Går videre... (0 poeng)`; feedbackElement.className = 'feedback feedback-task error'; }
                if (taskInput) taskInput.disabled = true;
                if(taskButton) taskButton.disabled = true;

                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true;
                    currentTeamData.completedPostsCount++;
                }
                proceedToNextPostOrFinish(); 
            } else {
                 saveState(); 
            }
        }
    }
    function updateUIAfterLoad() { /* ... (uendret fra v13) ... */ 
        if (!currentTeamData) { resetAllPostUIs(); return; }
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            if (document.getElementById(`post-${i}-page`)) resetPageUI(`post-${i}-page`);
        }
        resetPageUI('finale-page'); 
        if (currentTeamData.score !== undefined) updateScoreDisplay();
    }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton && teamCodeInput) { // La til sjekk for teamCodeInput også
        startWithTeamCodeButton.addEventListener('click', () => {
            initializeTeam(teamCodeInput.value);
        });
    }
    if (teamCodeInput) { 
        teamCodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                if (startWithTeamCodeButton) startWithTeamCodeButton.click();
            }
        });
    }

    const rebusContentElement = document.getElementById('rebus-content');
    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('unlock-post-btn')) {
                const postNum = target.getAttribute('data-post');
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const unlockInput = pageElement.querySelector('.post-unlock-input');
                    if(unlockInput) handlePostUnlock(postNum, unlockInput.value.trim().toUpperCase());
                }
            } else if (target.classList.contains('check-task-btn')) {
                const postNum = target.getAttribute('data-post');
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const taskInput = pageElement.querySelector('.post-task-input');
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase());
                }
            }
        });
    }

    const finishUnlockButton = document.getElementById('finish-unlock-btn');
    if (finishUnlockButton) {
        finishUnlockButton.addEventListener('click', () => {
            const finishInput = document.getElementById('finish-unlock-input');
            if(finishInput) handleFinishCodeUnlock(finishInput.value.trim().toUpperCase());
        });
    }
    const finishUnlockInput = document.getElementById('finish-unlock-input');
    if(finishUnlockInput){
        finishUnlockInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                const associatedButton = document.getElementById('finish-unlock-btn');
                if (associatedButton && !associatedButton.disabled) associatedButton.click();
            }
        });
    }
    
    if (rebusContentElement) {
        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-unlock-input')) {
                    event.preventDefault();
                    const postPage = target.closest('.page');
                    if (postPage) {
                        const postNum = postPage.id.split('-')[1];
                        const unlockButton = postPage.querySelector(`.unlock-post-btn[data-post="${postNum}"]`);
                        if (unlockButton && !unlockButton.disabled) unlockButton.click();
                    }
                } else if (target.classList.contains('post-task-input')) {
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
    }


    tabButtons.forEach(button => { 
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            showTabContent(tabId);
            if (tabId === 'map' && map && currentTeamData) {
                let targetLocation = null;
                let zoomLevel = 17;

                if (currentTeamData.atFinishLineInput || currentTeamData.endTime) { // På vei til mål eller ferdig
                    targetLocation = FINISH_LOCATION;
                    zoomLevel = 18; 
                } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { // Vanlig post
                    const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                    targetLocation = POST_LOCATIONS[currentPostGlobalId - 1];
                }
                
                if (targetLocation) {
                    let bounds = new google.maps.LatLngBounds();
                    bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));

                    if (userPositionMarker && userPositionMarker.getPosition()) {
                         bounds.extend(userPositionMarker.getPosition());
                         map.fitBounds(bounds);
                         if (map.getZoom() > 18) map.setZoom(18); 
                    } else {
                        map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));
                        map.setZoom(zoomLevel);
                    }
                } else if (userPositionMarker && userPositionMarker.getPosition()){ 
                     map.panTo(userPositionMarker.getPosition());
                     map.setZoom(17);
                } else { 
                    map.panTo(START_LOCATION); map.setZoom(17);
                }
            }
        });
     });
    devResetButtons.forEach(button => { 
        button.addEventListener('click', () => {
            if (confirm("Nullstille rebusen? All fremgang for aktivt lag vil bli slettet.")) {
                clearState();
                showRebusPage('intro-page');
                showTabContent('rebus'); 
                if (teamCodeInput) { teamCodeInput.disabled = false; } 
                if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
            }
        });
    });

    // === INITALISERING VED LASTING AV SIDE ===
    console.log("DEBUG: Setting up initial page state.");
    if (loadState()) {
        console.log("DEBUG: Loaded state successfully. currentTeamData:", JSON.parse(JSON.stringify(currentTeamData)));
        showTabContent('rebus');
        if (currentTeamData.endTime) { 
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
        } else if (currentTeamData.atFinishLineInput) { 
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); 
        } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) {
                 console.warn("Ugyldig post-ID i lagret state, nullstiller."); clearState(); showRebusPage('intro-page');
            } else {
                showRebusPage(`post-${currentExpectedPostId}-page`);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            }
        } else { 
            currentTeamData.atFinishLineInput = true; saveState(); 
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
        }
        updateUIAfterLoad();
        console.log(`Gjenopprettet tilstand for ${currentTeamData.name}.`);
    } else {
        console.log("DEBUG: No valid state loaded or new user. Showing intro.");
        showTabContent('rebus'); showRebusPage('intro-page'); resetAllPostUIs();
    }
     console.log("DEBUG: Initial page setup complete.");

});
/* Version: #14 */
