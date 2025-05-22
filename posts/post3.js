/* Version: #40 */
// Filnavn: posts/post3.js

function definePost3() {
    return {
        id: 3,
        name: "Lavvoen Øverby",
        lat: 60.80121161360927,
        lng: 10.645440903323017,
        type: "standard",
        question: "Hva er spørsmålet ved Lavvoen på Øverby?", // ERSTATT
        correctAnswer: "SVARPOST3", // ERSTATT
    };
}
if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost3());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost3() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost3());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost3);
    }, { once: true });
}
/* Version: #40 */
