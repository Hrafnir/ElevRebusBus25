/* Version: #3 (BUS Lærerrebus - Uten Lyd) */

// === GLOBALE VARIABLER ===
let map;
let currentMapMarker;
let userPositionMarker;
let mapElement;
let currentTeamData = null;
let mapPositionWatchId = null;
let finishMarker = null;
// Lyd-relaterte globale variabler er fjernet

// === GLOBAL KONFIGURASJON ===
const TOTAL_POSTS = 2;

const POST_LOCATIONS = [
    { lat: 60.81260478331276, lng: 10.673852939210269, title: "Post 1", name: "Demonstrasjonssted Alfa"},
    { lat: 60.812993, lng: 10.672853, title: "Post 2", name: "Demonstrasjonssted Beta"} // OPPDATERT KOORDINAT
];
const START_LOCATION = { lat: 60.8127, lng: 10.6737, title: "Startområde Demo" };
const FINISH_LOCATION = { lat: 60.8124, lng: 10.6734, title: "Mål: Lærerværelset (Plassholder)" };

// NYTT: Hint for å finne ankomstkoder
const POST_UNLOCK_HINTS = {
    1: "Et sted for flygende baller.",
    2: "Arbeidslivets forpost."
};


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
        center: POST_LOCATIONS[0],
        zoom: 18,
        mapTypeId: google.maps.MapTypeId.SATELLITE,
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
    console.log("BUS Lærerrebus Kart initialisert (uten lydfunksjoner)");
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
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png';
        finishMarker = new google.maps.Marker({
            position: { lat: location.lat, lng: location.lng },
            map: map,
            title: markerTitle,
            animation: google.maps.Animation.DROP,
            icon: { url: markerIconUrl }
        });
    } else {
        if (!postGlobalId || postGlobalId < 1 || postGlobalId > POST_LOCATIONS.length) {
            return;
        }
        location = POST_LOCATIONS[postGlobalId - 1];
        markerTitle = `Neste: ${location.name || location.title}`;
        markerIconUrl = 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
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
        if (map.getZoom() < 18) map.setZoom(18);
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
            msg += "Nektet.";
            break;
        case error.POSITION_UNAVAILABLE:
            msg += "Utilgjengelig.";
            break;
        case error.TIMEOUT:
            msg += "Timeout.";
            break;
        default:
            msg += "Ukjent.";
    }
    console.warn(msg);
}

// === KARTPOSISJON FUNKSJONER (uten lydpiping) ===
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
                scale: 7,
                fillColor: "#1976D2",
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
        console.warn("Geolocation ikke støttet.");
        return;
    }
    if (mapPositionWatchId !== null) return; // Allerede startet

    console.log("Starter kontinuerlig GPS posisjonssporing for kart.");
    mapPositionWatchId = navigator.geolocation.watchPosition(
        handlePositionUpdate,
        (error) => {
            handleGeolocationError(error);
            stopContinuousUserPositionUpdate(); // Stopp hvis det er en feil som ikke er nektet
        },
        { enableHighAccuracy: true, maximumAge: 3000, timeout: 7000 }
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
    const unlockPostButtons = document.querySelectorAll('.unlock-post-btn');
    const checkTaskButtons = document.querySelectorAll('.check-task-btn');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    const finalScoreSpan = document.getElementById('final-score');

    const TEAM_CONFIG = {
        "LAG1": { name: "Lag 1", startPostId: "post-1-page", postSequence: [1, 2] },
        "LAG2": { name: "Lag 2", startPostId: "post-2-page", postSequence: [2, 1] }
    };
    const POST_UNLOCK_CODES = {
        post1: "PEDAGOG",
        post2: "LÆRING"
    };
    const CORRECT_TASK_ANSWERS = {
        post1: "RICHARD HØGÅS",
        post2: "KNUT PHARO"
    };
    const MAX_ATTEMPTS_PER_TASK = 5;
    const POINTS_PER_CORRECT_TASK = 5;

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

        if (titleElement) {
            if (teamPostNumber === TOTAL_POSTS) {
                titleElement.textContent = `Siste Oppdrag (${teamPostNumber} av ${TOTAL_POSTS}): Ankomstkode`;
            } else {
                titleElement.textContent = `Oppdrag ${teamPostNumber} av ${TOTAL_POSTS}: Ankomstkode`;
            }
        }

        if (introElement) {
            const postDetails = POST_LOCATIONS[globalPostId - 1];
            let postName = postDetails ? postDetails.name : `Post ${globalPostId}`;
            
            const commonInstruction = "Bruk kartet, og finn ut hvor dere skal. På poststedet vil dere finne ankomstkoden.";
            let specificHint = POST_UNLOCK_HINTS[globalPostId] ? ` Hint: ${POST_UNLOCK_HINTS[globalPostId]}` : "";

            let fullIntroText;

            if (teamPostNumber === TOTAL_POSTS) {
                fullIntroText = `Dette er siste oppgave før målgang! Velkommen til ${postName}. ${commonInstruction}${specificHint}`;
            } else {
                fullIntroText = `Velkommen til ${postName}. ${commonInstruction}${specificHint}`;
            }
            
            introElement.textContent = fullIntroText;
        }
    }

    function showRebusPage(pageId) {
        pages.forEach(page => page.classList.remove('visible'));
        const nextPageElement = document.getElementById(pageId);
        if (nextPageElement) {
            nextPageElement.classList.add('visible');
            const container = document.querySelector('.container');
            if (container) window.scrollTo({ top: container.offsetTop - 20, behavior: 'smooth' });

            if (currentTeamData && pageId.startsWith('post-')) {
                const globalPostNum = parseInt(pageId.split('-')[1]);
                const teamPostNum = currentTeamData.postSequence.indexOf(globalPostNum) + 1;
                updatePageText(nextPageElement, teamPostNum, globalPostNum);
            }
            resetPageUI(pageId); // Nullstiller UI for post-sider

            if (currentTeamData && pageId !== 'intro-page' && pageId !== 'finale-page') {
                updateScoreDisplay();
            } else if (scoreDisplayElement && pageId !== 'finale-page') { // Skjul poeng på intro
                scoreDisplayElement.style.display = 'none';
            }

            if (pageId === 'finale-page' && finalScoreSpan && currentTeamData) {
                finalScoreSpan.textContent = currentTeamData.score;
            }

        } else {
            console.error("Side ikke funnet:", pageId);
            clearState(); // Gå tilbake til en trygg tilstand
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
            localStorage.setItem('activeTeamData', JSON.stringify(currentTeamData));
        } else {
            localStorage.removeItem('activeTeamData');
        }
    }

    function loadState() {
        const savedData = localStorage.getItem('activeTeamData');
        if (savedData) {
            try {
                currentTeamData = JSON.parse(savedData);
                // Enkel validering av lastet state
                if (!currentTeamData || typeof currentTeamData.completedPostsCount === 'undefined' ||
                    !currentTeamData.postSequence || !currentTeamData.unlockedPosts ||
                    typeof currentTeamData.score === 'undefined' || !currentTeamData.taskAttempts ||
                    currentTeamData.postSequence.length > TOTAL_POSTS ) { // Sjekk om postSequence er for lang
                    console.warn("Lagret data er korrupt eller mangler nøkkelverdier, nullstiller.");
                    clearState();
                    return false;
                }
                return true;
            } catch (e) {
                console.warn("Feil ved parsing av lagret data:", e);
                clearState();
                return false;
            }
        }
        currentTeamData = null; // Ingen lagret data
        return false;
    }

    function clearState() {
        localStorage.removeItem('activeTeamData');
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
    }

    function resetPageUI(pageId) {
        if (pageId === 'intro-page' || pageId === 'finale-page') return;

        const postNumberMatch = pageId.match(/post-(\d+)-page/);
        if (!postNumberMatch) return;
        const postNum = postNumberMatch[1];

        const unlockSection = document.querySelector(`#post-${postNum}-page .post-unlock-section`);
        const taskSection = document.querySelector(`#post-${postNum}-page .post-task-section`);
        const unlockInput = document.getElementById(`post-${postNum}-unlock-input`);
        const unlockButton = document.querySelector(`#post-${postNum}-page .unlock-post-btn`);
        const unlockFeedback = document.getElementById(`feedback-unlock-${postNum}`);
        const taskInput = document.getElementById(`post-${postNum}-task-input`);
        const taskButton = document.querySelector(`#post-${postNum}-page .check-task-btn`);
        const taskFeedback = document.getElementById(`feedback-task-${postNum}`);
        const attemptCounterElement = document.getElementById(`attempts-${postNum}`);
        if(attemptCounterElement) attemptCounterElement.textContent = ''; // Nullstill forsøksteller-tekst

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
                    taskFeedback.className = 'feedback success';
                }
            } else if (isPostUnlocked) {
                unlockSection.style.display = 'none';
                taskSection.style.display = 'block';
                if (taskInput) { taskInput.disabled = false; taskInput.value = ''; }
                if (taskButton) taskButton.disabled = false;
                if (taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback'; }
                if (attemptCounterElement && currentTeamData && currentTeamData.taskAttempts && currentTeamData.taskAttempts[`post${postNum}`] !== undefined) {
                    const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
                    attemptCounterElement.textContent = `Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : 0}`;
                }
            } else { // Ikke låst opp, ikke fullført
                unlockSection.style.display = 'block';
                taskSection.style.display = 'none';
                if (unlockInput) { unlockInput.disabled = false; unlockInput.value = ''; }
                if (unlockButton) unlockButton.disabled = false;
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback'; }
            }
        }
    }

    function resetAllPostUIs() {
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            // Sjekk for å unngå feil hvis HTML for flere poster (enn 2) ikke finnes
            if (i > 2 && document.getElementById(`post-${i}-page`)) continue; // For PoC, kun post 1 & 2

            const pageElement = document.getElementById(`post-${i}-page`);
            if (!pageElement) continue;

            const unlockSection = pageElement.querySelector('.post-unlock-section');
            const taskSection = pageElement.querySelector('.post-task-section');
            const unlockInput = document.getElementById(`post-${i}-unlock-input`);
            const unlockButton = pageElement.querySelector('.unlock-post-btn');
            const unlockFeedback = document.getElementById(`feedback-unlock-${i}`);
            const taskInput = document.getElementById(`post-${i}-task-input`);
            const taskButton = pageElement.querySelector('.check-task-btn');
            const taskFeedback = document.getElementById(`feedback-task-${i}`);
            const attemptCounterElement = document.getElementById(`attempts-${i}`);

            if(unlockSection) unlockSection.style.display = 'block';
            if(taskSection) taskSection.style.display = 'none';

            if(unlockInput) { unlockInput.value = ''; unlockInput.disabled = false; }
            if(unlockButton) unlockButton.disabled = false;
            if(unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback'; }

            if(taskInput) { taskInput.value = ''; taskInput.disabled = false; }
            if(taskButton) taskButton.disabled = false;
            if(taskFeedback) { taskFeedback.textContent = ''; taskFeedback.className = 'feedback'; }
            if(attemptCounterElement) attemptCounterElement.textContent = '';

            // Nullstill placeholder-tekster
            const titlePlaceholder = pageElement.querySelector('.post-title-placeholder');
            if(titlePlaceholder) titlePlaceholder.textContent = "Post: Ankomstkode";
            const introPlaceholder = pageElement.querySelector('.post-intro-placeholder');
            if(introPlaceholder) introPlaceholder.textContent = "Finn ankomstkoden på stedet for å låse opp oppgaven.";
        }
        if(teamCodeInput) teamCodeInput.value = '';
        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }

    function initializeTeam(teamCode) {
        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        teamCodeFeedback.className = 'feedback'; // Reset feedback class
        teamCodeFeedback.textContent = '';

        if (config) {
            currentTeamData = {
                ...config,
                id: teamKey,
                currentPostArrayIndex: 0,
                completedPostsCount: 0,
                completedGlobalPosts: {}, // { post1: true, post2: false ... }
                unlockedPosts: {},        // { post1: true, post2: false ... }
                score: 0,
                taskAttempts: {}          // { post1: 0, post2: 2 ... }
            };
            saveState();
            resetAllPostUIs();
            clearFinishMarker();
            updateScoreDisplay();
            const firstPostInSequence = currentTeamData.postSequence[0];
            showRebusPage(`post-${firstPostInSequence}-page`);
            if (map) updateMapMarker(firstPostInSequence, false);
            else console.warn("Kart ikke klart ved lagstart for å sette markør.");
            startContinuousUserPositionUpdate();
            console.log(`Team ${currentTeamData.name} startet! Deres ${currentTeamData.currentPostArrayIndex + 1}. post (globalt: ${firstPostInSequence})`);
        } else {
            teamCodeFeedback.textContent = 'Ugyldig gruppekode!';
            teamCodeFeedback.classList.add('error', 'shake');
            setTimeout(() => teamCodeFeedback.classList.remove('shake'), 400);
            if (teamCodeInput) {
                teamCodeInput.classList.add('shake');
                setTimeout(() => teamCodeInput.classList.remove('shake'), 400);
                teamCodeInput.focus();
                teamCodeInput.select();
            }
        }
    }

    function handlePostUnlock(postNum, userAnswer) {
        const unlockInput = document.getElementById(`post-${postNum}-unlock-input`);
        const feedbackElement = document.getElementById(`feedback-unlock-${postNum}`);

        if (!currentTeamData) {
            console.error("currentTeamData er null i handlePostUnlock");
            if (feedbackElement) {
                feedbackElement.textContent = 'Feil: Gruppe ikke startet.';
                feedbackElement.className = 'feedback error';}
            return;
        }

        const correctUnlockCode = POST_UNLOCK_CODES[`post${postNum}`];
        feedbackElement.className = 'feedback'; // Reset
        feedbackElement.textContent = '';

        if (!userAnswer) {
            feedbackElement.textContent = 'Skriv ankomstkoden!';
            feedbackElement.classList.add('error', 'shake');
            unlockInput.classList.add('shake');
            setTimeout(() => {
                feedbackElement.classList.remove('shake');
                unlockInput.classList.remove('shake');
            }, 400);
            return;
        }

        if (userAnswer === correctUnlockCode.toUpperCase() || userAnswer === 'ÅPNE') { // 'ÅPNE' er en dev-kode
            feedbackElement.textContent = 'Post låst opp! Her er oppgaven:';
            feedbackElement.classList.add('success');
            if (unlockInput) unlockInput.disabled = true;
            document.querySelector(`#post-${postNum}-page .unlock-post-btn`).disabled = true;

            if (!currentTeamData.unlockedPosts) currentTeamData.unlockedPosts = {};
            currentTeamData.unlockedPosts[`post${postNum}`] = true;
            currentTeamData.taskAttempts[`post${postNum}`] = 0; // Initialiser forsøk for oppgaven
            saveState();
            setTimeout(() => {
                resetPageUI(`post-${postNum}-page`); // Oppdater UI for å vise oppgaveseksjonen
                updateScoreDisplay(); // Sørg for at poengsum vises korrekt
            }, 800); // Kort forsinkelse for å la brukeren se suksessmeldingen
        } else {
            feedbackElement.textContent = 'Feil ankomstkode. Prøv igjen!';
            feedbackElement.classList.add('error', 'shake');
            unlockInput.classList.add('shake');
            setTimeout(() => {
                feedbackElement.classList.remove('shake');
                unlockInput.classList.remove('shake');
            }, 400);
            unlockInput.focus();
            unlockInput.select();
        }
    }

    function proceedToNextPostOrFinish(postNum) {
        currentTeamData.currentPostArrayIndex++;
        saveState();
        // hasPlayedTargetReachedSound = false; // Fjernet da lyd er fjernet

        if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
            if (currentTeamData.currentPostArrayIndex < currentTeamData.postSequence.length) {
                const nextPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                setTimeout(() => {
                    showRebusPage(`post-${nextPostGlobalId}-page`);
                    if (map) updateMapMarker(nextPostGlobalId, false);
                }, 1200); // Litt tid til å lese feedback
            } else {
                // Dette bør normalt ikke skje hvis TOTAL_POSTS og postSequence stemmer
                console.warn("Færre enn TOTAL_POSTS fullført, men ingen flere poster i sekvensen. Viser finale.");
                setTimeout(() => {
                    showRebusPage('finale-page');
                    if (map) updateMapMarker(null, true); // Vis målmarkør
                    stopContinuousUserPositionUpdate();
                }, 1200);
            }
        } else { // Alle poster fullført
            setTimeout(() => {
                showRebusPage('finale-page');
                if (map) updateMapMarker(null, true); // Vis målmarkør
                stopContinuousUserPositionUpdate();
            }, 1200);
        }
    }

    function handleTaskCheck(postNum, userAnswer) {
        const taskInput = document.getElementById(`post-${postNum}-task-input`);
        const feedbackElement = document.getElementById(`feedback-task-${postNum}`);
        const attemptCounterElement = document.getElementById(`attempts-${postNum}`);

        if (!currentTeamData) {
            console.error("currentTeamData er null i handleTaskCheck");
            if(feedbackElement) {
                feedbackElement.textContent = 'Feil: Gruppe ikke startet.';
                feedbackElement.className = 'feedback error';
            }
            return;
        }

        let correctTaskAnswer = CORRECT_TASK_ANSWERS[`post${postNum}`];
        feedbackElement.className = 'feedback';
        feedbackElement.textContent = '';

        if (!userAnswer) {
            feedbackElement.textContent = 'Svar på oppgaven!';
            feedbackElement.classList.add('error', 'shake');
            if(taskInput) taskInput.classList.add('shake');
            setTimeout(() => {
                feedbackElement.classList.remove('shake');
                if(taskInput) taskInput.classList.remove('shake');
            }, 400);
            return;
        }

        const isCorrect = (userAnswer.toUpperCase() === correctTaskAnswer.toUpperCase() || userAnswer.toUpperCase() === 'FASIT');

        if (!currentTeamData.taskAttempts[`post${postNum}`]) {
            currentTeamData.taskAttempts[`post${postNum}`] = 0; // Sikrer at telleren er initialisert
        }

        if (isCorrect) {
            feedbackElement.textContent = userAnswer.toUpperCase() === 'FASIT' ? 'FASIT godkjent! (Ingen poeng)' : 'Korrekt svar!';
            feedbackElement.classList.add('success');
            if (taskInput) taskInput.disabled = true;
            const taskButton = document.querySelector(`#post-${postNum}-page .check-task-btn`);
            if(taskButton) taskButton.disabled = true;

            if (userAnswer.toUpperCase() !== 'FASIT') {
                // ENDRET POENGSYSTEM: (5 - antall gale forsøk)
                let pointsAwarded = POINTS_PER_CORRECT_TASK - (currentTeamData.taskAttempts[`post${postNum}`] || 0);
                pointsAwarded = Math.max(0, pointsAwarded); // Sikrer at poeng ikke blir negativt
                currentTeamData.score += pointsAwarded;
            }
            updateScoreDisplay();

            if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                currentTeamData.completedGlobalPosts[`post${postNum}`] = true;
                currentTeamData.completedPostsCount++;
            }
            proceedToNextPostOrFinish(postNum);
        } else { // Feil svar
            currentTeamData.taskAttempts[`post${postNum}`]++;
            updateScoreDisplay(); // Poengsum kan ha endret seg (hvis det var trekk for feil tidligere, nå ikke)

            const attemptsLeft = MAX_ATTEMPTS_PER_TASK - currentTeamData.taskAttempts[`post${postNum}`];
            if (attemptCounterElement) {
                attemptCounterElement.textContent = `Feil svar. Forsøk igjen: ${attemptsLeft > 0 ? attemptsLeft : 0}`;
            }
            feedbackElement.textContent = 'Feil svar, prøv igjen.';
            feedbackElement.classList.add('error', 'shake');
            if(taskInput) {
                taskInput.classList.add('shake');
                setTimeout(() => { taskInput.classList.remove('shake'); }, 400);
                taskInput.focus();
                taskInput.select();
            }
            setTimeout(() => { feedbackElement.classList.remove('shake'); }, 400);

            if (currentTeamData.taskAttempts[`post${postNum}`] >= MAX_ATTEMPTS_PER_TASK) {
                feedbackElement.textContent = `Ingen flere forsøk. Går videre... (0 poeng for denne)`;
                feedbackElement.className = 'feedback error';
                if (taskInput) taskInput.disabled = true;
                const taskButton = document.querySelector(`#post-${postNum}-page .check-task-btn`);
                if(taskButton) taskButton.disabled = true;

                if (!currentTeamData.completedGlobalPosts[`post${postNum}`]) {
                    currentTeamData.completedGlobalPosts[`post${postNum}`] = true; // Markerer posten som "fullført" selv om 0 poeng
                    currentTeamData.completedPostsCount++;
                }
                proceedToNextPostOrFinish(postNum);
            }
        }
        saveState();
    }

    function updateUIAfterLoad() {
        if (!currentTeamData) {
            resetAllPostUIs(); // Hvis ingen teamdata, nullstill alt UI
            return;
        }
        // Gå gjennom poster og nullstill UI basert på lagret state
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            if (document.getElementById(`post-${i}-page`)) { // Sjekk om postsiden finnes
                 resetPageUI(`post-${i}-page`);
            }
        }
        if (currentTeamData && currentTeamData.score !== undefined) {
            updateScoreDisplay();
        }
    }

    // EVENT LISTENERS
    if (startWithTeamCodeButton) {
        startWithTeamCodeButton.addEventListener('click', () => {
            initializeTeam(teamCodeInput.value);
        });
    }
    if (teamCodeInput) {
        teamCodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); // Forhindre form-submit hvis det skulle vært et
                if (startWithTeamCodeButton) startWithTeamCodeButton.click();
            }
        });
    }

    unlockPostButtons.forEach(button => {
        button.addEventListener('click', () => {
            const postNum = button.getAttribute('data-post');
            const unlockInput = document.getElementById(`post-${postNum}-unlock-input`);
            handlePostUnlock(postNum, unlockInput.value.trim().toUpperCase());
        });
    });

    checkTaskButtons.forEach(button => {
        button.addEventListener('click', () => {
            const postNum = button.getAttribute('data-post');
            const taskInput = document.getElementById(`post-${postNum}-task-input`);
            handleTaskCheck(postNum, taskInput.value.trim().toUpperCase());
        });
    });

    document.querySelectorAll('input[type="text"]').forEach(input => {
        input.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                if (this.id === 'team-code-input') {
                    if(startWithTeamCodeButton) startWithTeamCodeButton.click();
                } else if (this.id.includes('-unlock-input')) {
                    const postNum = this.id.split('-')[1];
                    const unlockButton = document.querySelector(`.unlock-post-btn[data-post="${postNum}"]`);
                    if (unlockButton && !unlockButton.disabled) unlockButton.click();
                } else if (this.id.includes('-task-input')) {
                    const postNum = this.id.split('-')[1];
                    const taskButton = document.querySelector(`.check-task-btn[data-post="${postNum}"]`);
                    if (taskButton && !taskButton.disabled) taskButton.click();
                }
            }
        });
    });

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            showTabContent(tabId);
            // Hvis kart-fanen åpnes, og vi har et aktivt team, sentrer kartet
            if (tabId === 'map' && map && currentTeamData) {
                if (currentTeamData.completedPostsCount < TOTAL_POSTS) {
                    const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                    const postLocation = POST_LOCATIONS[currentPostGlobalId - 1];
                    let bounds = new google.maps.LatLngBounds();
                    if (postLocation) bounds.extend(postLocation);
                    if (userPositionMarker && userPositionMarker.getPosition()) bounds.extend(userPositionMarker.getPosition());

                    if (!bounds.isEmpty()) {
                        map.fitBounds(bounds);
                        if (map.getZoom() > 18) map.setZoom(18); // Ikke zoom for mye inn
                        // Hvis brukerposisjon ikke er tilgjengelig, panorer til posten
                        if (postLocation && (!userPositionMarker || !userPositionMarker.getPosition())) {
                             map.panTo(postLocation); map.setZoom(18);
                        }
                    } else if (postLocation) { // Fallback hvis bounds er tom, men vi har post
                        map.panTo(postLocation); map.setZoom(18);
                    }
                } else { // Rebus fullført, sentrer på mål
                    map.panTo(FINISH_LOCATION); map.setZoom(18);
                }
            }
        });
    });

    devResetButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (confirm("Nullstille demo? Dette sletter all fremgang.")) {
                clearState();
                showRebusPage('intro-page');
                if (teamCodeInput) { teamCodeInput.value = ''; teamCodeInput.disabled = false; }
                if (teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback'; }
                if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
            }
        });
    });

    // INITALISERING VED LASTING AV SIDE
    if (loadState()) { // Prøv å laste lagret tilstand
        showTabContent('rebus'); // Vis rebus-fanen som standard
        if (currentTeamData && currentTeamData.completedPostsCount >= TOTAL_POSTS) {
            showRebusPage('finale-page');
            if (map) updateMapMarker(null, true); // Oppdater kart til mål
        } else if (currentTeamData) {
            // Sjekk om den lagrede posten er gyldig
            const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
            if (typeof currentExpectedPostId === 'undefined' || !document.getElementById(`post-${currentExpectedPostId}-page`)) {
                // Hvis ugyldig post-ID, men rebusen er fullført, vis finale. Ellers nullstill.
                if(currentTeamData.completedPostsCount >= TOTAL_POSTS) {
                    showRebusPage('finale-page'); if(map) updateMapMarker(null, true);
                }
                else {
                    console.warn("Ugyldig post-ID i lagret state for PoC, nullstiller.");
                    clearState();
                    showRebusPage('intro-page');
                }
            } else {
                showRebusPage(`post-${currentExpectedPostId}-page`);
                // Kartmarkør settes av initMap hvis kartet ikke er klart ennå,
                // eller av updateUIAfterLoad/showRebusPage hvis kartet er klart.
            }
        } else { // loadState returnerte true, men currentTeamData er av en eller annen grunn null
            clearState();
            showRebusPage('intro-page');
        }
        updateUIAfterLoad(); // Sørg for at UI reflekterer lastet state (f.eks. input-felt deaktivert)
        if(currentTeamData) {
            console.log(`Gjenopprettet tilstand for ${currentTeamData.name}.`);
            // Start GPS-sporing hvis rebusen ikke er fullført og kartet er lastet
            if (currentTeamData.completedPostsCount < TOTAL_POSTS && typeof google !== 'undefined' && google.maps && map) {
                startContinuousUserPositionUpdate();
            }
        }
    } else {
        showTabContent('rebus'); // Vis rebus-fanen som standard
        showRebusPage('intro-page');
        resetAllPostUIs(); // Sørg for at alt er nullstilt hvis ingen state lastes
    }

});
/* Version: #3 (BUS Lærerrebus - Uten Lyd) */
