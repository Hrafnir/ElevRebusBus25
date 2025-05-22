/* Version: #40 */
// Filnavn: posts/post6.js

function definePost6() {
    return {
        id: 6,
        name: "Hunn Gravlund",
        lat: 60.80202682020165,
        lng: 10.673687047853834,
        type: "standard",
        question: "Hva er spørsmålet på Hunn Gravlund?", // ERSTATT
        correctAnswer: "SVARPOST6", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost6());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost6() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost6());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost6);
    }, { once: true });
}
/* Version: #40 */
