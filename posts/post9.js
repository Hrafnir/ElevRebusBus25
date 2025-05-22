/* Version: #40 */
// Filnavn: posts/post9.js

function definePost9() {
    return {
        id: 9,
        name: "Gjøvik Olympiske Fjellhall",
        lat: 60.793249975246106,
        lng: 10.685006947085599,
        type: "standard",
        question: "Hva er spørsmålet ved Fjellhallen?", // ERSTATT
        correctAnswer: "SVARPOST9", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost9());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost9() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost9());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost9);
    }, { once: true });
}
/* Version: #40 */
