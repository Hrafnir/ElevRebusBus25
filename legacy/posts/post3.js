/* Version: #56 */
// Filnavn: posts/post3.js

function definePost3() {
    return {
        id: 3,
        name: "Lavvoen Øverby (Bildeoppgave)", // Oppdatert navn for klarhet
        lat: 60.80121161360927,
        lng: 10.645440903323017,
        type: "standard",
        question: "Hva er svaret på oppgaven vist i bildet?", // Denne teksten vises over bildet i HTML
        correctAnswer: "11", // Riktig svar er 11
        // maxAttempts og pointsPerCorrect vil bruke standard logikk fra core.js (5 forsøk, poengsum 5-0)
        // initUI er ikke nødvendig for denne standardoppgaven
    };
}
/* Version: #56 */
