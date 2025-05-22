/* Version: #40 */
// Filnavn: posts/post5.js

function definePost5() {
    return {
        id: 5,
        name: "Krysset Øverbyvegen/Prost Bloms Gate",
        lat: 60.803527350299944,
        lng: 10.66552015165931,
        type: "standard",
        question: "Hva er spørsmålet i krysset?", // ERSTATT
        correctAnswer: "SVARPOST5", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost5());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost5() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost5());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost5);
    }, { once: true });
}
/* Version: #40 */
