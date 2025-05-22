/* Version: #40 */
// Filnavn: posts/post2.js

function definePost2() {
    return {
        id: 2,
        name: "Hunn Kirke",
        lat: 60.7941862597763, 
        lng: 10.656946793729826,
        type: "standard", 
        question: "Hva er spørsmålet for Hunn Kirke?", // ERSTATT MED FAKTISK SPØRSMÅL
        correctAnswer: "SVARPOST2", // ERSTATT MED FAKTISK SVAR
        maxAttempts: 5, 
        pointsPerCorrect: 10 
        // Ingen initUI eller handleSubmit nødvendig hvis core.js håndterer 'standard' type
    };
}

if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost2());
} else {
    console.error("Post 2: CoreApp ikke funnet for registrering.");
    // Fallback lytter hvis CoreApp ikke er klar umiddelbart
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost2() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost2());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost2);
    }, { once: true });
}
/* Version: #40 */
