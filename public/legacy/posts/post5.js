/* Version: #65 */
// Filnavn: posts/post5.js

function definePost5() {
    const POST_ID = 5;
    return {
        id: POST_ID,
        name: "Krysset Øverbyvegen/Prost Bloms gate (Hint-oppgave)", // Oppdatert navn
        lat: 60.80357722632382,    // Korrekt latitude
        lng: 10.66556509447771,    // Korrekt longitude
        type: "standard_hint",
        question: "Hvem grunnla Gjøvik by?",
        correctAnswer: "CASPAR KAUFFELDT",
        hints: [
            "Dere lærte om han under Gjøvik Glassbyen.",
            "Han var eier av Gjøvik gård.",
            "En gate på Gjøvik har etternavnet hans i seg.",
            "Initialene er; CK.",
            "Fornavnet er Caspar."
        ],
        // initUI for å vise hintene er allerede definert i forrige versjon av post5.js (v58)
        // og vil fortsatt fungere.
        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            // currentLog(`Post ${POST_ID} initUI: Kjører.`, "debug"); // Kan redusere logging hvis ønskelig

            const hintsContainer = pageElement.querySelector('#hints-container-post5');
            const hintsList = pageElement.querySelector('#hints-list-post5');

            if (!hintsContainer || !hintsList) {
                currentLog(`Post ${POST_ID} initUI: Fant ikke hint-containere.`, "warn");
                return;
            }

            hintsList.innerHTML = ''; // Tøm tidligere hint

            // Antall forsøk gjort på denne posten
            const attemptsMade = (teamData && teamData.taskAttempts && teamData.taskAttempts[`post${POST_ID}`]) || 0;

            // Antall hint som skal vises:
            // Første hint (indeks 0) vises alltid (når attemptsMade er 0).
            // For hvert feil forsøk (attemptsMade > 0), vises ett hint til.
            // Så, hvis attemptsMade er 1 (ett feil svar), skal hint 0 og 1 vises (dvs. hintsToShow = 2).
            // Maks antall hint er lengden på hints-arrayen.
            const hintsToShow = Math.min(this.hints.length, attemptsMade + 1);

            if (this.hints && this.hints.length > 0 && hintsToShow > 0) {
                hintsContainer.style.display = 'block';
                for (let i = 0; i < hintsToShow; i++) {
                    if (this.hints[i]) { // Sjekk at hintet faktisk finnes
                        const li = document.createElement('li');
                        li.textContent = this.hints[i];
                        hintsList.appendChild(li);
                    }
                }
            } else {
                hintsContainer.style.display = 'none';
            }
        }
    };
}
/* Version: #65 */
