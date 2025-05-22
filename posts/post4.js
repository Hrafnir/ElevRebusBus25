/* Version: #40 */
// Filnavn: posts/post4.js

function definePost4() {
    return {
        id: 4,
        name: "Åttekanten på Eiktunet",
        lat: 60.80469643634315,
        lng: 10.646298022954033,
        type: "standard",
        question: "Hva er spørsmålet ved Åttekanten?", // ERSTATT
        correctAnswer: "SVARPOST4", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost4());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost4() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost4());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost4);
    }, { once: true });
}
/* Version: #40 */
