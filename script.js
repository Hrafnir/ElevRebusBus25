/* Version: #16 */

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

const POST_LOCATIONS = [ /* ... (uendret) ... */ ];
const START_LOCATION = { /* ... (uendret) ... */ };
const FINISH_LOCATION = { /* ... (uendret) ... */ };
const POST_UNLOCK_HINTS = { /* ... (uendret) ... */ };
const POST_UNLOCK_CODES = { /* ... (uendret) ... */ };
const CORRECT_TASK_ANSWERS = { /* ... (uendret) ... */ };
const MAX_ATTEMPTS_PER_TASK = 5;
const POINTS_PER_CORRECT_TASK = 10;

// === HJELPEFUNKSJONER ===
function calculateDistance(lat1, lon1, lat2, lon2) { /* ... (uendret) ... */ }
function formatTime(totalSeconds) { /* ... (uendret) ... */ }

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { /* ... (uendret fra v15) ... */ }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false) { /* ... (uendret) ... */ }
function clearMapMarker() { /* ... (uendret) ... */ }
function clearFinishMarker() { /* ... (uendret) ... */ }
function handleGeolocationError(error) { /* ... (uendret) ... */ }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER ===
function updateUserPositionOnMap(position) { /* ... (uendret) ... */ }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten") { /* ... (uendret fra v15) ... */ }
function handlePositionUpdate(position) { /* ... (uendret fra v15) ... */ }
function startContinuousUserPositionUpdate() { /* ... (uendret) ... */ }
function stopContinuousUserPositionUpdate() { /* ... (uendret) ... */ }


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
    
    console.log("DEBUG: Core DOM elements fetched.");
    if (!teamCodeInput) console.error("DEBUG: teamCodeInput is NULL!");
    if (!startWithTeamCodeButton) console.error("DEBUG: startWithTeamCodeButton is NULL!");


    const TEAM_CONFIG = { /* ... (uendret) ... */ };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (uendret) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (uendret) ... */ }
    function showRebusPage(pageId) { /* ... (uendret fra v15) ... */ }
    function showTabContent(tabId) { /* ... (uendret) ... */ }
    function saveState() { /* ... (uendret) ... */ }
    function loadState() { /* ... (uendret) ... */ }
    function clearState() { /* ... (uendret) ... */ }

    function resetPageUI(pageId) {
        console.log(`DEBUG: resetPageUI called for ${pageId}`);
        const pageElement = document.getElementById(pageId);
        if (!pageElement) {
            console.error(`DEBUG: Page element ${pageId} not found in resetPageUI.`);
            return;
        }

        if (pageId === 'intro-page') { 
             const teamCodeInputForIntroReset = document.getElementById('team-code-input');
             const startButtonForIntroReset = document.getElementById('start-with-team-code-button');
             if(teamCodeInputForIntroReset) teamCodeInputForIntroReset.disabled = false;
             else console.error("DEBUG: teamCodeInput not found in resetPageUI for intro-page");
             if(startButtonForIntroReset) startButtonForIntroReset.disabled = false;
             else console.error("DEBUG: startWithTeamCodeButton not found in resetPageUI for intro-page");
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
                // KORRIGERT LOGIKK HER:
                // Hvis DEV_MODE_NO_GEOFENCE er true, skal disabled være false (altså enabled).
                // Ellers (DEV_MODE er false), skal de starte disabled (true) og aktiveres av GPS.
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
                // KORRIGERT LOGIKK HER:
                const shouldBeDisabledDueToGeofence = !DEV_MODE_NO_GEOFENCE;
                if (unlockInput) { unlockInput.disabled = shouldBeDisabledDueToGeofence; unlockInput.value = ''; } 
                if (unlockButton) unlockButton.disabled = shouldBeDisabledDueToGeofence; 
                if (unlockFeedback) { unlockFeedback.textContent = ''; unlockFeedback.className = 'feedback feedback-unlock'; }
            }
        }
     }
    function resetAllPostUIs() { /* ... (uendret fra v15, men den kaller nå den korrigerte resetPageUI) ... */ 
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
        if(teamCodeInput) teamCodeInput.disabled = false; 
        if(startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;

        if(teamCodeFeedback) { teamCodeFeedback.textContent = ''; teamCodeFeedback.className = 'feedback';}
    }
    function initializeTeam(teamCode) { /* ... (uendret) ... */ }
    function handlePostUnlock(postNum, userAnswer) { /* ... (uendret) ... */ }
    function handleFinishCodeUnlock(userAnswer) { /* ... (uendret) ... */ }
    function proceedToNextPostOrFinish() { /* ... (uendret) ... */ }
    function handleTaskCheck(postNum, userAnswer) { /* ... (uendret) ... */ }
    function updateUIAfterLoad() { /* ... (uendret) ... */ }

    // === EVENT LISTENERS ===
    console.log("DEBUG: Setting up event listeners...");

    if (startWithTeamCodeButton && teamCodeInput) {
        startWithTeamCodeButton.addEventListener('click', () => {
            console.log("DEBUG: Start with team code button clicked.");
            initializeTeam(teamCodeInput.value);
        });
        console.log("DEBUG: Event listener for startWithTeamCodeButton ADDED.");
    } else {
        console.error("DEBUG: Failed to add listener for startWithTeamCodeButton (button or input missing).");
    }

    if (teamCodeInput) { 
        teamCodeInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault(); 
                if (startWithTeamCodeButton) {
                    console.log("DEBUG: Enter pressed in teamCodeInput, clicking start button.");
                    startWithTeamCodeButton.click();
                }
            }
        });
        console.log("DEBUG: Event listener for teamCodeInput (keypress) ADDED.");
    } else {
         console.error("DEBUG: Failed to add keypress listener for teamCodeInput (input missing).");
    }

    const rebusContentElement = document.getElementById('rebus-content');
    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('unlock-post-btn')) {
                const postNum = target.getAttribute('data-post');
                console.log(`DEBUG: Unlock button for post ${postNum} clicked via delegation.`);
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const unlockInput = pageElement.querySelector('.post-unlock-input');
                    if(unlockInput) handlePostUnlock(postNum, unlockInput.value.trim().toUpperCase());
                }
            } else if (target.classList.contains('check-task-btn')) {
                const postNum = target.getAttribute('data-post');
                console.log(`DEBUG: Check task button for post ${postNum} clicked via delegation.`);
                const pageElement = document.getElementById(`post-${postNum}-page`);
                if(pageElement) {
                    const taskInput = pageElement.querySelector('.post-task-input');
                    if(taskInput) handleTaskCheck(postNum, taskInput.value.trim().toUpperCase());
                }
            }
        });
        console.log("DEBUG: Click event listener for rebusContentElement (delegation) ADDED.");

        rebusContentElement.addEventListener('keypress', (event) => {
            const target = event.target;
            if (event.key === 'Enter') {
                if (target.classList.contains('post-unlock-input')) {
                    event.preventDefault();
                    const postPage = target.closest('.page');
                    if (postPage) {
                        const postNum = postPage.id.split('-')[1];
                        console.log(`DEBUG: Enter in post-unlock-input for post ${postNum} via delegation.`);
                        const unlockButton = postPage.querySelector(`.unlock-post-btn[data-post="${postNum}"]`);
                        if (unlockButton && !unlockButton.disabled) unlockButton.click();
                    }
                } else if (target.classList.contains('post-task-input')) {
                    event.preventDefault();
                     const postPage = target.closest('.page');
                    if (postPage) {
                        const postNum = postPage.id.split('-')[1];
                        console.log(`DEBUG: Enter in post-task-input for post ${postNum} via delegation.`);
                        const taskButton = postPage.querySelector(`.check-task-btn[data-post="${postNum}"]`);
                        if (taskButton && !taskButton.disabled) taskButton.click();
                    }
                }
            }
        });
        console.log("DEBUG: Keypress event listener for rebusContentElement (delegation) ADDED.");

    } else {
        console.error("DEBUG: rebusContentElement NOT FOUND. Failed to add delegated listeners.");
    }


    const finishUnlockButton = document.getElementById('finish-unlock-btn');
    if (finishUnlockButton) {
        finishUnlockButton.addEventListener('click', () => {
            console.log("DEBUG: Finish unlock button clicked.");
            const finishInput = document.getElementById('finish-unlock-input');
            if(finishInput) handleFinishCodeUnlock(finishInput.value.trim().toUpperCase());
        });
        console.log("DEBUG: Event listener for finishUnlockButton ADDED.");
    } else {
        console.error("DEBUG: finishUnlockButton NOT FOUND.");
    }

    const finishUnlockInput = document.getElementById('finish-unlock-input');
    if(finishUnlockInput){
        finishUnlockInput.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                console.log("DEBUG: Enter in finishUnlockInput.");
                const associatedButton = document.getElementById('finish-unlock-btn');
                if (associatedButton && !associatedButton.disabled) associatedButton.click();
            }
        });
        console.log("DEBUG: Event listener for finishUnlockInput (keypress) ADDED.");
    } else {
        console.error("DEBUG: finishUnlockInput NOT FOUND.");
    }
    
    if (tabButtons.length > 0) {
        tabButtons.forEach(button => { 
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                console.log(`DEBUG: Tab button for '${tabId}' clicked.`);
                showTabContent(tabId);
                // ... (resten av tab-logikken fra v15)
                if (tabId === 'map' && map && currentTeamData) {
                    let targetLocation = null;
                    let zoomLevel = 17;

                    if (currentTeamData.atFinishLineInput || currentTeamData.endTime) { 
                        targetLocation = FINISH_LOCATION;
                        zoomLevel = 18; 
                    } else if (currentTeamData.completedPostsCount < TOTAL_POSTS) { 
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
        console.log(`DEBUG: Event listeners for ${tabButtons.length} tabButtons ADDED.`);
    } else {
        console.warn("DEBUG: No tabButtons found.");
    }

    if (devResetButtons.length > 0 ) {
        devResetButtons.forEach(button => { 
            button.addEventListener('click', () => {
                console.log("DEBUG: Dev reset button clicked.");
                if (confirm("Nullstille rebusen? All fremgang for aktivt lag vil bli slettet.")) {
                    clearState();
                    showRebusPage('intro-page');
                    showTabContent('rebus'); 
                    if (teamCodeInput) { teamCodeInput.disabled = false; } 
                    if (startWithTeamCodeButton) startWithTeamCodeButton.disabled = false;
                }
            });
        });
        console.log(`DEBUG: Event listeners for ${devResetButtons.length} devResetButtons ADDED.`);
    } else {
        console.warn("DEBUG: No devResetButtons found.");
    }
    console.log("DEBUG: All standard event listeners setup attempted.");

    // === INITALISERING VED LASTING AV SIDE ===
    if (DEV_MODE_NO_GEOFENCE) {
        console.warn("DEV MODE: GEOFENCE ER DEAKTIVERT GLOBALT!");
        // ... (resten av DEV_MODE logging fra v15) ...
        if (geofenceFeedbackElement) { 
            geofenceFeedbackElement.textContent = "DEV MODE: Geofence deaktivert.";
            geofenceFeedbackElement.className = 'geofence-info dev-mode';
            geofenceFeedbackElement.style.display = 'block';
        }
    }

    if (loadState()) { /* ... (uendret fra v15) ... */ }
    else { /* ... (uendret fra v15) ... */ }
});
/* Version: #16 */
