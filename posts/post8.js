/* Version: #88 */
// Filnavn: posts/post8.js

function definePost8() {
    const POST_ID = 8;
    const postData = {
        id: POST_ID,
        name: "Scenen Gjøvik Gård - Pyramide",
        lat: 60.794004447513956, 
        lng: 10.692558505369421,
        type: "manned_pyramid",
        teacherPassword: "PYRAMIDEBYGGER",
        instructionsManned: "Lærer: Tast inn passord for å registrere poeng for pyramidebygging.",
        instructionsTask: "Bygg den høyest mulige menneskelige pyramiden med laget! Læreren vurderer og gir poeng (0-10).",
        maxPoints: 10,

        initUI: function(pageElement, teamData) {
            if (!pageElement) return;
            const currentLog = window.logToMobile || console.debug;
            
            // NY OG MER DETALJERT LOGGLINJE:
            const isUnlocked = teamData?.unlockedPosts?.[`post${POST_ID}`];
            const isTeacherVerified = teamData?.mannedPostTeacherVerified?.[`post${POST_ID}`];
            const isCompleted = teamData?.completedGlobalPosts?.[`post${POST_ID}`];
            currentLog(`Post ${POST_ID} initUI KALT. Ulåst: ${isUnlocked}, Verifisert: ${isTeacherVerified}, Fullført: ${isCompleted}. (SVAR_ID: #88_DEBUG_INIT)`, "debug");

            const postInfoSection = pageElement.querySelector('.post-info-section'); 
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section');
            const pyramidPointsSection = pageElement.querySelector('.pyramid-points-section');
            const pyramidProceedButton = pageElement.querySelector('#pyramid-proceed-btn-post8');

            if(postInfoSection) postInfoSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(pyramidPointsSection) pyramidPointsSection.style.display = 'none';
            if(pyramidProceedButton) pyramidProceedButton.style.display = 'none'; 

            const teacherPassInput = pageElement.querySelector(`#teacher-password-input-post${POST_ID}`);
            if (teacherPassInput) { teacherPassInput.value = ''; teacherPassInput.disabled = false; }
            const teacherPassButton = pageElement.querySelector(`.submit-teacher-password-btn[data-post="${POST_ID}"]`);
            if (teacherPassButton) teacherPassButton.disabled = false;
            const teacherPassFeedback = pageElement.querySelector(`#feedback-teacher-password-post${POST_ID}`);
            if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }
            
            const mannedInstrElement = pageElement.querySelector('.manned-post-instruction-placeholder');
            if (mannedInstrElement && this.instructionsManned) {
                 mannedInstrElement.textContent = this.instructionsManned;
            }
            const taskInstrElement = pageElement.querySelector('#pyramid-instructions-post8'); 
            if (taskInstrElement && this.instructionsTask) {
                taskInstrElement.textContent = this.instructionsTask;
            }

            if (isCompleted) { // Bruker den lokale isCompleted variabelen
                currentLog(`Post ${POST_ID} initUI: Post er fullført. Viser poengseksjon og Gå Videre.`, "debug");
                if (pyramidPointsSection) {
                    pyramidPointsSection.style.display = 'block';
                    pyramidPointsSection.querySelectorAll('input, button:not(#pyramid-proceed-btn-post8)').forEach(el => el.disabled = true);
                    
                    const ppFeedback = pageElement.querySelector('#pyramid-results-feedback');
                    if(ppFeedback) {
                        const savedPoints = teamData.pointsPerPost?.[`post${POST_ID}`]; 
                        if (savedPoints !== undefined && savedPoints !== null) {
                             ppFeedback.textContent = `Poeng registrert: ${savedPoints}!`;
                        } else {
                             ppFeedback.textContent = "Pyramidepoeng registrert.";
                        }
                        ppFeedback.className = "feedback success";
                    }
                    if (pyramidProceedButton) {
                        pyramidProceedButton.style.display = 'inline-block';
                        pyramidProceedButton.disabled = false;
                        currentLog(`Post ${POST_ID} initUI: Gå Videre-knapp vist og aktivert.`, "debug");
                    } else {
                        currentLog(`Post ${POST_ID} initUI (fullført): Fant IKKE Gå Videre-knapp.`, "warn");
                    }
                }
            } else if (isUnlocked) { // Bruker den lokale isUnlocked variabelen
                if (isTeacherVerified) { // Bruker den lokale isTeacherVerified variabelen
                    currentLog(`Post ${POST_ID} initUI: Post ulåst og lærer verifisert. Viser poengseksjon.`, "debug");
                    if (pyramidPointsSection) {
                        pyramidPointsSection.style.display = 'block';
                        const pointsInput = pageElement.querySelector(`#pyramid-points-input-post${POST_ID}`);
                        if(pointsInput) {pointsInput.value = ''; pointsInput.disabled = false;}
                        const submitBtn = pageElement.querySelector(`#submit-pyramid-points-post${POST_ID}`);
                        if(submitBtn) submitBtn.disabled = false;
                        const ppFeedback = pageElement.querySelector('#pyramid-results-feedback');
                        if(ppFeedback) { ppFeedback.textContent = ""; ppFeedback.className = "feedback";}
                    }
                } else if (teacherPasswordSection) { 
                    currentLog(`Post ${POST_ID} initUI: Post ulåst, venter på lærerpassord.`, "debug");
                    teacherPasswordSection.style.display = 'block'; 
                }
            } else if (postInfoSection) { 
                currentLog(`Post ${POST_ID} initUI: Post ikke ulåst. Viser infoseksjon.`, "debug");
                postInfoSection.style.display = 'block'; 
            }
        }
    };
    return postData;
}
/* Version: #88 */
