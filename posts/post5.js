/* Version: #58 */
// Filnavn: posts/post5.js

function definePost5() {
    const POST_ID = 5;
    return {
        id: POST_ID,
        name: "Gjøvik Gård (Hint-oppgave)", // Foreslått navn
        lat: 60.79442,    // ERSTATT MED KORREKT LATITUDE for Gjøvik Gård
        lng: 10.69259,    // ERSTATT MED KORREKT LONGITUDE for Gjøvik Gård
        type: "standard_hint", // Ny type for å signalisere hint-logikk i core.js
        question: "Hvem grunnla Gjøvik by?",
        correctAnswer: "CASPAR KAUFFELDT", // Svar med både fornavn og etternavn
        hints: [
            "Dere lærte om han under Gjøvik Glassbyen.", // Hint 1 (vises med oppgaven)
            "Han var eier av Gjøvik gård.",             // Hint 2 (vises etter 1. feil svar)
            "En gate på Gjøvik har etternavnet hans i seg.", // Hint 3 (vises etter 2. feil svar)
            "Initialene er; CK.",                        // Hint 4 (vises etter 3. feil svar)
            "Fornavnet er Caspar."                       // Hint 5 (vises etter 4. feil svar)
        ],
        // maxAttempts settes til antall hint + 1 for å gi ett forsøk per hint, og ett siste forsøk med alle hint
        // Dette håndteres nå av core.js sin standard poenglogikk, men vi kan overstyre hvis nødvendig.
        // Standard poenglogikk (5 forsøk) passer bra med 5 hint.
        // pointsPerCorrect vil bruke standard poenglogikk (5 poeng på første, -1 per feil)

        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} initUI: Kjører.`, "debug");

            const hintsContainer = pageElement.querySelector('#hints-container-post5');
            const hintsList = pageElement.querySelector('#hints-list-post5');

            if (!hintsContainer || !hintsList) {
                currentLog(`Post ${POST_ID} initUI: Fant ikke hint-containere.`, "warn");
                return;
            }

            hintsList.innerHTML = ''; // Tøm tidligere hint

            const attemptsMade = (teamData && teamData.taskAttempts && teamData.taskAttempts[`post${POST_ID}`]) || 0;
            const hintsToShow = Math.min(this.hints.length, attemptsMade + 1); // Vis ett hint mer enn antall feil forsøk (minst 1)

            if (hintsToShow > 0) {
                hintsContainer.style.display = 'block';
                for (let i = 0; i < hintsToShow; i++) {
                    const li = document.createElement('li');
                    li.textContent = this.hints[i];
                    hintsList.appendChild(li);
                }
            } else {
                hintsContainer.style.display = 'none';
            }

            // Standard UI-oppsett (input-felt, knapper) håndteres av resetPageUI i core.js
            // basert på om posten er ulåst/fullført.
            // Her fokuserer vi kun på å vise riktig antall hint.
        }
    };
}
/* Version: #58 */
