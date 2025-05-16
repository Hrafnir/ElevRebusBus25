/* Version: #13 */

// === GLOBALE VARIABLER ===
let map;
let currentMapMarker;
let userPositionMarker;
let mapElement;
let currentTeamData = null;
let mapPositionWatchId = null;
let finishMarker = null;
let geofenceFeedbackElement = null; // For å vise avstand/status til geofence

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10;
const GEOFENCE_RADIUS = 50; // Meter
const FINISH_UNLOCK_CODE = "GRATTIS"; // Ankomstkode for selve målet

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
    const R = 6371e3; // Jordens radius i meter
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Avstand i meter
}

function formatTime(totalSeconds) {
    if (totalSeconds === null || totalSeconds === undefined) return "00:00";
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const paddedHours = String(hours).padStart(2, '0');
    const paddedMinutes = String(minutes).padStart(2, '0');
    const paddedSeconds = String(seconds).padStart(2, '0');

    if (hours > 0) {
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
    } else {
        return `${paddedMinutes}:${paddedSeconds}`;
    }
}

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() {
    mapElement = document.getElementById('dynamic-map-container');
    if (!mapElement) {
        setTimeout(window.initMap, 500);
        return;
    }
    // Få tak i geofence feedback elementet her, da det er utenfor kartet men relatert.
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
        if (currentTeamData.completedPostsCount >= TOTAL_POSTS && !currentTeamData.endTime) { // Venter på målkode
            updateMapMarker(null, true);
        } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            updateMapMarker(currentPostGlobalId, false);
        } else { // Helt ferdig
             updateMapMarker(null, true);
        }
        startContinuousUserPositionUpdate(); // Startes uansett hvis teamdata finnes
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
        geofenceFeedbackElement.className = 'geofence-error permanent'; // Ny klasse for permanent feil
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

function updateGeofenceFeedback(distance, isWithinRange, isFullyCompleted, targetName = "posten") {
    if (!geofenceFeedbackElement) return;

    if (isFullyCompleted || (!currentTeamData)) {
        geofenceFeedbackElement.style.display = 'none';
        geofenceFeedbackElement.textContent = '';
        geofenceFeedbackElement.className = ''; // Nullstill klasser
        return;
    }
    
    geofenceFeedbackElement.style.display = 'block';
    geofenceFeedbackElement.classList.remove('permanent'); // Fjern permanent feilmelding hvis den var der

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

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);

    if (!currentTeamData || !currentTeamData.postSequence || currentTeamData.endTime) { // Hvis rebusen er helt ferdig (endTime satt)
        updateGeofenceFeedback(null, false, true); // Skjul geofence-info
        return;
    }

    let targetLocationDetails = null; // {location: {lat, lng}, pageId: "...", globalId: "...", name: "..."}

    if (currentTeamData.atFinishLineInput) { // Venter på målkode
        targetLocationDetails = { location: FINISH_LOCATION, pageId: 'finale-page', globalId: 'finish', name: "Målet" };
    } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { // Vanlig post
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
        let canInteract = false; // Bestem om input skal være enabled
        if (targetLocationDetails.globalId === 'finish' && !currentTeamData.endTime) { // For målkode, før den er løst
            canInteract = true;
        } else if (targetLocationDetails.globalId !== 'finish' && !currentTeamData.unlockedPosts[`post${targetLocationDetails.globalId}`]) { // For vanlig post, før den er låst opp
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


function startContinuousUserPositionUpdate() {
    if (!navigator.geolocation) { console.warn("Geolocation ikke støttet."); return; }
    if (mapPositionWatchId !== null) return;
    console.log("Starter kontinuerlig GPS posisjonssporing.");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
            handleGeolocationError(error);
            // Ikke stopp automatisk ved PERMISSION_DENIED, brukeren må fikse det.
            // For andre feil, kan det være lurt å stoppe for å spare batteri hvis det er en vedvarende feil.
            if (error.code !== error.PERMISSION_DENIED && error.code !== error.TIMEOUT) { // Timeout kan være midlertidig
                // stopContinuousUserPositionUpdate(); // Vurder dette.
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
        updateGeofenceFeedback(null, false, true); // Skjul/reset geofence-info når sporing stopper.
    }
}


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
    // finalScoreSpan og totalTimeSpan hentes i showRebusPage for finale-siden

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
        // Total tid og sluttpoeng oppdateres i showRebusPage for finale-siden
    }

    function updatePageText(pageElement, teamPostNumber, globalPostId) {
        const titleElement = pageElement.querySelector('.post-title-placeholder');
        const introElement = pageElement.querySelector('.post-intro-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder');
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder');

        // Håndter tilfellet der globalPostId ikke er for en vanlig post (f.eks. under initialisering uten team)
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
            // Du må definere selve oppgavespørsmålene et sted.
            taskQuestionElement.textContent = `Spørsmål for ${postName}. (Fasit: ${CORRECT_TASK_ANSWERS['post'+globalPostId]})`;
        }
    }

    function showRebusPage(pageId) {
        pages.forEach(page => page.classList.remove('visible'));
        const nextPageElement = document.getElementById(pageId);

        if (nextPageElement) {
            nextPageElement.classList.add('visible');
            window.scrollTo({ top: 0, behavior: 'smooth' });

            if (currentTeamData && pageId.startsWith('post-') && pageId !== 'finale-page') {
                const globalPostNumMatch = pageId.match(/post-(\d+)-page/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    updatePageText(nextPageElement, teamPostNum, globalPostNum);
                }
            }
            resetPageUI(pageId); // Nullstiller UI, inkl. disabled state for inputs pga geofence

            if (currentTeamData && pageId !== 'intro-page') { // Vis poengsum alltid unntatt intro
                updateScoreDisplay();
            } else if (scoreDisplayElement) {
                scoreDisplayElement.style.display = 'none';
            }

            // Håndtering av finale-sidens to tilstander
            if (pageId === 'finale-page') {
                const finaleUnlockSection = document.getElementById('finale-unlock-section');
                const finaleCompletedSection = document.getElementById('finale-completed-section');
                const finalScoreSpan = document.getElementById('final-score'); // Inne i completed section
                const totalTimeSpan = document.getElementById('total-time');   // Inne i completed section

                if (currentTeamData && currentTeamData.endTime) { // Helt ferdig
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'block';
                    if(finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
                    if(totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
                        totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
                    }
                    updateGeofenceFeedback(null, false, true); // Skjul geofence info
                } else if (currentTeamData && currentTeamData.atFinishLineInput) { // Venter på målkode
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'block';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                    // Geofence vil håndtere input/knapp for målkode
                } else if (currentTeamData && !currentTeamData.atFinishLineInput && currentTeamData.completedPostsCount >= TOTAL_POSTS) {
                    // Dette er tilfellet hvor alle poster er gjort, men atFinishLineInput er ikke satt. Bør settes av proceed.
                    // For sikkerhets skyld, sett det her og re-kall.
                    currentTeamData.atFinishLineInput = true;
                    saveState();
                    showRebusPage('finale-page'); // Kall på nytt for å få riktig visning
                    return;
                }
                 else { // Uventet tilstand, eller ingen teamdata
                    console.warn("Uventet tilstand for finale-page eller manglende teamdata, viser intro.");
                    clearState(); showRebusPage('intro-page'); return;
                }
            }

        } else {
            console.error("Side ikke funnet:", pageId, "Tilbakestiller.");
            clearState(); showRebusPage('intro-page');
        }
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
                // Utvidet validering for nye felter
                if (!currentTeamData || typeof currentTeamData.completedPostsCount === 'undefined' ||
                    !currentTeamData.postSequence || !currentTeamData.unlockedPosts ||
                    typeof currentTeamData.score === 'undefined' || !currentTeamData.taskAttempts ||
                    currentTeamData.postSequence.length !== TOTAL_POSTS ||
                    typeof currentTeamData.startTime === 'undefined' || // Kan være null hvis lagret før endring
                    typeof currentTeamData.atFinishLineInput === 'undefined' // Kan være false hvis lagret før
                ) {
                    console.warn("Lagret data er korrupt/utdatert, nullstiller.");
                    clearState(); return false;
                }
                // Konverter startTime til number hvis det er en string (kan skje fra eldre JSON)
                if (typeof currentTeamData.startTime === 'string') currentTeamData.startTime = parseInt(currentTeamData.startTime,10);
                if (currentTeamData.startTime && isNaN(currentTeamData.startTime)) currentTeamData.startTime = null; // Hvis parsing feiler

                return true;
            } catch (e) { console.warn("Feil ved parsing av lagret data:", e); clearState(); return false; }
        }
        currentTeamData = null; return false;
    }

    function clearState() {
        localStorage.removeItem('activeTeamData_Skolerebus');
        currentTeamData = null;
        resetAllPostUIs();
        clearMapMarker(); clearFinishMarker();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        stopContinuousUserPositionUpdate(); // Stopper GPS og geofence-feedback
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        // Sørg for at geofence-feedback også skjules
        if (geofenceFeedbackElement) {
            geofenceFeedbackElement.style.display = 'none';
            geofenceFeedbackElement.textContent = '';
            geofenceFeedbackElement.className = '';
        }
        console.log("Tilstand nullstilt.");
    }

    function resetPageUI(pageId) {
        const pageElement = document.getElementById(pageId);
        if (!pageElement) return;

        if (pageId === 'intro-page') return;

        if (pageId === 'finale-page') {
            const unlockSection = document.getElementById('finale-unlock-section');
            const completedSection = document.getElementById('finale-completed-section');
            const unlockInput = document.getElementById('finish-unlock-input');
            const unlockButton = document.getElementById('finish-unlock-btn');
            const unlockFeedback = document.getElementById('feedback-unlock-finish');

            if (currentTeamData && currentTeamData.endTime) { // Helt ferdig
                if(unlockSection) unlockSection.style.display = 'none';
                if(completedSection) completedSection.style.display = 'block';
            } else { // Venter på målkode
                if(unlockSection) unlockSection.style.display = 'block';
                if(completedSection) completedSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = true; unlockInput.value = ''; } // Starter disabled
                if (unlockButton) unlockButton.disabled = true; // Starter disabled
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
            return;
        }

        // For vanlige post-sider
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
            if (isTaskCompleted) { // Oppgave fullført
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = true; }
                if (taskButton) taskButton.disabled = true;
                if (taskFeedback) { taskFeedback.textContent = 'Oppgave fullført!'; taskFeedback.className = 'feedback feedback-task success'; }
            } else if (isPostUnlocked) { // Låst opp, men oppgave ikke fullført
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
            } else { // Ikke låst opp
                unlockSection.style.display = 'block';
                taskSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = true; unlockInput.value = ''; } // Starter disabled
                if (unlockButton) unlockButton.disabled = true; // Starter disabled
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
    }

    function resetAllPostUIs() {
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const pageElement = document.getElementById(`post-${i}-page`);
            if (!pageElement) continue;
            resetPageUI(`post-${i}-page`); // Kaller den generelle reset for hver post

            // Nullstill placeholder-tekster i tillegg, da resetPageUI ikke gjør dette for alle tilfeller.
            const titlePlaceholder = pageElement.querySelector('.post-title-placeholder');
            if(titlePlaceholder) titlePlaceholder.textContent = `Post ${i}: Tittel`;
            const introPlaceholder = pageElement.querySelector('.post-intro-placeholder');
            if(introPlaceholder) introPlaceholder.textContent = "Finn koden...";
            const taskTitlePlaceholder = pageElement.querySelector('.post-task-title-placeholder');
            if(taskTitlePlaceholder) taskTitlePlaceholder.textContent = `Oppgave ${i}`;
            const taskQuestionPlaceholder = pageElement.querySelector('.post-task-question-placeholder');
            if(taskQuestionPlaceholder) taskQuestionPlaceholder.textContent = `Spørsmål for post ${i}.`;
        }
        // Nullstill også finale-siden
        resetPageUI('finale-page');

        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }

    function initializeTeam(teamCode) {
        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        if(teamCodeFeedback) { teamCodeFeedback.className = 'feedback'; teamCodeFeedback.textContent = ''; }

        if (config) {
            currentTeamData = {
                ...config, id: teamKey, currentPostArrayIndex: 0, completedPostsCount: 0,
                completedGlobalPosts: {}, unlockedPosts: {}, score: 0, taskAttempts: {},
                startTime: Date.now(), // Start timer
                endTime: null,
                totalTimeSeconds: null,
                atFinishLineInput: false // Ikke ved mål-input enda
            };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            saveState();
            resetAllPostUIs();
            clearFinishMarker(); // Målmarkør settes evt senere
            updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}-page`);
            if (map) updateMapMarker(firstPostInSequence, false);
            startContinuousUserPositionUpdate(); // Start GPS og geofence-sjekk
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

    function handlePostUnlock(postNum, userAnswer) {
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if (!pageElement) return;
        const unlockInput = pageElement.querySelector('.post-unlock-input');
        const feedbackElement = pageElement.querySelector('.feedback-unlock');
        const unlockButton = pageElement.querySelector('.unlock-post-btn');

        if (!currentTeamData) { /* Feilmelding */ return; }
        const correctUnlockCode = POST_UNLOCK_CODES[`post${postNum}`];
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }

        if (!userAnswer) { /* Feilmelding */ return; }

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
            if(unlockInput) { /* Shake animasjon, focus, select */ }
        }
    }
    
    function handleFinishCodeUnlock(userAnswer) {
        const finishUnlockInput = document.getElementById('finish-unlock-input');
        const feedbackElement = document.getElementById('feedback-unlock-finish');
        const finishUnlockButton = document.getElementById('finish-unlock-btn');

        if (!currentTeamData) { /* ... */ return; }
        if(feedbackElement) { feedbackElement.className = 'feedback feedback-unlock'; feedbackElement.textContent = ''; }
        if (!userAnswer) { /* ... */ return; }

        if (userAnswer.toUpperCase() === FINISH_UNLOCK_CODE.toUpperCase() || userAnswer.toUpperCase() === 'ÅPNE') {
            if(feedbackElement) { feedbackElement.textContent = 'Målgang registrert! Gratulerer!'; feedbackElement.classList.add('success'); }
            if (finishUnlockInput) finishUnlockInput.disabled = true;
            if (finishUnlockButton) finishUnlockButton.disabled = true;

            currentTeamData.endTime = Date.now();
            if (currentTeamData.startTime) {
                currentTeamData.totalTimeSeconds = Math.round((currentTeamData.endTime - currentTeamData.startTime) / 1000);
            }
            // atFinishLineInput er allerede true, men det skader ikke å bekrefte.
            // Vi trenger ikke endre atFinishLineInput her, det er endTime som signaliserer fullført.
            saveState();
            stopContinuousUserPositionUpdate(); // Stopp GPS nå

            setTimeout(() => {
                showRebusPage('finale-page'); // Oppdater UI til "helt ferdig"-visning
            }, 1200);

        } else {
            if(feedbackElement) { feedbackElement.textContent = 'Feil målkode.'; feedbackElement.classList.add('error', 'shake'); }
            if(finishUnlockInput) { /* shake, focus, select */ }
        }
    }


    function proceedToNextPostOrFinish() {
        saveState(); // Lagre før vi potensielt endrer currentPostArrayIndex

        if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            currentTeamData.currentPostArrayIndex++;
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                setTimeout(() => {
                    showRebusPage(`post-${nextPostGlobalId}-page`);
                    if (map) updateMapMarker(nextPostGlobalId, false);
                }, 1200);
            } else { // Skal ikke skje
                console.error("Feil i post-sekvens vs antall fullførte.");
                currentTeamData.atFinishLineInput = true; // Gå til mål som fallback
                saveState();
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true);
            }
        } else { // Alle vanlige poster er fullført
            currentTeamData.atFinishLineInput = true; // Sett flagg for å vise målkode-input
            saveState();
            setTimeout(() => {
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true); // Vis målmarkør
                // GPS fortsetter for geofence på mål
            }, 1200);
        }
    }

    function handleTaskCheck(postNum, userAnswer) {
        // ... (eksisterende logikk for feil input, etc.)
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if(!pageElement) return;
        const taskInput = pageElement.querySelector('.post-task-input');
        const feedbackElement = pageElement.querySelector('.feedback-task');
        const attemptCounterElement = pageElement.querySelector('.attempt-counter');
        const taskButton = pageElement.querySelector('.check-task-btn');

        if (!currentTeamData) { /* ... */ return; }
        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`];
        // ... (feedback reset)

        if (!userAnswer) { /* ... */ return; }
        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');
        // ... (håndter taskAttempts initialisering)
        
        if (isCorrect) {
            // ... (feedback, disable input/button)
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
            proceedToNextPostOrFinish(); // Denne kaller saveState()
        } else { // Feil svar
            currentTeamData.taskAttempts[`post${postNum}`]++;
            updateScoreDisplay();
            // ... (feedback, shake, attempts left)
            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                // ... (feedback, disable input/button)
                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true;
                    currentTeamData.completedPostsCount++;
                }
                proceedToNextPostOrFinish(); // Denne kaller saveState()
            } else {
                 saveState(); // Lagre etter mislykket forsøk
            }
        }
        // saveState() kalles nå inne i proceedToNextPostOrFinish eller etter mislykket forsøk over.
    }

    function updateUIAfterLoad() {
        if (!currentTeamData) { resetAllPostUIs(); return; }
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            if (document.getElementById(`post-${i}-page`)) resetPageUI(`post-${i}-page`);
        }
        resetPageUI('finale-page'); // Sørg for at finale-siden også oppdateres korrekt
        if (currentTeamData.score !== undefined) updateScoreDisplay();
    }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton) { /* ... */ }
    if (teamCodeInput) { /* ... */ }

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
        // ... (keypress listeners for unlock og task inputs) ...
    }

    // Listener for MÅL-knapp (finish-unlock-btn)
    const finishUnlockButton = document.getElementById('finish-unlock-btn');
    if (finishUnlockButton) {
        finishUnlockButton.addEventListener('click', () => {
            const finishInput = document.getElementById('finish-unlock-input');
            if(finishInput) handleFinishCodeUnlock(finishInput.value.trim().toUpperCase());
        });
    }
    // Listener for Enter i MÅL-input
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
    
    // Enter i vanlige unlock/task inputs (bruker event delegation på rebusContentElement)
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


    tabButtons.forEach(button => { /* ... (eksisterende tab-logikk, juster kart sentrering/zoom ved behov) ... */ });
    devResetButtons.forEach(button => { /* ... */ });

    // === INITALISERING VED LASTING AV SIDE ===
    if (loadState()) {
        showTabContent('rebus');
        if (currentTeamData.endTime) { // Helt ferdig
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
            // GPS skal allerede være stoppet
        } else if (currentTeamData.atFinishLineInput) { // Venter på målkode
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate(); // Start GPS for geofence til mål
        } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { // I gang med vanlige poster
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) {
                 console.warn("Ugyldig post-ID i lagret state, nullstiller."); clearState(); showRebusPage('intro-page');
            } else {
                showRebusPage(`post-${currentExpectedPostId}-page`);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            }
        } else { // Alle poster fullført, men ikke ved mål-input enda (skal normalt settes av proceedToNextPost)
            currentTeamData.atFinishLineInput = true; saveState(); // Rett opp tilstand
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true);
            if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
        }
        updateUIAfterLoad();
        console.log(`Gjenopprettet tilstand for ${currentTeamData.name}.`);
    } else {
        showTabContent('rebus'); showRebusPage('intro-page'); resetAllPostUIs();
    }
});
/* Version: #13 */
