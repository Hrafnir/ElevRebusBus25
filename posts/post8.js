/* Version: #40 */
// Filnavn: posts/post8.js

function definePost8() {
    const POST_ID = 8;
    return {
        id: POST_ID,
        name: "Scenen Gjøvik Gård - Pyramide",
        lat: 60.794004447513956, 
        lng: 10.692558505369421,
        type: "manned_pyramid",
        teacherPassword: "PYRAMIDEBYGGER",
        instructionsManned: "Lærer: Tast inn passord for å registrere poeng for pyramidebygging.",
        instructionsTask: "Bygg den høyest mulige menneskelige pyramiden med laget! Læreren vurderer og gir poeng (0-10).",
        maxPoints: 10, // Maks poeng lærer kan gi

        initUI: function(pageElement, teamData) {
            if (!pageElement) return;
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID}: Kaller initUI. Lærer verifisert: ${teamData?.mannedPostTeacherVerified?.[`post${POST_ID}`]}`, "debug");

            const postInfoSection = pageElement.querySelector('.post-info-section'); 
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section');
            const pyramidPointsSection = pageElement.querySelector('.pyramid-points-section');
            // const pyramidProceedButton = pageElement.querySelector('#pyramid-proceed-btn-post8'); // Hvis du legger til en

            if(postInfoSection) postInfoSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(pyramidPointsSection) pyramidPointsSection.style.display = 'none';
            // if(pyramidProceedButton) pyramidProceedButton.style.display = 'none';


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
            // const taskInstrElement = pageElement.querySelector('#pyramid-instructions-post8'); // Hvis du har en
            // if (taskInstrElement && this.instructionsTask) {
            //     taskInstrElement.textContent = this.instructionsTask;
            // }


            if (teamData.completedGlobalPosts[`post${POST_ID}`]) { 
                if (pyramidPointsSection) {
                    pyramidPointsSection.style.display = 'block';
                    pyramidPointsSection.querySelectorAll('input, button').forEach(el => el.disabled = true);
                    const ppFeedback = pageElement.querySelector('#pyramid-results-feedback');
                    if(ppFeedback) {
                        const savedPoints = teamData.pyramidPoints?.[`post${POST_ID}`];
                        if (savedPoints !== undefined && savedPoints !== null) {
                             ppFeedback.textContent = `Poeng registrert: ${savedPoints}!`;
                        } else {
                             ppFeedback.textContent = "Pyramidepoeng registrert.";
                        }
                        ppFeedback.className = "feedback success";
                    }
                    // Vurder Gå Videre-knapp her
                }
            } else if (teamData.unlockedPosts[`post${POST_ID}`]) { 
                if (teamData.mannedPostTeacherVerified[`post${POST_ID}`]) { 
                    if (pyramidPointsSection) {
                        pyramidPointsSection.style.display = 'block';
                        const pointsInput = pageElement.querySelector(`#pyramid-points-input-post${POST_ID}`);
                        if(pointsInput) {pointsInput.value = ''; pointsInput.disabled = false;}
                        const submitBtn = pageElement.querySelector(`#submit-pyramid-points-post${POST_ID}`);
                        if(submitBtn) submitBtn.disabled = false;
                        const ppFeedback = pageElement.querySelector('#pyramid-results-feedback');
                        if(ppFeedback) { ppFeedback.textContent = ""; ppFeedback.className = "feedback";}
                    }
                } else if (teacherPasswordSection) { teacherPasswordSection.style.display = 'block'; }
            } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
        }
    };
    return postData;
}

if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost8());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost8() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost8());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost8);
    }, { once: true });
}
/* Version: #40 */
