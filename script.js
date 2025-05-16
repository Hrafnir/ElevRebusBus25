/* Version: #11 */

// === GLOBALE VARIABLER ===
let map;
let currentMapMarker;
let userPositionMarker;
let mapElement;
let currentTeamData = null;
let mapPositionWatchId = null;
let finishMarker = null;

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 10; // OPPDATERT

const POST_LOCATIONS = [ // OPPDATERT - 8 nye poster lagt til, koordinater er plassholdere
    { lat: 60.81260478331276, lng: 10.673852939210269, title: "Post 1", name: "Startpunktet"},
    { lat: 60.812993, lng: 10.672853, title: "Post 2", name: "Ved flaggstanga"},
    { lat: 60.813200, lng: 10.674000, title: "Post 3", name: "Gamle Eika"}, // Plassholder
    { lat: 60.812800, lng: 10.674500, title: "Post 4", name: "Bibliotekinngangen"}, // Plassholder
    { lat: 60.812300, lng: 10.672500, title: "Post 5", name: "Sykkelstativet"}, // Plassholder
    { lat: 60.813500, lng: 10.673000, title: "Post 6", name: "Kunstverket"}, // Plassholder
    { lat: 60.812000, lng: 10.673800, title: "Post 7", name: "Baksiden av gymsal"}, // Plassholder
    { lat: 60.813800, lng: 10.674200, title: "Post 8", name: "Ved hovedinngang A"}, // Plassholder
    { lat: 60.812500, lng: 10.675000, title: "Post 9", name: "Benken i solveggen"}, // Plassholder
    { lat: 60.814000, lng: 10.672000, title: "Post 10", name: "Fotballbanen"} // Plassholder
];
const START_LOCATION = { lat: 60.8127, lng: 10.6737, title: "Startområde Rebus" }; // Mer generisk
const FINISH_LOCATION = { lat: 60.8124, lng: 10.6734, title: "Mål: Premieutdeling!" }; // Mer generisk

const POST_UNLOCK_HINTS = { // OPPDATERT - Hint for 10 poster, generiske
    1: "Hvor starter eventyret?",
    2: "Høyt og synlig, vaier i vinden.",
    3: "Et tre med historie.",
    4: "Der kunnskap bor.",
    5: "Parkeringsplass for tohjulinger.",
    6: "Noe vakkert å se på.",
    7: "Der baller spretter og svette renner.",
    8: "En av flere veier inn.",
    9: "Et sted å hvile i sola.",
    10: "Der mål scores."
};

const POST_UNLOCK_CODES = { // OPPDATERT - Koder for 10 poster, generiske
    post1: "START",
    post2: "FLAGG",
    post3: "TRE",
    post4: "BOK",
    post5: "SYKKEL",
    post6: "KUNST",
    post7: "BALL",
    post8: "DØR",
    post9: "SOL",
    post10: "MÅL"
};

const CORRECT_TASK_ANSWERS = { // OPPDATERT - Svar for 10 poster, generiske
    post1: "SVARPOST1",
    post2: "SVARPOST2",
    post3: "SVARPOST3",
    post4: "SVARPOST4",
    post5: "SVARPOST5",
    post6: "SVARPOST6",
    post7: "SVARPOST7",
    post8: "SVARPOST8",
    post9: "SVARPOST9",
    post10: "SVARPOST10"
};

const MAX_ATTEMPTS_PER_TASK = 5;
const POINTS_PER_CORRECT_TASK = 10; // Økt poengsum per oppgave, kan justeres

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() {
    mapElement = document.getElementById('dynamic-map-container');
    if (!mapElement) {
        setTimeout(window.initMap, 500);
        return;
    }
    const mapStyles = [
        { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] }
    ];
    map = new google.maps.Map(mapElement, {
        center: START_LOCATION, // Sentrer på startområdet
        zoom: 17, // Litt mer utzoomet som default
        mapTypeId: google.maps.MapTypeId.HYBRID, // Endret default karttype
        styles: mapStyles,
        disableDefaultUI: false,
        streetViewControl: false,
        fullscreenControl: true,
        mapTypeControlOptions: {
            style: google.maps.MapTypeControlStyle.DROPDOWN_MENU,
            mapTypeIds: [google.maps.MapTypeId.SATELLITE, google.maps.MapTypeId.ROADMAP, google.maps.MapTypeId.HYBRID]
        }
    });

    if (currentTeamData && currentTeamData.completedPostsCount < TOTAL_POSTS) {
        const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
        updateMapMarker(currentPostGlobalId, false);
    } else if (currentTeamData && currentTeamData.completedPostsCount >= TOTAL_POSTS) {
        updateMapMarker(null, true);
    }

    if (currentTeamData) {
        startContinuousUserPositionUpdate();
    }
    console.log("Skolerebus Kart initialisert");
}

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false) {
    if (!map) {
        console.warn("Kart ikke initialisert for updateMapMarker.");
        return;
    }
    clearMapMarker();
    clearFinishMarker();

    let location;
    let markerTitle;
    let markerIconUrl;

    if (isFinalTarget) {
        location = FINISH_LOCATION;
        markerTitle = FINISH_LOCATION.title;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'; // Mål-markør
        finishMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: map,
            title: markerTitle,
            animation: google.maps.Animation.DROP,
            icon: { url: markerIconUrl }
        });
    } else {
        if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) {
            console.warn("Ugyldig postGlobalId for updateMapMarker:", postGlobalId);
            return;
        }
        location = POST_LOCATIONS[postGlobalId - 1];
        markerTitle = `Neste: ${location.name || location.title}`;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'; // Post-markør
        currentMapMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: map,
            title: markerTitle,
            animation: google.maps.Animation.DROP,
            icon: { url: markerIconUrl }
        });
    }

    if(location) {
        map.panTo({ lat: location.lat, lng: location.lng });
        if (map.getZoom() < 17) map.setZoom(17);
    }
}

function clearMapMarker() {
    if (currentMapMarker) {
        currentMapMarker.setMap(null);
        currentMapMarker = null;
    }
}

function clearFinishMarker() {
    if (finishMarker) {
        finishMarker.setMap(null);
        finishMarker = null;
    }
}

function handleGeolocationError(error) {
    let msg = "Posisjonsfeil: ";
    switch (error.code) {
        case error.PERMISSION_DENIED:
            msg += "Du må tillate posisjonstilgang i nettleseren din for at kartet skal fungere optimalt.";
            break;
        case error.POSITION_UNAVAILABLE:
            msg += "Posisjonen din er utilgjengelig akkurat nå.";
            break;
        case error.TIMEOUT:
            msg += "Det tok for lang tid å hente posisjonen din.";
            break;
        default:
            msg += "En ukjent feil oppstod med posisjonering.";
    }
    console.warn(msg);
    // Vis feilmelding til brukeren på en mer synlig måte? (Vurderes senere)
}

// === KARTPOSISJON FUNKSJONER ===
function updateUserPositionOnMap(position) {
    if (!map) return;
    const userPos = { lat: position.coords.latitude, lng: position.coords.longitude };
    if (userPositionMarker) {
        userPositionMarker.setPosition(userPos);
    } else {
        userPositionMarker = new google.maps.Marker({
            position: userPos,
            map: map,
            title: "Din Posisjon",
            icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8, // Litt større
                fillColor: "#4285F4", // Google blå
                fillOpacity: 1,
                strokeWeight: 2,
                strokeColor: "white"
            }
        });
    }
}

function handlePositionUpdate(position) {
    updateUserPositionOnMap(position);
}

function startContinuousUserPositionUpdate() {
    if (!navigator.geolocation) {
        console.warn("Geolocation ikke støttet av denne nettleseren.");
        return;
    }
    if (mapPositionWatchId !== null) return; 

    console.log("Starter kontinuerlig GPS posisjonssporing for kart.");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
            handleGeolocationError(error);
            // Ikke stopp automatisk ved alle feil, spesielt ikke PERMISSION_DENIED
            if (error.code !== error.PERMISSION_DENIED) {
                 // stopContinuousUserPositionUpdate(); // Vurder om dette er lurt
            }
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 } // Justerte verdier
    );
}

function stopContinuousUserPositionUpdate() {
    if (mapPositionWatchId !== null) {
        navigator.geolocation.clearWatch(mapPositionWatchId);
        mapPositionWatchId = null;
        console.log("Stoppet kontinuerlig GPS sporing for kart.");
    }
}


document.addEventListener('DOMContentLoaded', () => {
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    const teamCodeFeedback = document.getElementById('team-code-feedback');
    const pages = document.querySelectorAll('#rebus-content .page');
    // unlockPostButtons og checkTaskButtons hentes dynamisk eller via parent pga. mange poster
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button'); // Disse er færre, ok å hente
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    const finalScoreSpan = document.getElementById('final-score');

    // === TEAM OG POST KONFIGURASJON ===
    const TEAM_CONFIG = { // OPPDATERT - 10 lag, roterende postsekvens
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
    // POST_UNLOCK_CODES, CORRECT_TASK_ANSWERS, MAX_ATTEMPTS_PER_TASK, POINTS_PER_CORRECT_TASK er definert globalt øverst.

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() {
        if (currentTeamData && scoreDisplayElement && currentScoreSpan) {
            currentScoreSpan.textContent = currentTeamData.score;
            scoreDisplayElement.style.display = 'block';
        }
        if (finalScoreSpan && currentTeamData) {
            finalScoreSpan.textContent = currentTeamData.score;
        }
    }

    function updatePageText(pageElement, teamPostNumber, globalPostId) {
        const titleElement = pageElement.querySelector('.post-title-placeholder');
        const introElement = pageElement.querySelector('.post-intro-placeholder');
        const taskTitleElement = pageElement.querySelector('.post-task-title-placeholder'); // Nytt for oppgavetittel
        const taskQuestionElement = pageElement.querySelector('.post-task-question-placeholder'); // Nytt for oppgavespørsmål

        const postDetails = POST_LOCATIONS[globalPostId - 1];
        let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;

        if (titleElement) {
            if (teamPostNumber === TOTAL_POSTS) {
                titleElement.textContent = `Siste Post (${teamPostNumber}/${TOTAL_POSTS}): ${postName}`;
            } else {
                titleElement.textContent = `Post ${teamPostNumber} av ${TOTAL_POSTS}: ${postName}`;
            }
        }

        if (introElement) {
            const commonInstruction = "Bruk kartet for å finne posten. Der finner dere en ankomstkode.";
            let specificHint = POST_UNLOCK_HINTS[globalPostId] ? ` Hint for å finne koden: ${POST_UNLOCK_HINTS[globalPostId]}` : "";
            let fullIntroText = `${commonInstruction}${specificHint}`;
            introElement.textContent = fullIntroText;
        }

        // Dynamisk oppdatering av oppgavetittel og spørsmål (generisk eksempel)
        if (taskTitleElement) {
            taskTitleElement.textContent = `Oppgave for ${postName}`;
        }
        if (taskQuestionElement) {
            // Du må definere selve oppgavespørsmålene et sted, f.eks. i POST_LOCATIONS eller en ny konstant
            // Her er et generisk eksempel:
            taskQuestionElement.textContent = `Hva er svaret på oppgaven for ${postName}? (Sjekk koden for korrekt svar: ${CORRECT_TASK_ANSWERS['post'+globalPostId]})`;
            // I en ekte applikasjon vil du hente spørsmålet fra en konfigurasjon basert på globalPostId
        }
    }

    function showRebusPage(pageId) {
        pages.forEach(page => page.classList.remove('visible'));
        const nextPageElement = document.getElementById(pageId);
        if (nextPageElement) {
            nextPageElement.classList.add('visible');
            const container = document.querySelector('.container');
            if (container) window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll til toppen av containeren

            if (currentTeamData && pageId.startsWith('post-')) {
                // Ekstraher globalt postnummer fra pageId, f.eks. 'post-5-page' -> 5
                const globalPostNumMatch = pageId.match(/post-(\d+)-page/);
                if (globalPostNumMatch && globalPostNumMatch[1]) {
                    const globalPostNum = parseInt(globalPostNumMatch[1]);
                    const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                    updatePageText(nextPageElement, teamPostNum, globalPostNum);
                } else {
                    console.warn("Kunne ikke parse globalPostNum fra pageId:", pageId);
                }
            }
            resetPageUI(pageId); 

            if (currentTeamData && pageId !== 'intro-page' && pageId !== 'finale-page') {
                updateScoreDisplay();
            } else if (scoreDisplayElement && pageId !== 'finale-page') { 
                scoreDisplayElement.style.display = 'none';
            }

            if (pageId === 'finale-page' && finalScoreSpan && currentTeamData) {
                finalScoreSpan.textContent = currentTeamData.score;
            }

        } else {
            console.error("Side ikke funnet:", pageId, "Tilbakestiller til startside.");
            clearState(); 
            showRebusPage('intro-page');
        }
    }

    function showTabContent(tabId) {
        tabContents.forEach(content => content.classList.remove('visible'));
        const nextContent = document.getElementById(tabId + '-content');
        if (nextContent) nextContent.classList.add('visible');
        else console.error("Tab-innhold ikke funnet:", tabId + '-content');

        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.getAttribute('data-tab') === tabId) button.classList.add('active');
        });
    }

    function saveState() {
        if (currentTeamData) {
            localStorage.setItem('activeTeamData_Skolerebus', JSON.stringify(currentTeamData)); // Endret nøkkel
        } else {
            localStorage.removeItem('activeTeamData_Skolerebus');
        }
    }

    function loadState() {
        const savedData = localStorage.getItem('activeTeamData_Skolerebus'); // Endret nøkkel
        if (savedData) {
            try {
                currentTeamData = JSON.parse(savedData);
                if (!currentTeamData || typeof currentTeamData.completedPostsCount === 'undefined' ||
                    !currentTeamData.postSequence || !currentTeamData.unlockedPosts ||
                    typeof currentTeamData.score === 'undefined' || !currentTeamData.taskAttempts ||
                    currentTeamData.postSequence.length !== TOTAL_POSTS ) { // Sjekk om postSequence har korrekt lengde
                    console.warn("Lagret data er korrupt eller utdatert, nullstiller.");
                    clearState();
                    return false;
                }
                // Valider at postSequence inneholder gyldige postnumre (1 til TOTAL_POSTS)
                for(const postId of currentTeamData.postSequence) {
                    if (postId < 1 || postId > TOTAL_POSTS) {
                        console.warn("Ugyldig post ID i lagret postSequence. Nullstiller.");
                        clearState();
                        return false;
                    }
                }

                return true;
            } catch (e) {
                console.warn("Feil ved parsing av lagret data:", e);
                clearState();
                return false;
            }
        }
        currentTeamData = null; 
        return false;
    }

    function clearState() {
        localStorage.removeItem('activeTeamData_Skolerebus');
        currentTeamData = null;
        resetAllPostUIs();
        clearMapMarker();
        clearFinishMarker();
        if (userPositionMarker) {
            userPositionMarker.setMap(null);
            userPositionMarker = null;
        }
        stopContinuousUserPositionUpdate();
        if(scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
        console.log("Tilstand nullstilt.");
    }

    function resetPageUI(pageId) {
        if (pageId === 'intro-page' || pageId === 'finale-page') return;

        const postNumberMatch = pageId.match(/post-(\d+)-page/);
        if (!postNumberMatch) return;
        const postNum = postNumberMatch[1]; // Dette er globalt postnummer

        const pageElement = document.getElementById(pageId);
        if (!pageElement) return;

        const unlockSection = pageElement.querySelector('.post-unlock-section');
        const taskSection = pageElement.querySelector('.post-task-section');
        const unlockInput = pageElement.querySelector('.post-unlock-input'); // Mer spesifikk selector
        const unlockButton = pageElement.querySelector('.unlock-post-btn');
        const unlockFeedback = pageElement.querySelector('.feedback-unlock'); // Bruk klasse for generell matching
        const taskInput = pageElement.querySelector('.post-task-input'); // Mer spesifikk selector
        const taskButton = pageElement.querySelector('.check-task-btn');
        const taskFeedback = pageElement.querySelector('.feedback-task'); // Bruk klasse
        const attemptCounterElement = pageElement.querySelector('.attempt-counter'); // Bruk klasse

        if(attemptCounterElement) attemptCounterElement.textContent = '';

        const isPostUnlocked = currentTeamData?.unlockedPosts?.[`post${postNum}`];
        const isTaskCompleted = currentTeamData?.completedGlobalPosts?.[`post${postNum}`];

        if (unlockSection && taskSection) {
            if (isTaskCompleted) {
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = true; /* taskInput.value = 'Fullført'; */ }
                if (taskButton) taskButton.disabled = true;
                if (taskFeedback) {
                    taskFeedback.textContent = 'Oppgave fullført!';
                    taskFeedback.className = 'feedback feedback-task success';
                }
            } else if (isPostUnlocked) {
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = false; taskInput.value = ''; }
                if (taskButton) taskButton.disabled = false;
                if (taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task'; }
                if (attemptCounterElement && currentTeamData && currentTeamData.taskAttempts && currentTeamData.taskAttempts[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : MAX_ATTEMPTS_PER_TASK}`; // Viser maks hvis 0 brukt
                } else if (attemptCounterElement) {
                     attemptCounterElement.textContent = `Forsøk igjen: ${MAX_ATTEMPTS_PER_TASK}`;
                }
            } else { 
                unlockSection.style.display = 'block';
                taskSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = false; unlockInput.value = ''; }
                if (unlockButton) unlockButton.disabled = false;
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
    }

    function resetAllPostUIs() {
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const pageElement = document.getElementById(`post-${i}-page`);
            if (!pageElement) continue;

            const unlockSection = pageElement.querySelector('.post-unlock-section');
            const taskSection = pageElement.querySelector('.post-task-section');
            const unlockInput = pageElement.querySelector('.post-unlock-input');
            const unlockButton = pageElement.querySelector('.unlock-post-btn');
            const unlockFeedback = pageElement.querySelector('.feedback-unlock');
            const taskInput = pageElement.querySelector('.post-task-input');
            const taskButton = pageElement.querySelector('.check-task-btn');
            const taskFeedback = pageElement.querySelector('.feedback-task');
            const attemptCounterElement = pageElement.querySelector('.attempt-counter');

            if(unlockSection) unlockSection.style.display = 'block';
            if(taskSection) taskSection.style.display = 'none';

            if(unlockInput) { unlockInput.value = ''; unlockInput.disabled = false; }
            if(unlockButton) unlockButton.disabled = false;
            if(unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }

            if(taskInput) { taskInput.value = ''; taskInput.disabled = false; }
            if(taskButton) taskButton.disabled = false;
            if(taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback feedback-task'; }
            if(attemptCounterElement) attemptCounterElement.textContent = '';

            // Nullstill placeholder-tekster (eller la updatePageText håndtere dette ved visning)
            const titlePlaceholder = pageElement.querySelector('.post-title-placeholder');
            if(titlePlaceholder) titlePlaceholder.textContent = `Post ${i}: Ankomstkode`;
            const introPlaceholder = pageElement.querySelector('.post-intro-placeholder');
            if(introPlaceholder) introPlaceholder.textContent = "Finn ankomstkoden på stedet for å låse opp oppgaven.";
            const taskTitlePlaceholder = pageElement.querySelector('.post-task-title-placeholder');
            if(taskTitlePlaceholder) taskTitlePlaceholder.textContent = `Oppgave ${i}`;
             const taskQuestionPlaceholder = pageElement.querySelector('.post-task-question-placeholder');
            if(taskQuestionPlaceholder) taskQuestionPlaceholder.textContent = `Spørsmål for post ${i}.`;
        }
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }

    function initializeTeam(teamCode) {
        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        if(teamCodeFeedback) {
            teamCodeFeedback.className = 'feedback'; 
            teamCodeFeedback.textContent = '';
        }

        if (config) {
            currentTeamData = {
                ...config, // Inkluderer name og postSequence
                id: teamKey,
                currentPostArrayIndex: 0,
                completedPostsCount: 0,
                completedGlobalPosts: {}, 
                unlockedPosts: {},       
                score: 0,
                taskAttempts: {}          
            };
            // Initialiser taskAttempts for alle poster i sekvensen til 0
            currentTeamData.postSequence.forEach(postId => {
                currentTeamData.taskAttempts[`post${postId}`] = 0;
            });

            saveState();
            resetAllPostUIs(); 
            clearFinishMarker();
            updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}-page`);
            if (map) updateMapMarker(firstPostInSequence, false);
            else console.warn("Kart ikke klart ved lagstart for å sette markør.");
            startContinuousUserPositionUpdate();
            console.log(`Team ${currentTeamData.name} startet! Første post (globalt): ${firstPostInSequence})`);
        } else {
            if(teamCodeFeedback) {
                teamCodeFeedback.textContent = 'Ugyldig lagkode! Prøv f.eks. LAG1, LAG2 osv.';
                teamCodeFeedback.classList.add('error', 'shake');
            }
            if (teamCodeInput) {
                teamCodeInput.classList.add('shake');
                setTimeout(() => {
                    if(teamCodeFeedback) teamCodeFeedback.classList.remove('shake');
                    if(teamCodeInput) teamCodeInput.classList.remove('shake');
                }, 400);
                teamCodeInput.focus();
                teamCodeInput.select();
            }
        }
    }

    function handlePostUnlock(postNum, userAnswer) { // postNum er globalt postnummer
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if (!pageElement) return;
        const unlockInput = pageElement.querySelector('.post-unlock-input');
        const feedbackElement = pageElement.querySelector('.feedback-unlock');
        const unlockButton = pageElement.querySelector('.unlock-post-btn');


        if (!currentTeamData) {
            console.error("currentTeamData er null i handlePostUnlock");
            if (feedbackElement) {
                feedbackElement.textContent = 'Feil: Lag ikke startet.';
                feedbackElement.className = 'feedback feedback-unlock error';}
            return;
        }

        const correctUnlockCode = POST_UNLOCK_CODES[`post${postNum}`];
        if(feedbackElement) {
            feedbackElement.className = 'feedback feedback-unlock'; 
            feedbackElement.textContent = '';
        }


        if (!userAnswer) {
            if(feedbackElement){
                feedbackElement.textContent = 'Skriv ankomstkoden!';
                feedbackElement.classList.add('error', 'shake');
            }
            if(unlockInput) unlockInput.classList.add('shake');
            setTimeout(() => {
                if(feedbackElement) feedbackElement.classList.remove('shake');
                if(unlockInput) unlockInput.classList.remove('shake');
            }, 400);
            return;
        }

        if (userAnswer.toUpperCase() === correctUnlockCode.toUpperCase() || userAnswer.toUpperCase() === 'ÅPNE') { 
            if(feedbackElement) {
                feedbackElement.textContent = 'Post låst opp! Her er oppgaven:';
                feedbackElement.classList.add('success');
            }
            if (unlockInput) unlockInput.disabled = true;
            if (unlockButton) unlockButton.disabled = true;

            if (!currentTeamData.unlockedPosts) currentTeamData.unlockedPosts = {};
            currentTeamData.unlockedPosts[`post${postNum}`] = true;
            if (!currentTeamData.taskAttempts[`post${postNum}`]) { // Sørg for at forsøk er initialisert
                 currentTeamData.taskAttempts[`post${postNum}`] = 0;
            }
            saveState();
            setTimeout(() => {
                resetPageUI(`post-${postNum}-page`); 
                updateScoreDisplay(); 
            }, 800); 
        } else {
            if(feedbackElement) {
                feedbackElement.textContent = 'Feil ankomstkode. Prøv igjen!';
                feedbackElement.classList.add('error', 'shake');
            }
            if(unlockInput) {
                unlockInput.classList.add('shake');
                setTimeout(() => {
                    if(feedbackElement) feedbackElement.classList.remove('shake');
                    if(unlockInput) unlockInput.classList.remove('shake');
                }, 400);
                unlockInput.focus();
                unlockInput.select();
            }
        }
    }

    function proceedToNextPostOrFinish() { // postNum er ikke nødvendig her, hentes fra currentTeamData
        currentTeamData.currentPostArrayIndex++;
        saveState();

        if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                setTimeout(() => {
                    showRebusPage(`post-${nextPostGlobalId}-page`);
                    if (map) updateMapMarker(nextPostGlobalId, false);
                }, 1200); 
            } else {
                console.warn("Færre enn TOTAL_POSTS fullført, men ingen flere poster i sekvensen. Viser finale.");
                setTimeout(() => {
                    showRebusPage('finale-page');
                    if (map) updateMapMarker(null, true); 
                    stopContinuousUserPositionUpdate();
                }, 1200);
            }
        } else { 
            setTimeout(() => {
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true); 
                stopContinuousUserPositionUpdate();
            }, 1200);
        }
    }

    function handleTaskCheck(postNum, userAnswer) { // postNum er globalt postnummer
        const pageElement = document.getElementById(`post-${postNum}-page`);
        if(!pageElement) return;
        const taskInput = pageElement.querySelector('.post-task-input');
        const feedbackElement = pageElement.querySelector('.feedback-task');
        const attemptCounterElement = pageElement.querySelector('.attempt-counter');
        const taskButton = pageElement.querySelector('.check-task-btn');

        if (!currentTeamData) {
            console.error("currentTeamData er null i handleTaskCheck");
            if(feedbackElement) {
                feedbackElement.textContent = 'Feil: Lag ikke startet.';
                feedbackElement.className = 'feedback feedback-task error';
            }
            return;
        }

        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`];
        if(feedbackElement) {
            feedbackElement.className = 'feedback feedback-task';
            feedbackElement.textContent = '';
        }

        if (!userAnswer) {
            if(feedbackElement) {
                feedbackElement.textContent = 'Svar på oppgaven!';
                feedbackElement.classList.add('error', 'shake');
            }
            if(taskInput) taskInput.classList.add('shake');
            setTimeout(() => {
                if(feedbackElement) feedbackElement.classList.remove('shake');
                if(taskInput) taskInput.classList.remove('shake');
            }, 400);
            return;
        }

        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');

        if (currentTeamData.taskAttempts[`post${postNum}`] === undefined) { // Sikrer initialisering
            currentTeamData.taskAttempts[`post${postNum}`] = 0;
        }
        
        if (isCorrect) {
            if(feedbackElement) {
                feedbackElement.textContent = userAnswer.toUpperCase() === 'FASIT' ? 'FASIT godkjent! (Ingen poeng for juks)' : 'Korrekt svar! Bra jobba!';
                feedbackElement.classList.add('success');
            }
            if (taskInput) taskInput.disabled = true;
            if(taskButton) taskButton.disabled = true;

            if (userAnswer.toUpperCase() !== 'FASIT') {
                let pointsAwarded = POINTS_PER_CORRECT_TASK - ((currentTeamData.taskAttempts[`post${postNum}`] || 0) * 2); // F.eks. -2 poeng per feil
                pointsAwarded = Math.max(1, pointsAwarded); // Minst 1 poeng for riktig svar
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
            if(feedbackElement){
                feedbackElement.textContent = 'Feil svar, prøv igjen!';
                feedbackElement.classList.add('error', 'shake');
            }
            if(taskInput) {
                taskInput.classList.add('shake');
                setTimeout(() => { if(taskInput) taskInput.classList.remove('shake'); }, 400);
                taskInput.focus();
                taskInput.select();
            }
            setTimeout(() => { if(feedbackElement) feedbackElement.classList.remove('shake'); }, 400);

            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                if(feedbackElement) {
                    feedbackElement.textContent = `Ingen flere forsøk. Går videre til neste post... (0 poeng for denne)`;
                    feedbackElement.className = 'feedback feedback-task error';
                }
                if (taskInput) taskInput.disabled = true;
                if(taskButton) taskButton.disabled = true;

                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true; 
                    currentTeamData.completedPostsCount++;
                }
                proceedToNextPostOrFinish();
            }
        }
        saveState();
    }

    function updateUIAfterLoad() {
        if (!currentTeamData) {
            resetAllPostUIs();
            return;
        }
        
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            if (document.getElementById(`post-${i}-page`)) {
                 resetPageUI(`post-${i}-page`);
            }
        }
        if (currentTeamData && currentTeamData.score !== undefined) {
            updateScoreDisplay();
        }
    }

    // === EVENT LISTENERS ===
    if (startWithTeamCodeButton) {
        startWithTeamCodeButton.addEventListener('click', () => {
            if(teamCodeInput) initializeTeam(teamCodeInput.value);
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

    // Event listeners for unlock and task buttons using event delegation on #rebus-content
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

        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-unlock-input')) {
                    event.preventDefault();
                    const postNum = target.closest('.page').id.split('-')[1]; // Hent postNum fra parent .page
                    const unlockButton = document.querySelector(`#post-${postNum}-page .unlock-post-btn`);
                    if (unlockButton && !unlockButton.disabled) unlockButton.click();
                } else if (target.classList.contains('post-task-input')) {
                    event.preventDefault();
                    const postNum = target.closest('.page').id.split('-')[1]; // Hent postNum fra parent .page
                    const taskButton = document.querySelector(`#post-${postNum}-page .check-task-btn`);
                    if (taskButton && !taskButton.disabled) taskButton.click();
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

                if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
                    const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                    targetLocation = POST_LOCATIONS[currentPostGlobalId - 1];
                } else {
                    targetLocation = FINISH_LOCATION;
                    zoomLevel = 18; 
                }
                
                if (targetLocation) {
                    let bounds = new google.maps.LatLngBounds();
                    bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));

                    if (userPositionMarker && userPositionMarker.getPosition()) {
                         bounds.extend(userPositionMarker.getPosition());
                         map.fitBounds(bounds);
                         if (map.getZoom() > 18) map.setZoom(18); // Ikke zoom for mye inn
                    } else {
                        map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng));
                        map.setZoom(zoomLevel);
                    }
                } else if (userPositionMarker && userPositionMarker.getPosition()){ // Hvis ingen target, men har brukerposisjon
                     map.panTo(userPositionMarker.getPosition());
                     map.setZoom(17);
                } else { // Fallback til start
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
                showTabContent('rebus'); // Gå tilbake til rebus-fanen
                if (teamCodeInput) { teamCodeInput.disabled = false; } // Sørg for at input er enabled
                if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
            }
        });
    });

    // === INITALISERING VED LASTING AV SIDE ===
    if (loadState()) { 
        showTabContent('rebus'); 
        if (currentTeamData && currentTeamData.completedPostsCount >= TOTAL_POSTS) {
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true); 
        } else if (currentTeamData) {
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) {
                if(currentTeamData.completedPostsCount >= TOTAL_POSTS) {
                    showRebusPage('finale-page'); if(map) updateMapMarker(null, true);
                }
                else {
                    console.warn("Ugyldig post-ID i lagret state, nullstiller for sikkerhets skyld.");
                    clearState();
                    showRebusPage('intro-page');
                }
            } else {
                showRebusPage(`post-${currentExpectedPostId}-page`);
            }
        } else { 
            clearState();
            showRebusPage('intro-page');
        }
        updateUIAfterLoad(); 
        if(currentTeamData) {
            console.log(`Gjenopprettet tilstand for ${currentTeamData.name}. Neste post: ${currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]}`);
            if (currentTeamData.completedPostsCount < TOTAL_POSTS && map) { // Map bør være initialisert her hvis vi har teamdata
                startContinuousUserPositionUpdate();
            }
        }
    } else {
        showTabContent('rebus'); 
        showRebusPage('intro-page');
        resetAllPostUIs(); 
    }
});
/* Version: #11 */
