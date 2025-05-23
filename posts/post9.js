/* Version: #64 */
// Filnavn: posts/post9.js

function definePost9() {
    return {
        id: 9,
        name: "Snublesteiner (Fjellhall-området)", // Navn justert for kontekst
        lat: 60.79501870985781, // Dine nye koordinater
        lng: 10.688823005153845, // Dine nye koordinater
        type: "standard", // Kan være standard, hintet er en del av spørsmålet
        question: "Hva het familien som bodde her, og som ble drept i Auschwitz?",
        hint: "Hint: Se etter snublesteiner i nærheten av Fjellhallen/Storgata-området for å finne etternavnet.", // Hintet kan vises sammen med spørsmålet
        correctAnswer: "JAFFE", // Svaret gjøres om til store bokstaver for sammenligning i core.js
        // maxAttempts og pointsPerCorrect vil bruke standard logikk fra core.js

        // initUI kan brukes til å dynamisk sette hint-teksten hvis vi vil
        initUI: function(pageElement, teamData) {
            const hintElement = pageElement.querySelector('.post-task-hint-placeholder');
            if (hintElement && this.hint) {
                hintElement.textContent = this.hint;
                hintElement.style.display = 'block'; // Sørg for at den vises
            } else if (hintElement) {
                hintElement.style.display = 'none'; // Skjul hvis ingen hint
            }
        }
    };
}
/* Version: #64 */
