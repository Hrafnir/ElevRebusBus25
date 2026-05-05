/* Version: #48 */
// Filnavn: posts/post1.js

function definePost1() {
    const POST_ID = 1;
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
            const currentLog = window.logToMobile || console.debug;
            if (!pageElement || typeof pageElement.querySelector !== 'function') { // Forsterket sjekk
                currentLog(`Post ${POST_ID} initUI: pageElement er ugyldig. Type: ${typeof pageElement}`, "error");
                return;
            }
            currentLog(`Post ${POST_ID} initUI: Kjører. Ulåst: ${teamData?.unlockedPosts?.[`post${POST_ID}`]}, Verifisert: ${teamData?.mannedPostTeacherVerified?.[`post${POST_ID}`]}, Fullført: ${teamData?.completedGlobalPosts?.[`post${POST_ID}`]}`, "debug");

            const postInfoSection = pageElement.querySelector('.post-info-section');
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section');
            const minigolfFormSection = pageElement.querySelector('.minigolf-form-section');
            const minigolfProceedButton = pageElement.querySelector('#minigolf-proceed-btn-post1');

            currentLog(`Post ${POST_ID} initUI: postInfoSection: ${postInfoSection ? 'funnet' : 'IKKE funnet'}, teacherPasswordSection: ${teacherPasswordSection ? 'funnet' : 'IKKE funnet'}, minigolfFormSection: ${minigolfFormSection ? 'funnet' : 'IKKE funnet'}`, "debug");

            // Skjul alt først for å unngå overlapp hvis initUI kalles flere ganger
            if(postInfoSection) postInfoSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(minigolfFormSection) minigolfFormSection.style.display = 'none';
            if(minigolfProceedButton) minigolfProceedButton.style.display = 'none';

            const teacherPassInput = pageElement.querySelector(`#teacher-password-input-post${POST_ID}`);
            if (teacherPassInput) {
                teacherPassInput.value = '';
                teacherPassInput.disabled = false; // Standard til false
                currentLog(`Post ${POST_ID} initUI: teacherPassInput funnet. Disabled satt til false.`, "debug");
            } else {
                currentLog(`Post ${POST_ID} initUI: teacherPassInput IKKE funnet.`, "warn");
            }
            const teacherPassButton = pageElement.querySelector(`.submit-teacher-password-btn[data-post="${POST_ID}"]`);
            if (teacherPassButton) {
                teacherPassButton.disabled = false; // Standard til false
                currentLog(`Post ${POST_ID} initUI: teacherPassButton funnet. Disabled satt til false.`, "debug");
            } else {
                currentLog(`Post ${POST_ID} initUI: teacherPassButton IKKE funnet.`, "warn");
            }
            const teacherPassFeedback = pageElement.querySelector(`#feedback-teacher-password-post${POST_ID}`);
            if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }


            const mannedInstrElement = pageElement.querySelector('.manned-post-instruction-placeholder');
            if (mannedInstrElement && this.instructionsManned) {
                 mannedInstrElement.textContent = this.instructionsManned;
            }
            const taskInstrElement = pageElement.querySelector('#minigolf-instructions-post1');
            if (taskInstrElement && this.instructionsTask) {
                taskInstrElement.textContent = this.instructionsTask;
            }

            // Logikk for å vise riktig seksjon
            if (teamData && teamData.completedGlobalPosts && teamData.completedGlobalPosts[`post${POST_ID}`]) {
                currentLog(`Post ${POST_ID} initUI: Viser fullført-seksjon.`, "debug");
                if (minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                    minigolfFormSection.querySelectorAll('input, button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true);
                    const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                    if(mgFeedback) {
                        const savedGolfPoints = teamData.minigolfScores && teamData.minigolfScores[`post${POST_ID}`]?.pointsAwarded;
                        const savedGolfAverage = teamData.minigolfScores && teamData.minigolfScores[`post${POST_ID}`]?.average;
                        if (savedGolfPoints !== undefined && savedGolfAverage !== undefined) {
                            mgFeedback.textContent = `Snitt: ${savedGolfAverage.toFixed(2)}. Poeng: ${savedGolfPoints}!`;
                        } else { mgFeedback.textContent = "Minigolf fullført! Poeng registrert."; }
                        mgFeedback.className = "feedback success";
                    }
                    if (minigolfProceedButton) { minigolfProceedButton.style.display = 'inline-block'; minigolfProceedButton.disabled = false; }
                }
            } else if (teamData && teamData.unlockedPosts && teamData.unlockedPosts[`post${POST_ID}`]) {
                currentLog(`Post ${POST_ID} initUI: Post er ulåst.`, "debug");
                if (teamData.mannedPostTeacherVerified && teamData.mannedPostTeacherVerified[`post${POST_ID}`]) {
                    currentLog(`Post ${POST_ID} initUI: Viser minigolf-skjema (lærer verifisert).`, "debug");
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
                } else if (teacherPasswordSection) {
                    currentLog(`Post ${POST_ID} initUI: Viser lærerpassord-seksjon.`, "debug");
                    teacherPasswordSection.style.display = 'block';
                    // Inputs/knapper for passord er allerede håndtert øverst
                } else {
                     currentLog(`Post ${POST_ID} initUI: Ulåst, ikke verifisert, men fant ikke teacherPasswordSection. Faller tilbake til postInfo.`, "warn");
                     if(postInfoSection) postInfoSection.style.display = 'block';
                }
            } else if (postInfoSection) {
                currentLog(`Post ${POST_ID} initUI: Viser info-seksjon (ikke ulåst).`, "debug");
                postInfoSection.style.display = 'block';
            } else {
                currentLog(`Post ${POST_ID} initUI: Ingen tilstand matchet for å vise en seksjon.`, "warn");
            }
        }
    };
    return postData;
}
/* Version: #48 */
