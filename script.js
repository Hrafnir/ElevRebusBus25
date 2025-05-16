/* Version: #18 */

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
const DEV_MODE_NO_GEOFENCE = true; // VIKTIG FOR TESTING

const POST_LOCATIONS = [ /* ... (som før) ... */ ];
const START_LOCATION = { /* ... (som før) ... */ };
const FINISH_LOCATION = { /* ... (som før) ... */ };
const POST_UNLOCK_HINTS = { /* ... (som før) ... */ };
const POST_UNLOCK_CODES = { /* ... (som før) ... */ };
const CORRECT_TASK_ANSWERS = { /* ... (som før) ... */ };
const MAX_ATTEMPTS_PER_TASK = 5;
const POINTS_PER_CORRECT_TASK = 10;

// === HJELPEFUNKSJONER ===
function calculateDistance(lat1, lon1, lat2, lon2) { /* ... (som før) ... */ }
function formatTime(totalSeconds) { /* ... (som før) ... */ }

// === GOOGLE MAPS API CALLBACK ===
window.initMap = function() { /* ... (som i v17) ... */ }

// === GLOBALE KARTFUNKSJONER ===
function updateMapMarker(postGlobalId, isFinalTarget = false) { /* ... (som før) ... */ }
function clearMapMarker() { /* ... (som før) ... */ }
function clearFinishMarker() { /* ... (som før) ... */ }
function handleGeolocationError(error) { /* ... (som før) ... */ }

// === KARTPOSISJON OG GEOFENCE FUNKSJONER ===
function updateUserPositionOnMap(position) { /* ... (som før) ... */ }
function updateGeofenceFeedback(distance, isEffectivelyWithinRange, isFullyCompleted, targetName = "posten") { /* ... (som i v17) ... */ }
function handlePositionUpdate(position) { /* ... (som i v17) ... */ }
function startContinuousUserPositionUpdate() { /* ... (som før) ... */ }
function stopContinuousUserPositionUpdate() { /* ... (som før) ... */ }


document.addEventListener('DOMContentLoaded', () => {
    console.log("DEBUG_V18: DOMContentLoaded event fired.");
    const teamCodeInput = document.getElementById('team-code-input');
    const startWithTeamCodeButton = document.getElementById('start-with-team-code-button');
    const teamCodeFeedback = document.getElementById('team-code-feedback');
    let pages = document.querySelectorAll('#rebus-content .page'); // Endret til let
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const devResetButtons = document.querySelectorAll('.dev-reset-button');
    const scoreDisplayElement = document.getElementById('score-display');
    const currentScoreSpan = document.getElementById('current-score');
    
    console.log(`DEBUG_V18: Pages NodeList length: ${pages ? pages.length : 'null'}`);
    if (!teamCodeInput) console.error("DEBUG_V18: teamCodeInput is NULL!");
    if (!startWithTeamCodeButton) console.error("DEBUG_V18: startWithTeamCodeButton is NULL!");


    const TEAM_CONFIG = { /* ... (uendret) ... */ };

    // === KJERNEFUNKSJONER (DOM-avhengige) ===
    function updateScoreDisplay() { /* ... (som før) ... */ }
    function updatePageText(pageElement, teamPostNumber, globalPostId) { /* ... (som før) ... */ }

    function showRebusPage(pageId) {
        console.log(`DEBUG_V18: --- showRebusPage CALLED with pageId: '${pageId}' ---`);
        
        // Hent 'pages' på nytt her for å være helt sikker, i tilfelle den ikke ble satt riktig globalt eller ble endret.
        pages = document.querySelectorAll('#rebus-content .page');
        if (!pages || pages.length === 0) {
            console.error("DEBUG_V18: CRITICAL - 'pages' NodeList is EMPTY or UNDEFINED in showRebusPage! Cannot switch pages.");
            return; 
        }
        console.log(`DEBUG_V18: 'pages' NodeList has ${pages.length} elements inside showRebusPage.`);

        let foundTargetPageAndMadeVisible = false;
        pages.forEach((page, index) => {
            console.log(`DEBUG_V18: Checking page ${index}: ID='${page.id}', Current classes: '${page.className}'`);
            if (page.id === pageId) {
                console.log(`DEBUG_V18: MATCH! Setting page '${page.id}' to VISIBLE.`);
                page.classList.add('visible');
                foundTargetPageAndMadeVisible = true;
                console.log(`DEBUG_V18: Page '${page.id}' new classes: '${page.className}'`);
            } else {
                if (page.classList.contains('visible')) {
                    console.log(`DEBUG_V18: Setting page '${page.id}' to HIDDEN.`);
                    page.classList.remove('visible');
                    console.log(`DEBUG_V18: Page '${page.id}' new classes: '${page.className}'`);
                }
            }
        });

        if (!foundTargetPageAndMadeVisible) {
            console.error(`DEBUG_V18: CRITICAL - Page with ID '${pageId}' was NOT FOUND in 'pages' NodeList during forEach loop.`);
        }

        // Verifiser etter løkken
        const targetElementAfterLoop = document.getElementById(pageId);
        if (targetElementAfterLoop) {
            if (targetElementAfterLoop.classList.contains('visible')) {
                console.log(`DEBUG_V18: SUCCESS - Page '${pageId}' IS VERIFIED as visible.`);
            } else {
                console.warn(`DEBUG_V18: WARNING - Page '${pageId}' was found, but IS NOT visible after loop. Current classes: '${targetElementAfterLoop.className}'`);
            }
        } else {
             console.error(`DEBUG_V18: CRITICAL - Page '${pageId}' still NOT FOUND by getElementById after loop.`);
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });

        if (pageId === 'intro-page') {
            console.log("DEBUG_V18: Handling UI for intro-page specifically in showRebusPage.");
            const teamCodeInputForIntro = document.getElementById('team-code-input');
            const startButtonForIntro = document.getElementById('start-with-team-code-button');
            if (teamCodeInputForIntro) teamCodeInputForIntro.disabled = false; else console.error("DEBUG_V18: teamCodeInput NULL for intro page UI.")
            if (startButtonForIntro) startButtonForIntro.disabled = false; else console.error("DEBUG_V18: startWithTeamCodeButton NULL for intro page UI.")
        }
        
        // ... (resten av logikken i showRebusPage for poengsum, finale-side etc. som i v17) ...
        if (currentTeamData && pageId.startsWith('post-') && pageId !== 'finale-page') { /* ... */ }
        resetPageUI(pageId); 
        if (currentTeamData && pageId !== 'intro-page') { updateScoreDisplay(); } 
        else if (scoreDisplayElement) { scoreDisplayElement.style.display = 'none'; }
        if (pageId === 'finale-page') { /* ... finale-logikk ... */ }
        console.log(`DEBUG_V18: --- showRebusPage COMPLETED for pageId: '${pageId}' ---`);
    }

    function showTabContent(tabId) { /* ... (som før) ... */ }
    function saveState() { /* ... (som før) ... */ }
    function loadState() { /* ... (som før) ... */ }
    function clearState() { /* ... (som før) ... */ }
    function resetPageUI(pageId) { /* ... (som i v17) ... */ }
    function resetAllPostUIs() { /* ... (som i v17) ... */ }
    
    function initializeTeam(teamCode) {
        console.log(`DEBUG_V18: --- initializeTeam CALLED with code: '${teamCode}' ---`);
        
        if (startWithTeamCodeButton) {
            console.log("DEBUG_V18: Disabling startWithTeamCodeButton.");
            startWithTeamCodeButton.disabled = true;
        } else {
            console.error("DEBUG_V18: startWithTeamCodeButton is NULL in initializeTeam, cannot disable.");
        }

        const teamKey = teamCode.trim().toUpperCase();
        const config = TEAM_CONFIG[teamKey];
        
        if(teamCodeFeedback) { teamCodeFeedback.className = 'feedback'; teamCodeFeedback.textContent = ''; }

        if (config) {
            console.log(`DEBUG_V18: Valid team config found for '${teamKey}'.`);
            currentTeamData = { /* ... (som i v17) ... */ };
            currentTeamData.postSequence.forEach(postId => { currentTeamData.taskAttempts[`post${postId}`] = 0; });
            console.log("DEBUG_V18: currentTeamData fully initialized:", JSON.parse(JSON.stringify(currentTeamData)));
            
            saveState(); console.log("DEBUG_V18: State saved.");
            resetAllPostUIs(); console.log("DEBUG_V18: All post UIs reset.");
            
            if (teamCodeInput) {
                console.log("DEBUG_V18: Disabling teamCodeInput.");
                teamCodeInput.disabled = true;
            }  else {
                console.error("DEBUG_V18: teamCodeInput is NULL in initializeTeam (after successful init), cannot disable.");
            }

            clearFinishMarker(); console.log("DEBUG_V18: Finish marker cleared.");
            updateScoreDisplay(); console.log("DEBUG_V18: Score display updated.");

            const firstPostInSequence = currentTeamData.postSequence[0];
            const targetPageId = `post-${firstPostInSequence}-page`;
            console.log(`DEBUG_V18: First post ID: ${firstPostInSequence}. Target page ID: '${targetPageId}'. Attempting to show page...`);
            
            showRebusPage(targetPageId); // <--- KRITISK KALL
            
            console.log(`DEBUG_V18: Returned from showRebusPage for '${targetPageId}'. Now checking map and GPS.`);
            if (map) {
                updateMapMarker(firstPostInSequence, false); console.log("DEBUG_V18: Map marker updated.");
            } else { console.warn("DEBUG_V18: Map NOT ready for marker update."); }
            
            startContinuousUserPositionUpdate(); 
            console.log(`DEBUG_V18: SUCCESS - Team ${currentTeamData.name} started!`);
        } else {
            console.warn(`DEBUG_V18: Invalid team config for '${teamKey}'.`);
            if(teamCodeFeedback) { /* ... (som i v17) ... */ }
            if (teamCodeInput) { /* ... (som i v17) ... */ }
            if (startWithTeamCodeButton) {
                console.log("DEBUG_V18: Re-enabling startWithTeamCodeButton (invalid code).");
                startWithTeamCodeButton.disabled = false;
            }
        }
        console.log("DEBUG_V18: --- initializeTeam COMPLETED ---");
    }

    // ... (handlePostUnlock, handleFinishCodeUnlock, proceedToNextPostOrFinish, handleTaskCheck, updateUIAfterLoad som før) ...

    // === EVENT LISTENERS ===
    console.log("DEBUG_V18: Setting up event listeners...");
    if (startWithTeamCodeButton && teamCodeInput) {
        startWithTeamCodeButton.addEventListener('click', () => {
            // IKKE log her, la initializeTeam logge sitt eget kall for å unngå duplikat
            initializeTeam(teamCodeInput.value);
        });
        console.log("DEBUG_V18: Event listener for startWithTeamCodeButton ADDED.");
    } else {
        console.error("DEBUG_V18: FAILED to add listener for startWithTeamCodeButton (button or input missing).");
    }
    // ... (resten av event listeners som i v17, men sørg for at de også har V18 i sin DEBUG-logging hvis du vil spore dem) ...
    // For eksempel:
    if (rebusContentElement) {
        rebusContentElement.addEventListener('click', (event) => {
            const target = event.target;
            if (target.classList.contains('unlock-post-btn')) {
                console.log("DEBUG_V18: Delegated click: unlock-post-btn"); /* ... */
            } else if (target.classList.contains('check-task-btn')) {
                console.log("DEBUG_V18: Delegated click: check-task-btn"); /* ... */
            }
        });
    }


    // === INITALISERING VED LASTING AV SIDE ===
    console.log("DEBUG_V18: Starting initial page load sequence...");
    if (DEV_MODE_NO_GEOFENCE) {
        console.warn("DEBUG_V18: DEV MODE ACTIVE - Geofence is OFF.");
        if (geofenceFeedbackElement) { /* ... (som i v17) ... */ }
    }

    if (loadState()) {
        console.log("DEBUG_V18: Loaded state successfully.");
        showTabContent('rebus');
        // ... (Resten av loadState-logikken som i v17)
    } else {
        console.log("DEBUG_V18: No valid state loaded or new user. Showing intro page.");
        showTabContent('rebus'); 
        showRebusPage('intro-page'); 
        resetAllPostUIs();
    }
    console.log("DEBUG_V18: Initial page setup complete.");
});
/* Version: #18 */
