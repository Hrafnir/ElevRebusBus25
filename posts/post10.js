/* Version: #40 */
// Filnavn: posts/post10.js

function definePost10() {
    return {
        id: 10,
        name: "Hovdetoppen Restaurant",
        lat: 60.793880419179715,
        lng: 10.678003145501888,
        type: "standard",
        question: "Hva er spørsmålet på Hovdetoppen?", // ERSTATT
        correctAnswer: "SVARPOST10", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost10());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost10() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost10());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost10);
    }, { once: true });
}
/* Version: #40 */
