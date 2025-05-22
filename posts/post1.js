/* Version: #38 */
// Filnavn: posts/post1.js

(function() {
    const POST_ID = 1;

    const postData = {
        id: POST_ID,
        name: "Bassengparken Minigolf",
        lat: 60.7962307499199,
        lng: 10.667771549607588,
        type: "manned_minigolf", // Identifiserer type post for core.js
        teacherPassword: "GOLFMESTER", // Passord for denne posten
        maxPlayers: 6,
        minScorePerPlayer: 3, // Minst 1 slag per hull * 3 hull
        instructions: "Spill 3 hull minigolf. Læreren noterer antall slag for hver spiller på laget (inntil 6 spillere). Fyll inn totalt antall slag per spiller nedenfor. La felt stå tomt hvis færre enn 6 spillere.",
        pointsScale: { // scoreAvg: points
            8: 10,
            9: 9,
            10: 8,
            11: 7,
            12: 6,
            13: 5,
            14: 4,
            15: 3,
            16: 2,
            Infinity: 1 
        },
        // Funksjon for å initialisere UI når denne postens HTML er lastet
        initUI: function(pageElement, teamData) {
            logToMobile(`Post ${POST_ID}: Kaller initUI. Lærer verifisert: ${teamData?.mannedPostTeacherVerified?.[`post${POST_ID}`]}`, "debug");
            
            const postInfoSection = pageElement.querySelector('.post-info-section'); 
            const teacherPasswordSection = pageElement.querySelector('.teacher-password-section');
            const minigolfFormSection = pageElement.querySelector('.minigolf-form-section');
            const minigolfProceedButton = pageElement.querySelector('#minigolf-proceed-btn-post1');

            // Nullstill og skjul alle seksjoner først
            if(postInfoSection) postInfoSection.style.display = 'none';
            if(teacherPasswordSection) teacherPasswordSection.style.display = 'none';
            if(minigolfFormSection) minigolfFormSection.style.display = 'none';
            if(minigolfProceedButton) minigolfProceedButton.style.display = 'none';

            const teacherPassInput = pageElement.querySelector(`#teacher-password-input-post${POST_ID}`);
            if (teacherPassInput) { teacherPassInput.value = ''; teacherPassInput.disabled = false; }
            const teacherPassButton = pageElement.querySelector(`.submit-teacher-password-btn[data-post="${POST_ID}"]`);
            if (teacherPassButton) teacherPassButton.disabled = false;
            const teacherPassFeedback = pageElement.querySelector(`#feedback-teacher-password-post${POST_ID}`);
            if (teacherPassFeedback) { teacherPassFeedback.textContent = ''; teacherPassFeedback.className = 'feedback feedback-teacher-password'; }


            if (teamData.completedGlobalPosts[`post${POST_ID}`]) { // Oppgave fullført
                if (minigolfFormSection) {
                    minigolfFormSection.style.display = 'block';
                    minigolfFormSection.querySelectorAll('input, button:not(#minigolf-proceed-btn-post1)').forEach(el => el.disabled = true);
                    const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                    if(mgFeedback) {
                        const savedGolfPoints = teamData.minigolfScores[`post${POST_ID}`]?.pointsAwarded;
                        const savedGolfAverage = teamData.minigolfScores[`post${POST_ID}`]?.average;
                        if (savedGolfPoints !== undefined && savedGolfAverage !== undefined) {
                            mgFeedback.textContent = `Snitt: ${savedGolfAverage.toFixed(2)}. Poeng: ${savedGolfPoints}!`;
                        } else {
                            mgFeedback.textContent = "Minigolf fullført! Poeng registrert.";
                        }
                        mgFeedback.className = "feedback success";
                    }
                    if (minigolfProceedButton) {
                        minigolfProceedButton.style.display = 'inline-block';
                        minigolfProceedButton.disabled = false;
                    }
                }
            } else if (teamData.unlockedPosts[`post${POST_ID}`]) { // Posten er nådd
                if (teamData.mannedPostTeacherVerified[`post${POST_ID}`]) { // Lærer har verifisert
                    if (minigolfFormSection) {
                        minigolfFormSection.style.display = 'block';
                        for (let i = 1; i <= (postData.maxPlayers || MAX_PLAYERS_PER_TEAM); i++) {
                            const scoreInput = pageElement.querySelector(`#player-${i}-score-post${POST_ID}`);
                            if (scoreInput) { scoreInput.value = ''; scoreInput.disabled = false; }
                        }
                        const submitGolfBtn = pageElement.querySelector(`#submit-minigolf-post${POST_ID}`);
                        if(submitGolfBtn) submitGolfBtn.disabled = false;
                        const mgFeedback = pageElement.querySelector('#minigolf-results-feedback');
                        if(mgFeedback) { mgFeedback.textContent = ""; mgFeedback.className = "feedback";}
                        if(minigolfProceedButton) minigolfProceedButton.style.display = 'none';
                    }
                } else if (teacherPasswordSection) { // Vis lærerpassord-seksjon
                    teacherPasswordSection.style.display = 'block';
                }
            } else if (postInfoSection) { // Post ikke nådd enda
                postInfoSection.style.display = 'block';
            }
            
            // Oppdater instruksjoner spesifikt for denne posten
            const instrElement = pageElement.querySelector('#minigolf-instructions-post1');
            if (instrElement && postData.instructions) {
                instrElement.textContent = postData.instructions;
            }
            const mannedInstrElement = pageElement.querySelector('.manned-post-instruction-placeholder');
            if (mannedInstrElement && postData.instructions) { // Gjenbruk for lærer-seksjon
                 mannedInstrElement.textContent = "Lærer: Tast inn passord for å starte minigolfoppgaven.";
            }


        },
        // Funksjon for å håndtere innsending (vil bli kalt av event listener i core.js eller her)
        // Foreløpig kaller vi den direkte fra en event listener satt opp i initUI
        // Alternativt kan core.js kalle denne hvis den er registrert.
        // For nå, la oss holde det enkelt og la initUI sette opp sin egen submit-handler.
    };

    // Lokal funksjon for å håndtere minigolf-innsending
    function handleMinigolfSubmission(pageElement, teamData) {
        logToMobile(`Post ${POST_ID}: handleMinigolfSubmission kalt`, "debug");
        const feedbackElement = pageElement.querySelector('#minigolf-results-feedback'); 
        
        let totalScore = 0; let playerCount = 0; let scoresValid = true;

        for (let i = 1; i <= (postData.maxPlayers || MAX_PLAYERS_PER_TEAM); i++) {
            const scoreInput = pageElement.querySelector(`#player-${i}-score-post${POST_ID}`);
            if (scoreInput && scoreInput.value !== '') {
                const score = parseInt(scoreInput.value, 10);
                if (isNaN(score) || score < (postData.minScorePerPlayer || 3)) { 
                    scoresValid = false;
                    if(feedbackElement) {feedbackElement.textContent = `Ugyldig score for Spiller ${i}. Minimum ${postData.minScorePerPlayer || 3} slag.`; feedbackElement.className = "feedback error";}
                    scoreInput.classList.add('shake'); setTimeout(()=>scoreInput.classList.remove('shake'), 400);
                    break;
                }
                teamData.minigolfScores[`post${POST_ID}`]['player' + i] = score; // Bruk teamData direkte
                totalScore += score; playerCount++;
            } else if (scoreInput && scoreInput.value === '' && playerCount > 0 && i <= playerCount+1) {
                teamData.minigolfScores[`post${POST_ID}`]['player' + i] = null;
            } else if (scoreInput && scoreInput.value === '' && i === 1) { 
                scoresValid = false;
                if(feedbackElement) {feedbackElement.textContent = `Minst én spiller må ha score.`; feedbackElement.className = "feedback error";}
                break;
            }
        }

        if (!scoresValid || playerCount === 0) {
            if (playerCount === 0 && scoresValid && feedbackElement) {
                 feedbackElement.textContent = `Minst én spiller må ha score.`; feedbackElement.className = "feedback error";
            }
            return;
        }

        const averageScore = totalScore / playerCount;
        teamData.minigolfScores[`post${POST_ID}`].average = averageScore;

        let pointsAwarded = 0;
        const currentPointsScale = postData.pointsScale || {};
        for (const scoreThreshold in currentPointsScale) {
            if (averageScore <= parseFloat(scoreThreshold)) {
                pointsAwarded = currentPointsScale[scoreThreshold];
                break;
            }
        }
        
        teamData.minigolfScores[`post${POST_ID}`].pointsAwarded = pointsAwarded;
        // Poengsum og fullføring håndteres av CoreApp.markPostAsCompleted
        
        if(feedbackElement) {feedbackElement.textContent = `Snitt: ${averageScore.toFixed(2)}. Poeng: ${pointsAwarded}!`; feedbackElement.className = "feedback success";}
        pageElement.querySelectorAll('.minigolf-form-section input, #submit-minigolf-post1').forEach(el => el.disabled = true);
        
        const proceedButton = pageElement.querySelector('#minigolf-proceed-btn-post1'); 
        if (proceedButton) {
            proceedButton.style.display = 'inline-block'; 
            proceedButton.disabled = false;
        }
        // Kall CoreApp for å markere posten som fullført og gi poeng
        CoreApp.markPostAsCompleted(POST_ID, pointsAwarded);
    }

    // Registrer posten hos kjerneapplikasjonen
    if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
        window.CoreApp.registerPost(postData);
    } else {
        // Prøv igjen om et øyeblikk hvis CoreApp ikke er klar enda
        setTimeout(() => {
            if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
                window.CoreApp.registerPost(postData);
            } else {
                console.error(`Post ${POST_ID}: CoreApp or registerPost function not found after delay.`);
            }
        }, 500);
    }
})();
/* Version: #38 */
