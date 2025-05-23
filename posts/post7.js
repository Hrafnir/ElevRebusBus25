/* Version: #53 */
// Filnavn: posts/post7.js

function definePost7() {
    const POST_ID = 7;
    return {
        id: POST_ID,
        name: "Geo-løp Kunstgresset",
        lat: 60.8006280021653, // Hovedpostens koordinat (kan være identisk med geoRunPoint1)
        lng: 10.683461472668988,
        type: "georun",

        // Nye, tydeligere instruksjoner
        instructionsInitial: "Du har ankommet startområdet for Geo-løpet! Kartet nedenfor viser din posisjon og startpunktet for løpet (Punkt 1).",
        instructionsBeforeStart: "Når du er innenfor 5 meter av Punkt 1, vil 'Start Geo-Løp'-knappen bli aktiv. Trykk på den for å starte tidtakingen.",
        instructionsDuringRun: "Løp til det markerte vendepunktet på kartet. Når du når det, vil neste vendepunkt vises. Du skal krysse banen totalt 5 ganger (frem, tilbake, frem, tilbake, frem). Lykke til!",

        geoRunPoint1: { lat: 60.8006280021653, lng: 10.683461472668988, name: "Start/Mål (Punkt 1)" },
        geoRunPoint2: { lat: 60.79971947637134, lng: 10.683614899042398, name: "Vendepunkt (Punkt 2)" },
        lapsToComplete: 5, // Antall kryssinger (en runde er frem OG tilbake, så 2 kryssinger. 5 kryssinger = 2.5 runder)

        pointsScale: { // Tid i sekunder for 5 kryssinger: poeng
            // Juster disse tidene etter behov for 5 kryssinger
            60: 10,  // Ekstremt raskt
            75: 9,
            90: 8,
            105: 7,
            120: 6,  // 2 minutter
            150: 5,  // 2.5 minutter
            180: 4,  // 3 minutter
            210: 3,
            240: 2,  // 4 minutter
            Infinity: 1
        },

        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun) initUI: Kjører.`, "debug");

            if (!pageElement || !teamData || !teamData.geoRunState || !teamData.geoRunState[`post${POST_ID}`]) {
                currentLog(`Post ${POST_ID} initUI: Mangler pageElement, teamData eller geoRunState. Avbryter.`, "warn");
                return;
            }

            const runState = teamData.geoRunState[`post${POST_ID}`];

            const initialInstructionsEl = pageElement.querySelector('#georun-instructions-initial');
            const beforeStartInstructionsEl = pageElement.querySelector('#georun-instructions-before-start');
            const startButtonSectionEl = pageElement.querySelector('.geo-run-start-button-section');
            const startButtonEl = pageElement.querySelector(`#start-georun-btn-post${POST_ID}`);
            const activeSectionEl = pageElement.querySelector('.geo-run-active-section');
            const duringRunInstructionsEl = pageElement.querySelector('#georun-instructions-during-run');
            const currentLapEl = pageElement.querySelector('.geo-run-current-lap');
            const nextTargetEl = pageElement.querySelector('.geo-run-next-target');
            const resultsSectionEl = pageElement.querySelector('.geo-run-results-section');
            const totalTimeEl = pageElement.querySelector('.geo-run-total-time');
            const pointsAwardedEl = pageElement.querySelector('.geo-run-points-awarded');
            const proceedButtonEl = pageElement.querySelector(`#geo-run-proceed-btn-post${POST_ID}`);
            const mapContainerInPost = pageElement.querySelector(`#georun-map-in-post${POST_ID}`);


            // Skjul alle seksjoner som standard
            if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
            if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';
            if(startButtonSectionEl) startButtonSectionEl.style.display = 'none';
            if(activeSectionEl) activeSectionEl.style.display = 'none';
            if(resultsSectionEl) resultsSectionEl.style.display = 'none';
            if(duringRunInstructionsEl) duringRunInstructionsEl.style.display = 'none';
            if(mapContainerInPost) mapContainerInPost.style.display = 'block'; // Kartet skal alltid vises


            if (runState.finished) {
                currentLog(`Post ${POST_ID} initUI: Løp fullført. Viser resultater.`, "debug");
                if(resultsSectionEl) resultsSectionEl.style.display = 'block';
                if(totalTimeEl && runState.endTime && runState.startTime) {
                    totalTimeEl.textContent = formatTimeFromMs(runState.endTime - runState.startTime);
                }
                if(pointsAwardedEl) { // Poeng beregnes og settes av CoreApp.markPostAsCompleted, hent fra teamData
                    const completedPostEntry = teamData.taskCompletionTimes && teamData.taskCompletionTimes[`post${POST_ID}`];
                    let savedPoints = 0;
                    // Må finne poengene som ble lagret. Dette er litt klønete.
                    // En bedre løsning ville vært å lagre poengene direkte i runState eller en egen poengstruktur.
                    // For nå, hvis posten er fullført, må vi anta at poengene er i teamData.score
                    // og at vi kan vise det som ble gitt.
                    // Dette er vanskelig å hente nøyaktig her uten å vite hva som ble gitt til markPostAsCompleted.
                    // La oss foreløpig bare vise det som står i `currentTeamData.score` hvis det er eneste post
                    // eller en placeholder.
                    // TODO: Lagre poeng for GeoRun spesifikt i teamData.geoRunState[postX].pointsAwarded
                    pointsAwardedEl.textContent = teamData.geoRunState[`post${POST_ID}`]?.lastAwardedPoints || "Beregnet";
                }
                if(proceedButtonEl) proceedButtonEl.style.display = 'inline-block';

            } else if (runState.active) {
                currentLog(`Post ${POST_ID} initUI: Løp aktivt. Viser aktiv seksjon.`, "debug");
                if(activeSectionEl) activeSectionEl.style.display = 'block';
                if(duringRunInstructionsEl) {
                    duringRunInstructionsEl.textContent = this.instructionsDuringRun;
                    duringRunInstructionsEl.style.display = 'block';
                }
                if(currentLapEl) currentLapEl.textContent = `${runState.lap} av ${this.lapsToComplete}`;
                if(nextTargetEl) {
                    nextTargetEl.textContent = (runState.lap % 2 !== 0) ? this.geoRunPoint2.name : this.geoRunPoint1.name;
                }
            } else if (runState.awaitingGeoRunStartConfirmation) {
                currentLog(`Post ${POST_ID} initUI: Venter på startknapp-trykk.`, "debug");
                if(beforeStartInstructionsEl) {
                    beforeStartInstructionsEl.textContent = this.instructionsBeforeStart;
                    beforeStartInstructionsEl.style.display = 'block';
                }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true; // Deaktiveres som standard, CoreApp.handlePositionUpdate aktiverer
            } else { // Første ankomst, ikke ulåst for start ennå
                currentLog(`Post ${POST_ID} initUI: Første ankomst / generelle instruksjoner.`, "debug");
                if(initialInstructionsEl) {
                    initialInstructionsEl.textContent = this.instructionsInitial;
                    initialInstructionsEl.style.display = 'block';
                }
                // Kartmarkør for selve posten (ikke nødvendigvis GeoRunPoint1) settes av CoreApp når posten først vises
            }
        }
    };
}
/* Version: #53 */
