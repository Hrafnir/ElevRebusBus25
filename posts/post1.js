/* Version: #44 */
// Filnavn: posts/post1.js

const POST_ID = 1; 

function definePost1() {
    const postData = {
        id: POST_ID,
        name: "Bassengparken Minigolf",
        lat: 60.7962307499199,
        lng: 10.667771549607588,
        type: "manned_minigolf", 
        teacherPassword: "GOLFMESTER", 
        maxPlayers: 6,
        minScorePerPlayer: 3, 
        instructionsManned: "Lærer: Tast inn passord for å starte minigolfoppgaven.",
        instructionsTask: "Spill 3 hull minigolf. Fyll inn totalt antall slag per spiller nedenfor. La felt stå tomt hvis færre enn 6 spillere.",
        pointsScale: { 8: 10, 9: 9, 10: 8, 11: 7, 12: 6, 13: 5, 14: 4, 15: 3, 16: 2, Infinity: 1 },
        
        initUI: function(pageElement, teamData) {
            if (!pageElement) {
                const logFunc = window.logToMobile || console.error;
                logFunc(`Post ${POST_ID}: initUI kalt uten pageElement.`, "error");
                return;
            }
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID}: Kaller initUI. Lærer verifisert: ${teamData?.mannedPostTeacherVerified?.[`post${POST_ID}`]}`, "debug");
            
            const postInfoSection = pageElement.querySelector('.post-info-section'); 
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section');
            const minigolfFormSection = pageElement.querySelector('.minigolf-form-section');
            const minigolfProceedButton = pageElement.querySelector('#minigolf-proceed-btn-post1');

            // Skjul alle relevante seksjoner som default
            if(postInfoSection) postInfoSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(minigolfFormSection) minigolfFormSection.style.display = 'none';
            if(minigolfProceedButton) minigolfProceedButton.style.display = 'none';

            // Nullstill lærerpassord-delen
            const teacherPassInput = pageElement.querySelector(`#teacher-password-input-post${POST_ID}`);
            if (teacherPassInput) { teacherPassInput.value = ''; teacherPassInput.disabled = false; }
            const teacherPassButton = pageElement.querySelector(`.submit-teacher-password-btn[data-post="${POST_ID}"]`);
            if (teacherPassButton) teacherPassButton.disabled = false;
            const teacherPassFeedback = pageElement.querySelector(`#feedback-teacher-password-post${POST_ID}`);
            if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }

            // Sett instruksjoner
            const mannedInstrElement = pageElement.querySelector('.manned-post-instruction-placeholder');
            if (mannedInstrElement && this.instructionsManned) {
                 mannedInstrElement.textContent = this.instructionsManned;
            }
            const taskInstrElement = pageElement.querySelector('#minigolf-instructions-post1'); // Antar denne IDen er i post1.html
            if (taskInstrElement && this.instructionsTask) {
                taskInstrElement.textContent = this.instructionsTask;
            }

            // Vis seksjoner basert på tilstand
            if (teamData.completedGlobalPosts[`post${POST_ID}`]) { 
                if (minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                    minigolfFormSection.querySelectorAll('input, button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true);
                    const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                    if(mgFeedback) {
                        const savedGolfPoints = teamData.minigolfScores[`post${POST_ID}`]?.pointsAwarded;
                        const savedGolfAverage = teamData.minigolfScores[`post${POST_ID}`]?.average;
                        if (savedGolfPoints !== undefined && savedGolfAverage !== undefined) {
                            mgFeedback.textContent = `Snitt: ${savedGolfAverage.toFixed(2)}. Poeng: ${savedGolfPoints}!`;
                        } else { mgFeedback.textContent = "Minigolf fullført! Poeng registrert."; }
                        mgFeedback.className = "feedback success";
                    }
                    if (minigolfProceedButton) { minigolfProceedButton.style.display = 'inline-block'; minigolfProceedButton.disabled = false; }
                }
            } else if (teamData.unlockedPosts[`post${POST_ID}`]) { 
                if (teamData.mannedPostTeacherVerified[`post${POST_ID}`]) { 
                    if (minigolfFormSection) {
                        minigolfFormSection.style.display = 'block';
                        for (let i = 1; i <= (this.maxPlayers || 6); i++) {
                            const scoreInput = pageElement.querySelector(`#player-${i}-score-post${POST_ID}`);
                            if (scoreInput) { scoreInput.value = ''; scoreInput.disabled = false;}
                        }
                        const submitGolfBtn = pageElement.querySelector(`#submit-minigolf-post${POST_ID}`);
                        if(submitGolfBtn) submitGolfBtn.disabled = false;
                        const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                        if(mgFeedback) { mgFeedback.textContent = ""; mgFeedback.className = "feedback";}
                        if(minigolfProceedButton) minigolfProceedButton.style.display = 'none';
                    }
                } else if (teacherPasswordSection) { teacherPasswordSection.style.display = 'block'; }
            } else if (postInfoSection) { postInfoSection.style.display = 'block'; }
        } // Avslutter initUI
    }; // Avslutter postData objektet
    return postData; 
} // Avslutter definePost1 funksjonen

// Registrer posten hos kjerneapplikasjonen
if (window.CoreApp && window.CoreApp.isReady) { // Sjekk om CoreApp er klar før registrering
    window.CoreApp.registerPost(definePost1());
} else {
    // Hvis CoreApp ikke er klar enda, lytt etter eventet
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost1() {
        const currentLog = window.logToMobile || console.debug;
        currentLog(`Post ${POST_ID}: coreAppReady event mottatt, registrerer post.`, "debug");
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost1());
        } else {
             const errorLog = window.logToMobile || console.error;
             errorLog(`Post ${POST_ID}: CoreApp fortsatt ikke funnet etter coreAppReady.`, "error");
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost1); 
    }, { once: true });
}
/* Version: #43 */
