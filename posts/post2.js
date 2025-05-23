/* Version: #51 */
// Filnavn: posts/post2.js

function definePost2() {
    return {
        id: 2,
        name: "Hunn Kirke",
        lat: 60.7941862597763,
        lng: 10.656946793729826,
        type: "standard", // Standard oppgave med inputfelt
        question: "Hvor mange mursteiner er det i høyden på den store nord-veggen i Hunn kirke?",
        // For intervallsvar, kan vi definere det slik:
        answerRange: {
            min: 125,
            max: 131
        },
        // correctAnswer kan fortsatt være det "ideelle" svaret for referanse, eller fjernes hvis answerRange brukes.
        // La oss beholde det for nå, men logikken vil bruke answerRange.
        correctAnswer: "126", // Dette er det "perfekte" svaret
        maxAttempts: 5, // Antall forsøk elevene får
        pointsPerCorrect: 10 // Poeng for riktig svar
        // initUI er ikke nødvendig for standardposter med mindre spesiell UI-logikk trengs utover det core.js gjør.
    };
}
/* Version: #51 */
