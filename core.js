/* Version: #49 */
// Filnavn: core.js

// === GLOBALE VARIABLER ===
// ... (uendret) ...
// === CoreApp Objekt DEFINERT GLOBALT ===
// ... (uendret) ...
// === GLOBAL KONFIGURASJON ===
// ... (uendret) ...
// === HJELPEFUNKSJONER (Globale) ===
// ... (uendret) ...
// === Mobil Loggfunksjon ===
// ... (uendret) ...
// === Globale State Management Funksjoner ===
// ... (uendret) ...
// === LYDFUNKSJONER ===
// ... (uendret) ...
// === GOOGLE MAPS API CALLBACK ===
// ... (uendret) ...
// === GLOBALE KARTFUNKSJONER ===
// ... (uendret) ...
// === KARTPOSISJON OG GEOFENCE FUNKSJONER (Globale) ===
// ... (uendret, inkludert handlePositionUpdate, start/stopContinuousUserPositionUpdate) ...

document.addEventListener('DOMContentLoaded', () => {
    mobileLogContainer = document.getElementById('mobile-log-output');
    logToMobile(`DEBUG_V49: DOMContentLoaded event fired.`, "info"); // NY VERSJON
    initializeSounds();

    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    geofenceFeedbackElement = document.getElementById('geofence-feedback');
    postContentContainer = document.getElementById('post-content-container');

    if (!postContentContainer) logToMobile("CRITICAL - postContentContainer is NULL! Dynamisk innhold vil ikke lastes.", "error");

    const TEAM_CONFIG = { /* ... (uendret) ... */ };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }
    function displayFinalResults() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V49: Displaying final results.`, "info"); // NY VERSJON
        // ... (resten av funksjonen uendret)
        const finalScoreSpan = document.getElementById('final-score');
        const totalTimeSpan = document.getElementById('total-time');
        const stageTimesList = document.getElementById('stage-times-list');

        if (finalScoreSpan) finalScoreSpan.textContent = currentTeamData.score;
        if (totalTimeSpan && currentTeamData.totalTimeSeconds !== null) {
            totalTimeSpan.textContent = formatTime(currentTeamData.totalTimeSeconds);
        }

        if (stageTimesList && currentTeamData.taskCompletionTimes) {
            stageTimesList.innerHTML = '';
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
                        const fromPoint = (i === 0) ? "Start" : (CoreApp.getPostData(currentTeamData.postSequence[i-1]) ? CoreApp.getPostData(currentTeamData.postSequence[i-1]).name : "Forrige post");
                        li.textContent = `${fromPoint} til ${postName}: ${formatTimeFromMs(stageTime)}`;
                        stageTimesList.appendChild(li);
                    } else if (i === 0) {
                        const li = document.createElement('li');
                        li.textContent = `Start til ${postName}: Tid ukjent`;
                        stageTimesList.appendChild(li);
                    }
                } else {
                     const li = document.createElement('li');
                     const fromPoint = (i === 0) ? "Start" : (CoreApp.getPostData(currentTeamData.postSequence[i-1]) ? CoreApp.getPostData(currentTeamData.postSequence[i-1]).name : "Forrige post");
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
    async function showRebusPage(pageIdentifier) { /* ... (uendret fra v47) ... */
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
            logToMobile(`Innhold for '${pageIdentifier}' lastet inn i postContentContainer. Forventet ID: ${expectedWrapperId}`, "debug");

            const loadedPageElement = document.getElementById(expectedWrapperId);
            logToMobile(`Type of loadedPageElement for ${expectedWrapperId}: ${typeof loadedPageElement}. Is null? ${loadedPageElement === null}. Value: ${loadedPageElement}`, "debug");

            if (!loadedPageElement || typeof loadedPageElement.querySelector !== 'function') {
                 logToMobile(`FEIL: Kunne ikke finne gyldig rot-element med ID '${expectedWrapperId}' eller det er ikke et DOM-element etter innlasting av ${pageIdentifier}. Funnet: ${loadedPageElement}`, "error");
                 postContentContainer.innerHTML = `<p class="feedback error">Intern feil: Kunne ikke initialisere sideinnholdet korrekt for ${pageIdentifier}. Kontakt arrangør.</p>`;
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
                        if (postData.geoRunPoint1) {
                            updateMapMarker(null, false, postData.geoRunPoint1);
                        } else {
                            logToMobile(`Post ${globalPostNum} er georun, men mangler geoRunPoint1 data for kartmarkør.`, "warn");
                        }
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
                } else if (currentTeamData && currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'none';
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'block';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                } else {
                    if(finaleInfoSection) finaleInfoSection.style.display = 'block';
                    if (Object.keys(CoreApp.registeredPostsData).length === 0 && currentTeamData) {
                        if(finaleInfoSection) finaleInfoSection.innerHTML = "<p>Feil: Ingen poster er lastet inn i systemet. Kontakt en arrangør.</p>";
                    }
                    if(finaleUnlockSection) finaleUnlockSection.style.display = 'none';
                    if(finaleCompletedSection) finaleCompletedSection.style.display = 'none';
                    if (pageIdentifier === 'finale' && !currentTeamData) { logToMobile("Prøver å vise finale uten teamdata, går til intro.", "warn"); clearState(); showRebusPage('intro'); return; }
                }
            }
            // VIKTIG ENDRING: initUI kalles nå kun fra resetPageUI for å sikre at den alltid har siste teamData.
            // Fjerner det separate kallet her. resetPageUI vil kalle initUI.
            /*
            if (pageIdentifier.startsWith('post-')) {
                const postNum = parseInt(pageIdentifier.split('-')[1]);
                const postData = CoreApp.getPostData(postNum);
                if (postData && typeof postData.initUI === 'function') {
                    logToMobile(`Kaller initUI for post ${postNum} fra showRebusPage (etter resetPageUI).`, "debug");
                    postData.initUI(loadedPageElement, currentTeamData);
                }
            }
            */
        } catch (error) {
            logToMobile(`Feil ved lasting av sideinnhold for '${pageIdentifier}': ${error.message} (catch-blokk i showRebusPage)`, "error");
            postContentContainer.innerHTML = `<p class="feedback error">Kunne ikke laste innholdet for ${pageIdentifier}. Prøv å laste siden på nytt.</p>`;
        }
        logToMobile(`--- showRebusPage COMPLETED for pageIdentifier: '${pageIdentifier}' ---`, "info");
    }
    function showTabContent(tabId) { /* ... (uendret) ... */ }
    function loadState() { /* ... (uendret) ... */ }
    function clearState() { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V49: clearState kalt`, "info"); // NY VERSJON
        // ... (resten av funksjonen uendret)
        currentTeamData = null;
        saveState();
        stopContinuousUserPositionUpdate();
        if (userPositionMarker) { userPositionMarker.setMap(null); userPositionMarker = null; }
        clearMapMarker(); clearFinishMarker();
        if (map && START_LOCATION) map.panTo(START_LOCATION);
        if (scoreDisplayElement) scoreDisplayElement.style.display = 'none';
        resetAllPostUIs();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'none';
        logToMobile("All state og UI nullstilt.", "info");
    }
    function resetPageUI(pageIdentifier, pageElementContext = null) {
        const context = pageElementContext || postContentContainer;
        if (!context || typeof context.querySelector !== 'function') {
            logToMobile(`resetPageUI: Ugyldig kontekst (${typeof context}) for ${pageIdentifier}. Kan ikke fortsette.`, "error");
            return;
        }
        // logToMobile(`DEBUG_V49: resetPageUI kalt for: ${pageIdentifier}. Kontekst: ${context.id}`, "debug"); // NY VERSJON

        let postNum = null;
        if (pageIdentifier && pageIdentifier.startsWith('post-')) {
            postNum = parseInt(pageIdentifier.split('-')[1]);
        }

        const postData = postNum ? CoreApp.getPostData(postNum) : null;
        const isUnlocked = postData && currentTeamData && currentTeamData.unlockedPosts && currentTeamData.unlockedPosts[`post${postNum}`];
        const isCompleted = postData && currentTeamData && currentTeamData.completedGlobalPosts && currentTeamData.completedGlobalPosts[`post${postNum}`];
        const isTeacherVerified = postData && currentTeamData && currentTeamData.mannedPostTeacherVerified && currentTeamData.mannedPostTeacherVerified[`post${postNum}`];

        // logToMobile(`resetPageUI for ${pageIdentifier}: Ulåst: ${isUnlocked}, Fullført: ${isCompleted}, Verifisert: ${isTeacherVerified}`, "debug"); // NY LOGG

        const postInfoSection = context.querySelector('.post-info-section');
        const taskSection = context.querySelector('.post-task-section');
        const teacherPasswordSection = context.querySelector('.teacher-password-section');
        const minigolfFormSection = context.querySelector('.minigolf-form-section');
        const pyramidPointsSection = context.querySelector('.pyramid-points-section');
        const geoRunSetupSection = context.querySelector('.geo-run-setup-section');
        const geoRunActiveSection = context.querySelector('.geo-run-active-section');
        const geoRunResultsSection = context.querySelector('.geo-run-results-section');

        [postInfoSection, taskSection, teacherPasswordSection, minigolfFormSection, pyramidPointsSection, geoRunSetupSection, geoRunActiveSection, geoRunResultsSection]
            .forEach(section => { if (section) section.style.display = 'none'; });

        if (postData) {
            if (isCompleted) {
                // ... (logikk for fullført uendret) ...
                if (postData.type === 'standard' && taskSection) {
                    taskSection.style.display = 'block';
                    taskSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const feedbackEl = taskSection.querySelector('.feedback-task');
                    if (feedbackEl) { feedbackEl.textContent = "Post fullført!"; feedbackEl.className = "feedback success"; }
                } else if (postData.type === 'manned_minigolf' && minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                } else if (postData.type === 'manned_pyramid' && pyramidPointsSection) {
                    pyramidPointsSection.style.display = 'block';
                } else if (postData.type === 'georun' && geoRunResultsSection) {
                    geoRunResultsSection.style.display = 'block';
                } else if (postInfoSection) {
                    postInfoSection.style.display = 'block';
                    postInfoSection.innerHTML = `<p>Du har fullført denne posten.</p>`;
                }
            } else if (isUnlocked) {
                // ... (logikk for ulåst uendret) ...
                if (postData.type === 'standard' && taskSection) {
                    taskSection.style.display = 'block';
                    const inputEl = taskSection.querySelector('.post-task-input');
                    if (inputEl) { inputEl.value = ''; inputEl.disabled = false; }
                    const btnEl = taskSection.querySelector('.check-task-btn');
                    if (btnEl) btnEl.disabled = false;
                    const feedbackEl = taskSection.querySelector('.feedback-task');
                    if (feedbackEl) { feedbackEl.textContent = ''; feedbackEl.className = 'feedback feedback-task'; }
                    const attemptsEl = taskSection.querySelector('.attempt-counter');
                    if (attemptsEl && currentTeamData.taskAttempts && currentTeamData.taskAttempts[`post${postNum}`] !== undefined) {
                        attemptsEl.textContent = `Forsøk igjen: ${postData.maxAttempts - currentTeamData.taskAttempts[`post${postNum}`]}`;
                    } else if (attemptsEl) {
                        attemptsEl.textContent = postData.maxAttempts ? `Forsøk: ${postData.maxAttempts}` : '';
                    }
                } else if (postData.type === 'manned_minigolf') {
                    if (isTeacherVerified && minigolfFormSection) minigolfFormSection.style.display = 'block';
                    else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
                } else if (postData.type === 'manned_pyramid') {
                    if (isTeacherVerified && pyramidPointsSection) pyramidPointsSection.style.display = 'block';
                    else if (teacherPasswordSection) teacherPasswordSection.style.display = 'block';
                } else if (postData.type === 'georun') {
                    const runState = currentTeamData.geoRunState && currentTeamData.geoRunState[`post${postNum}`];
                    if (runState) {
                        if (runState.finished && geoRunResultsSection) geoRunResultsSection.style.display = 'block';
                        else if (runState.active && geoRunActiveSection) geoRunActiveSection.style.display = 'block';
                        else if (geoRunSetupSection) geoRunSetupSection.style.display = 'block';
                    } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
                }
            } else if (postInfoSection) {
                postInfoSection.style.display = 'block';
            }

            // Kall alltid initUI her for å sikre at post-spesifikk UI er korrekt
            // basert på den nyeste teamData-tilstanden.
            if (typeof postData.initUI === 'function') {
                logToMobile(`resetPageUI for ${pageIdentifier}: Kaller postData.initUI.`, "debug"); // NY LOGG
                postData.initUI(context, currentTeamData); // context er pageElementContext
            } else {
                // logToMobile(`resetPageUI for ${pageIdentifier}: Ingen initUI funksjon for postData.`, "debug"); // Kan være støyende
            }

        } else if (pageIdentifier === 'intro') {
            // ... (logikk for intro uendret) ...
            const teamCodeInput = context.querySelector('#team-code-input-dynamic');
            if (teamCodeInput) teamCodeInput.value = '';
            const teamCodeFeedback = context.querySelector('#team-code-feedback-dynamic');
            if (teamCodeFeedback) teamCodeFeedback.textContent = '';
            const startButton = context.querySelector('#start-with-team-code-button-dynamic');
            if (startButton) startButton.disabled = false;
        } else if (pageIdentifier === 'finale') {
            // ... (logikk for finale uendret) ...
            const finishInput = context.querySelector('#finish-unlock-input');
            if (finishInput) finishInput.value = '';
            const finishFeedback = context.querySelector('#feedback-unlock-finish');
            if (finishFeedback) finishFeedback.textContent = '';
        }
    }
    function resetAllPostUIs() { /* ... (uendret) ... */ }
    function initializeTeam(teamCode) { /* ... (uendret, men DEBUG-logg oppdatert) ... */
        logToMobile(`DEBUG_V49: initializeTeam kalt med kode: ${teamCode}`, "info"); // NY VERSJON
        // ... (resten av funksjonen uendret)
        if (Object.keys(CoreApp.registeredPostsData).length === 0) {
            logToMobile("initializeTeam: Ingen poster er registrert i CoreApp. Kan ikke starte lag.", "error");
            const feedbackElDynamic = document.getElementById('team-code-feedback-dynamic');
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Systemfeil: Ingen poster lastet. Kontakt arrangør.";
                feedbackElDynamic.className = "feedback error";
            }
            return;
        }

        const teamConfig = TEAM_CONFIG[teamCode.toUpperCase()];
        if (!teamConfig) {
            const feedbackElDynamic = document.getElementById('team-code-feedback-dynamic');
            if (feedbackElDynamic) {
                feedbackElDynamic.textContent = "Ugyldig lagkode. Prøv igjen.";
                feedbackElDynamic.className = "feedback error";
            }
            logToMobile(`Ugyldig lagkode: ${teamCode}`, "warn");
            return;
        }

        currentTeamData = {
            teamCode: teamCode.toUpperCase(), teamName: teamConfig.name, postSequence: teamConfig.postSequence,
            currentPostArrayIndex: 0, score: 0, startTime: Date.now(), endTime: null, totalTimeSeconds: null,
            completedPostsCount: 0, completedGlobalPosts: {}, unlockedPosts: {}, taskAttempts: {},
            taskCompletionTimes: {}, mannedPostTeacherVerified: {}, minigolfScores: {}, pyramidPoints: {},
            geoRunState: {}, arrivalSoundPlayed: {}, canEnterFinishCode: false
        };

        currentTeamData.postSequence.forEach(postId => {
            const postData = CoreApp.getPostData(postId);
            if (postData && postData.type === 'georun') {
                currentTeamData.geoRunState[`post${postId}`] = {
                    active: false, finished: false, startTime: null, endTime: null, lap: 0,
                    preCountdownPipsDone: 0, preRunPipTimerId: null, countdownTimerId: null,
                    totalLaps: postData.lapsNormal
                };
            }
        });

        saveState();
        logToMobile(`Lag ${currentTeamData.teamName} initialisert. Starter på post ${currentTeamData.postSequence[0]}. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}`, "info");

        const firstPostId = currentTeamData.postSequence[0];
        showRebusPage(`post-${firstPostId}`);
        updateMapMarker(firstPostId, false);
        startContinuousUserPositionUpdate();
        updateScoreDisplay();
        if (geofenceFeedbackElement) geofenceFeedbackElement.style.display = 'block';
    }
    function handleTeacherPassword(postNum, password) { /* ... (uendret) ... */ }
    function handleMinigolfSubmit(postNum) { /* ... (uendret) ... */ }
    function handlePyramidPointsSubmit(postNum, pointsStr) { /* ... (uendret) ... */ }
    function startGeoRunPreCountdownPips(postId = GEO_RUN_POST_ID) { /* ... (uendret) ... */ }
    function handleGeoRunLogic(isAtTargetPoint, targetPointId, currentGeoRunPostId = null) { /* ... (uendret) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret) ... */ }
    window.proceedToNextPostOrFinishGlobal = function() { /* ... (uendret) ... */ }
    function updateUIAfterLoad() { /* ... (uendret) ... */ }
    function handleFinishCodeInput(userAnswer) { /* ... (uendret) ... */ }

    // === EVENT LISTENERS ===
    // ... (uendret fra v47) ...
    tabButtons.forEach(button => { button.addEventListener('click', () => { const tabId = button.getAttribute('data-tab'); showTabContent(tabId); if (tabId === 'map' && map && currentTeamData) { let targetLocation = null; let zoomLevel = 15; if (currentTeamData.endTime || (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) ) { targetLocation = FINISH_LOCATION; zoomLevel = 16; } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) { const currentPostGlobalId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex]; const postData = CoreApp.getPostData(currentPostGlobalId); if(postData) { if(postData.type === 'georun' && currentTeamData.geoRunState[`post${currentPostGlobalId}`] && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].active && !currentTeamData.geoRunState[`post${currentPostGlobalId}`].finished && postData.geoRunPoint1) { targetLocation = postData.geoRunPoint1; } else { targetLocation = {lat: postData.lat, lng: postData.lng}; } } } if (targetLocation) { let bounds = new google.maps.LatLngBounds(); bounds.extend(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); if (userPositionMarker && userPositionMarker.getPosition()) { bounds.extend(userPositionMarker.getPosition()); map.fitBounds(bounds); if (map.getZoom() > 18) map.setZoom(18); } else { map.panTo(new google.maps.LatLng(targetLocation.lat, targetLocation.lng)); map.setZoom(zoomLevel); } } else if (userPositionMarker && userPositionMarker.getPosition()){ map.panTo(userPositionMarker.getPosition()); map.setZoom(16); } else { map.panTo(START_LOCATION); map.setZoom(15); } } }); });
    const globalDevResetButtons = document.querySelectorAll('.container > .dev-reset-button');
    globalDevResetButtons.forEach(button => { button.addEventListener('click', () => { if (confirm("Nullstille rebusen (global)?")) { clearState(); showRebusPage('intro'); showTabContent('rebus'); } }); });
    const toggleLogBtn = document.getElementById('toggle-log-visibility');
    const clearLogBtn = document.getElementById('clear-mobile-log');
    if (toggleLogBtn && mobileLogContainer) { toggleLogBtn.addEventListener('click', () => { mobileLogContainer.style.display = mobileLogContainer.style.display === 'none' ? 'block' : 'none'; }); }
    if (clearLogBtn && mobileLogContainer) { clearLogBtn.addEventListener('click', () => { mobileLogContainer.innerHTML = ''; }); }
    if (postContentContainer) {
        postContentContainer.addEventListener('click', (event) => {
            const target = event.target;
            if (target.id === 'start-with-team-code-button-dynamic' && !target.disabled) {
                const dynamicTeamCodeInput = postContentContainer.querySelector('#team-code-input-dynamic');
                if (dynamicTeamCodeInput) { initializeTeam(dynamicTeamCodeInput.value); }
                else { logToMobile("FEIL: Fant ikke team-code-input-dynamic.", "error"); }
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
            } else if (target.id === 'submit-minigolf-post1' && !target.disabled) { handleMinigolfSubmit(1); }
            else if (target.id === 'minigolf-proceed-btn-post1' && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'submit-pyramid-points-post8' && !target.disabled) {
                const pointsInput = postContentContainer.querySelector('#pyramid-points-input-post8');
                if(pointsInput) { handlePyramidPointsSubmit(8, pointsInput.value.trim()); }
            }
            else if (target.id === `pyramid-proceed-btn-post8` && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === `geo-run-proceed-btn-post${GEO_RUN_POST_ID}` && !target.disabled) { window.proceedToNextPostOrFinishGlobal(); }
            else if (target.id === 'finish-unlock-btn' && !target.disabled) {
                const finishCodeInput = postContentContainer.querySelector('#finish-unlock-input');
                if (finishCodeInput && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE) ) { handleFinishCodeInput(finishCodeInput.value.trim().toUpperCase()); }
                else if (finishCodeInput && currentTeamData && !currentTeamData.canEnterFinishCode && !DEV_MODE_NO_GEOFENCE) {
                    const feedbackEl = document.getElementById('feedback-unlock-finish');
                    if(feedbackEl) { feedbackEl.textContent = "Du er ikke nær nok målområdet."; feedbackEl.className = "feedback error"; }
                }
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
                    if (dynamicStartButton && !dynamicStartButton.disabled) { dynamicStartButton.click(); }
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
                    if (associatedButton && !associatedButton.disabled && currentTeamData && (currentTeamData.canEnterFinishCode || DEV_MODE_NO_GEOFENCE)) { handleFinishCodeInput(target.value.trim().toUpperCase()); }
                }
            }
        });
    }

    document.addEventListener('postReached', function(event) {
        if (event.detail && event.detail.pageId) {
            logToMobile(`Custom event 'postReached' for pageId: ${event.detail.pageId}. Calling resetPageUI.`, "debug");
            const pageElement = document.getElementById(event.detail.pageId + "-content-wrapper"); // f.eks. "post-1-content-wrapper"
            if (pageElement) {
                logToMobile(`postReached event: pageElement ${pageElement.id} funnet. Kaller resetPageUI.`, "debug"); // NY LOGG
                resetPageUI(event.detail.pageId, pageElement);
            } else {
                logToMobile(`postReached event: Kunne ikke finne pageElement for ${event.detail.pageId}-content-wrapper`, "error");
            }
        } else {
            logToMobile(`Custom event 'postReached' mottatt, men mangler detail eller pageId.`, "warn");
        }
    });
    document.addEventListener('geoRunLogicTrigger', function(event) { /* ... (uendret) ... */ });
    document.addEventListener('startGeoRunPrePipsTrigger', function(event) { /* ... (uendret) ... */ });
    document.addEventListener('scoreUpdated', updateScoreDisplay);
    document.addEventListener('requestProceedToNext', window.proceedToNextPostOrFinishGlobal);

    // === INITALISERING VED LASTING AV SIDE (uendret fra v47) ===
    // ... (uendret) ...
    const postScriptsToLoad = [];
    for (let i = 1; i <= TOTAL_POSTS; i++) { postScriptsToLoad.push(`posts/post${i}.js`); }
    Promise.all(postScriptsToLoad.map(scriptPath => {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = scriptPath;
            script.async = false;
            script.onload = () => { logToMobile(`${scriptPath} lastet.`, "debug"); resolve(true); };
            script.onerror = () => { logToMobile(`FEIL ved lasting av ${scriptPath}.`, "error"); reject(new Error(`Failed to load ${scriptPath}`)); };
            document.head.appendChild(script);
        });
    }))
    .then(() => {
        logToMobile(`Alle ${postScriptsToLoad.length} post-spesifikke scripts lastet. Registrerer poster...`, "info");
        for (let i = 1; i <= TOTAL_POSTS; i++) {
            const defineFunctionName = `definePost${i}`;
            if (typeof window[defineFunctionName] === 'function') {
                try {
                    const postData = window[defineFunctionName]();
                    if (postData) { CoreApp.registerPost(postData); }
                    else { logToMobile(`${defineFunctionName} returnerte ikke data. Post ${i} ikke registrert.`, "warn"); }
                } catch (e) { logToMobile(`Feil under kjøring av ${defineFunctionName} eller registrering av post ${i}: ${e.message}`, "error"); }
            } else { logToMobile(`${defineFunctionName} er ikke definert. Post ${i} kan ikke registreres.`, "warn"); }
        }
        logToMobile(`Post-registrering fullført. Antall registrerte poster: ${Object.keys(CoreApp.registeredPostsData).length}.`, "info");
        CoreApp.setReady();
        if (DEV_MODE_NO_GEOFENCE) { if (geofenceFeedbackElement) { geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert."; geofenceFeedbackElement.className = 'geofence-info dev-mode'; geofenceFeedbackElement.style.display = 'block'; } }
        if (loadState()) {
            logToMobile("Tilstand lastet fra localStorage.", "info");
            showTabContent('rebus');
            if (currentTeamData.endTime) {
                showRebusPage('finale');
                if (map) updateMapMarker(null, true);
            } else if (currentTeamData.completedPostsCount >= Object.keys(CoreApp.registeredPostsData).length && Object.keys(CoreApp.registeredPostsData).length > 0) {
                showRebusPage('finale');
                if (map) updateMapMarker(null, true);
                if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
            } else if (currentTeamData.completedPostsCount < Object.keys(CoreApp.registeredPostsData).length && currentTeamData.postSequence.length > 0 && Object.keys(CoreApp.registeredPostsData).length > 0) {
                const currentExpectedPostId = currentTeamData.postSequence[currentTeamData.currentPostArrayIndex];
                 if (CoreApp.getPostData(currentExpectedPostId)) {
                    showRebusPage(`post-${currentExpectedPostId}`);
                    if(map && !currentTeamData.endTime) startContinuousUserPositionUpdate();
                 } else {
                    logToMobile(`Post ${currentExpectedPostId} fra lagret state er ikke registrert (Antall registrerte: ${Object.keys(CoreApp.registeredPostsData).length}). Nullstiller.`, "warn");
                    clearState(); showRebusPage('intro');
                 }
            } else {
                logToMobile("Uventet tilstand ved lasting (eller ingen poster registrert), nullstiller.", "warn");
                clearState(); showRebusPage('intro');
            }
            updateUIAfterLoad();
        } else {
            logToMobile("Ingen lagret tilstand funnet, viser introduksjonsside.", "info");
            showTabContent('rebus');
            showRebusPage('intro');
        }
        logToMobile("Initial page setup complete.", "info");
    })
    .catch(error => {
        logToMobile(`Alvorlig feil under lasting av post-skript: ${error.message}. Applikasjonen kan være ustabil.`, "error");
        postContentContainer.innerHTML = `<p class="feedback error">En kritisk feil oppstod under lasting av spillets data. Prøv å laste siden på nytt, eller kontakt en arrangør.</p>`;
    });
});
/* Version: #49 */
