/* Version: #40 */
// Filnavn: posts/post7.js

function definePost7() {
    const POST_ID = 7;
    return {
        id: POST_ID,
        name: "Geo-løp Kunstgresset", // Navnet på selve posten
        lat: 60.8006280021653, // Dette er GEO_RUN_POINT1.lat
        lng: 10.683461472668988, // Dette er GEO_RUN_POINT1.lng
        type: "georun",
        instructionsTask: "Fullfør Geo-løpet! Løp mellom de to markerte punktene på kartet. Du må krysse 2 ganger (frem og tilbake én gang).", // Vises i setup-seksjonen
        
        // Geo-løp spesifikke data
        geoRunPoint1: { lat: 60.8006280021653, lng: 10.683461472668988, name: "Start/Vendepunkt 1 (Geo-løp)" },
        geoRunPoint2: { lat: 60.79971947637134, lng: 10.683614899042398, name: "Vendepunkt 2 (Geo-løp)" },
        lapsNormal: 2, // Antall kryssinger for vanlig modus
        lapsTest: 1,   // Antall kryssinger for testmodus
        preCountdownPips: 3,
        preCountdownInterval: 20, // sekunder
        countdownSeconds: 10,
        pointsScale: { // Tid i sekunder: poeng
            30: 10, 40: 9, 50: 8, 60: 7, 75: 6, 90: 5, 105: 4, 120: 3, 150: 2, Infinity: 1 
        },

        initUI: function(pageElement, teamData) {
            // initUI for Post 7 vil bli kalt av core.js
            // Den er ansvarlig for å vise riktig seksjon (setup, active, results)
            // basert på teamData.geoRunState[`post7`]
            // Denne logikken er allerede i resetPageUI i core.js, så initUI kan være tom
            // eller kun sette spesifikk tekst hvis nødvendig.
            if (window.logToMobile) logToMobile(`Post ${POST_ID}: Kaller initUI (GeoRun).`, "debug");
            else console.debug(`Post ${POST_ID}: Kaller initUI (GeoRun).`);
        }
    };
}

if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
    window.CoreApp.registerPost(definePost7());
} else {
    document.addEventListener('coreAppReady', function onCoreAppReadyForPost7() {
        if (window.CoreApp && typeof window.CoreApp.registerPost === 'function') {
            window.CoreApp.registerPost(definePost7());
        }
        document.removeEventListener('coreAppReady', onCoreAppReadyForPost7);
    }, { once: true });
}
/* Version: #40 */