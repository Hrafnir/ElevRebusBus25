/* Version: #80 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapActiveTargetMarker = null;

function definePost7() {
    const POST_ID = 7;

    // === NYESTE MIDLERTIDIGE KOORDINATER FOR LOKAL TESTING (v3) ===
    const geoRunPointsData_Test_v3 = [
        { lat: 60.7962070145891,  lng: 10.671000235856763, name: "Test v3 Start / Mål" },   // Indeks 0
        { lat: 60.796185555247746, lng: 10.67127995809284,  name: "Test v3 Vendepunkt 1" },  // Indeks 1
        { lat: 60.79620787296244,  lng: 10.671174402532056, name: "Test v3 Vendepunkt 2" },  // Indeks 2
        { lat: 60.79626366718118,  lng: 10.671140976604477, name: "Test v3 Vendepunkt 3" },  // Indeks 3
        { lat: 60.79624478299495,  lng: 10.67123773586853,  name: "Test v3 Vendepunkt 4" }   // Indeks 4
    ];

    // === FORRIGE MIDLERTIDIGE KOORDINATER (BEHOLDES FOR REFERANSE) ===
    /*
    const geoRunPointsData_Test_v2 = [
        { lat: 60.81286562370762, lng: 10.67318320334532, name: "Test v2 Start / Mål" },
        { lat: 60.81351808494966,  lng: 10.672979594515702, name: "Test v2 Vendepunkt 1" },
        { lat: 60.813318858891186, lng: 10.672486589950358, name: "Test v2 Vendepunkt 2" },
        { lat: 60.81335332424741,  lng: 10.673091641007826, name: "Test v2 Vendepunkt 3" },
        { lat: 60.81348193854172,  lng: 10.672417638262901, name: "Test v2 Vendepunkt 4" }
    ];
    */

    // === OPPRINNELIGE KOORDINATER (BEHOLDES FOR ENKEL TILBAKEKOBLING) ===
    const geoRunPointsData_Original = [
        { lat: 60.80063153980609, lng: 10.68346857893824, name: "Start / Mål" },
        { lat: 60.80016284763752, lng: 10.683027279834748, name: "Vendepunkt 1" },
        { lat: 60.80044715403525, lng: 10.68399856015822, name: "Vendepunkt 2" },
        { lat: 60.800418311472285, lng: 10.682976604339615, name: "Vendepunkt 3" },
        { lat: 60.800194780728354, lng: 10.684047124174391, name: "Vendepunkt 4" }
    ];

    // VELG HVILKET SETT MED KOORDINATER SOM SKAL BRUKES:
    const activeGeoRunPoints = geoRunPointsData_Test_v3; // Endre her for å bytte

    const runTargetIndices = [1, 2, 3, 4, 0];
    const totalLegsToComplete = runTargetIndices.length;

    const miniMapStyles = [
        { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
    ];

    return {
        id: POST_ID,
        name: "Geo-løp Stjerne (Test v3)", // Oppdatert navn for test
        lat: activeGeoRunPoints[0].lat,
        lng: activeGeoRunPoints[0].lng,
        type: "georun",

        instructionsInitial: "Du har ankommet startområdet for Geo-løpet! Kartet nedenfor viser din posisjon og Startpunktet.",
        instructionsBeforeStart: `Når du er innenfor ${GEO_RUN_START_RADIUS} meter av Startpunktet (se kart), vil 'Start Geo-Løp'-knappen nedenfor bli aktiv. Trykk på den for å begynne!`,
        instructionsDuringRun: `Løp til det GULE punktet på kartet! Når du kommer frem (innenfor ${GEO_RUN_WAYPOINT_RADIUS} meter), vil neste punkt i løypa automatisk vises. Fortsett slik til du er tilbake ved Startpunktet (som da er Mål). Gi gass!`,

        geoRunPoints: activeGeoRunPoints,
        runTargetIndices: runTargetIndices,
        lapsToComplete: totalLegsToComplete,

        pointsScale: { // Disse tidene må kanskje justeres for test-koordinatene v3
            30: 10, 45: 8, 60: 6, 90: 4, 120: 2, Infinity: 1
        },

        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            // currentLog(`Post ${POST_ID} (GeoRun Stjerne - Test Mode v3) initUI: Kjører.`, "debug");

            if (!pageElement || !teamData || !teamData.geoRunState || !teamData.geoRunState[`post${POST_ID}`]) {
                currentLog(`Post ${POST_ID} initUI: Mangler pageElement, teamData eller geoRunState. Avbryter.`, "warn");
                return;
            }

            const runState = teamData.geoRunState[`post${POST_ID}`];

            const initialInstructionsEl = pageElement.querySelector('#georun-instructions-initial');
            const beforeStartInstructionsEl = pageElement.querySelector('#georun-instructions-before-start');
            const startButtonSectionEl = pageElement.querySelector('.geo-run-start-button-section');
            const startButtonEl = pageElement.querySelector(`#start-georun-btn-post${POST_ID}`);
            const activeSectionEl = pageElement.querySelector('.geo-run-active-section');
            const duringRunInstructionsEl = pageElement.querySelector('#georun-instructions-during-run');
            const currentLapEl = pageElement.querySelector('.geo-run-current-lap');
            const totalLapsDisplayEl = pageElement.querySelector(`#georun-total-laps-display${POST_ID}`);
            const nextTargetEl = pageElement.querySelector('.geo-run-next-target');
            const processingResultsMsgEl = pageElement.querySelector('#georun-processing-results-msg');
            const resultsSectionEl = pageElement.querySelector('.geo-run-results-section');
            const totalTimeEl = pageElement.querySelector('.geo-run-total-time');
            const pointsAwardedEl = pageElement.querySelector('.geo-run-points-awarded');
            const proceedButtonEl = pageElement.querySelector(`#geo-run-proceed-btn-post${POST_ID}`);
            const miniMapDiv = pageElement.querySelector(`#georun-map-in-post${POST_ID}`);

            // Skjul alle seksjoner som kan endre synlighet
            if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
            if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';
            if(startButtonSectionEl) startButtonSectionEl.style.display = 'none';
            if(activeSectionEl) activeSectionEl.style.display = 'none';
            if(processingResultsMsgEl) processingResultsMsgEl.style.display = 'none'; 
            if(resultsSectionEl) resultsSectionEl.style.display = 'none';
            if(duringRunInstructionsEl) duringRunInstructionsEl.style.display = 'none';
            if(miniMapDiv) miniMapDiv.style.display = 'block';

            if(totalLapsDisplayEl) totalLapsDisplayEl.textContent = this.lapsToComplete;

            if (miniMapDiv && typeof google !== 'undefined' && google.maps) {
                if (!geoRunMiniMapInstance || !geoRunMiniMapInstance.getDiv() || geoRunMiniMapInstance.getDiv().id !== miniMapDiv.id ) {
                    if (geoRunMiniMapInstance) { this.cleanupUI(); }
                    geoRunMiniMapInstance = new google.maps.Map(miniMapDiv, {
                        mapTypeId: google.maps.MapTypeId.SATELLITE,
                        disableDefaultUI: true, zoomControl: true, draggable: true, scrollwheel: true,
                        styles: miniMapStyles
                    });
                    const bounds = new google.maps.LatLngBounds();
                    this.geoRunPoints.forEach(point => bounds.extend(point));
                    if (!bounds.isEmpty()) {
                        geoRunMiniMapInstance.fitBounds(bounds);
                         google.maps.event.addListenerOnce(geoRunMiniMapInstance, 'idle', () => {
                           if (geoRunMiniMapInstance.getZoom() > 19) geoRunMiniMapInstance.setZoom(19);
                         });
                    } else if (this.geoRunPoints[0]) {
                        geoRunMiniMapInstance.setCenter(this.geoRunPoints[0]);
                        geoRunMiniMapInstance.setZoom(18);
                    }
                }
                let currentUserPosForMiniMap = null;
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                } else if (DEV_MODE_NO_GEOFENCE && this.geoRunPoints[0]) { // DEV_MODE_NO_GEOFENCE refereres her, men verdien settes i core.js
                    currentUserPosForMiniMap = new google.maps.LatLng(this.geoRunPoints[0].lat, this.geoRunPoints[0].lng);
                }
                this.updateMiniMapDisplay(currentUserPosForMiniMap, teamData);
            } else if (miniMapDiv) {
                miniMapDiv.innerHTML = "<p style='text-align:center; color:red;'>Google Maps API ikke lastet.</p>";
            }

            // Logikk for å vise UI-seksjoner
            if (runState.finished) { // Løpet er helt ferdig
                currentLog(`Post ${POST_ID} initUI: Løp helt fullført. Viser endelige resultater.`, "debug");
                if(resultsSectionEl) resultsSectionEl.style.display = 'block';
                if(totalTimeEl && runState.endTime && runState.startTime) {
                    totalTimeEl.textContent = formatTimeFromMs(runState.endTime - runState.startTime);
                }
                if(pointsAwardedEl) {
                    pointsAwardedEl.textContent = runState.pointsAwarded !== undefined ? runState.pointsAwarded : "0";
                }
                if(proceedButtonEl) proceedButtonEl.style.display = 'inline-block';
                
                // Sørg for at andre seksjoner er skjult
                if(processingResultsMsgEl) processingResultsMsgEl.style.display = 'none';
                if(activeSectionEl) activeSectionEl.style.display = 'none';
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'none';
                if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
                if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';

            } else if (runState.active) { // Løpet pågår (men ikke ferdig)
                currentLog(`Post ${POST_ID} initUI: Løp aktivt. Viser aktiv seksjon.`, "debug");
                if(activeSectionEl) activeSectionEl.style.display = 'block';
                if(duringRunInstructionsEl) {
                    duringRunInstructionsEl.textContent = this.instructionsDuringRun;
                    duringRunInstructionsEl.style.display = 'block';
                }
                if(currentLapEl) currentLapEl.textContent = `${runState.lap}`;
                if(nextTargetEl && runState.lap > 0 && runState.lap <= this.runTargetIndices.length) {
                    const targetPointIndex = this.runTargetIndices[runState.lap - 1];
                    nextTargetEl.textContent = this.geoRunPoints[targetPointIndex].name;
                }
            } else if (runState.awaitingGeoRunStartConfirmation) { // Venter på at bruker trykker start
                currentLog(`Post ${POST_ID} initUI: Venter på startknapp-trykk.`, "debug");
                 if(initialInstructionsEl) { initialInstructionsEl.textContent = this.instructionsInitial; initialInstructionsEl.style.display = 'block'; }
                if(beforeStartInstructionsEl) { beforeStartInstructionsEl.textContent = this.instructionsBeforeStart; beforeStartInstructionsEl.style.display = 'block'; }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true; // Aktiveres av core.js
            } else { // Første ankomst til posten (eller annen udefinert tilstand før aktiv/start)
                currentLog(`Post ${POST_ID} initUI: Første ankomst / generelle instruksjoner.`, "debug");
                if(initialInstructionsEl) { initialInstructionsEl.textContent = this.instructionsInitial; initialInstructionsEl.style.display = 'block'; }
                 if(beforeStartInstructionsEl) { beforeStartInstructionsEl.textContent = this.instructionsBeforeStart; beforeStartInstructionsEl.style.display = 'block'; }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true;
            }
        },

        updateMiniMapDisplay: function(userLatLng, teamData) {
            if (!geoRunMiniMapInstance || !teamData || !teamData.geoRunState || !this.geoRunPoints || !this.runTargetIndices) return;
            const runState = teamData.geoRunState[`post${POST_ID}`];
            if (!runState) return;

            if (userLatLng) {
                if (geoRunMiniMapUserMarker) {
                    geoRunMiniMapUserMarker.setPosition(userLatLng);
                } else if (geoRunMiniMapInstance) {
                     geoRunMiniMapUserMarker = new google.maps.Marker({
                        position: userLatLng, map: geoRunMiniMapInstance, title: "Din Posisjon",
                        icon: { 
                            path: google.maps.SymbolPath.CIRCLE, 
                            scale: 7, 
                            fillColor: (typeof DEV_MODE_NO_GEOFENCE !== 'undefined' && DEV_MODE_NO_GEOFENCE && this.geoRunPoints[0] && userLatLng.lat().toFixed(6) === this.geoRunPoints[0].lat.toFixed(6) && userLatLng.lng().toFixed(6) === this.geoRunPoints[0].lng.toFixed(6)) ? "#FFA500" : "#4285F4", 
                            fillOpacity: 1, 
                            strokeWeight: 1.5, 
                            strokeColor: "white" 
                        }
                    });
                }
                // Panorer til brukerens posisjon hvis markøren er gyldig og på kartet
                if (geoRunMiniMapInstance && geoRunMiniMapUserMarker && geoRunMiniMapUserMarker.getMap()) {
                    geoRunMiniMapInstance.panTo(userLatLng);
                    // Optional: Adjust zoom if needed, e.g., if map is too zoomed out
                    // if (geoRunMiniMapInstance.getZoom() < 17) {
                    //     geoRunMiniMapInstance.setZoom(17);
                    // }
                }
            } else if (geoRunMiniMapUserMarker) {
                geoRunMiniMapUserMarker.setMap(null);
                geoRunMiniMapUserMarker = null;
            }

            if (geoRunMiniMapActiveTargetMarker) {
                geoRunMiniMapActiveTargetMarker.setMap(null);
                geoRunMiniMapActiveTargetMarker = null;
            }

            let nextTargetPointData = null;
            let targetLabel = '';

            if (runState.active && !runState.finished && runState.lap > 0 && runState.lap <= this.runTargetIndices.length) {
                const targetIndex = this.runTargetIndices[runState.lap - 1];
                nextTargetPointData = this.geoRunPoints[targetIndex];
                targetLabel = targetIndex === 0 ? 'M' : (targetIndex).toString();
            } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) { 
                nextTargetPointData = this.geoRunPoints[0];
                targetLabel = 'S';
            } else if (runState.finished) { // Hvis ferdig, vis målpunktet
                nextTargetPointData = this.geoRunPoints[0];
                targetLabel = 'M';
            }


            if (nextTargetPointData && geoRunMiniMapInstance) { // Sjekk også geoRunMiniMapInstance her
                geoRunMiniMapActiveTargetMarker = new google.maps.Marker({
                    position: nextTargetPointData,
                    map: geoRunMiniMapInstance,
                    title: nextTargetPointData.name,
                    icon: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                    label: { text: targetLabel, color: "black", fontWeight: "bold" }
                });
            }
        },

        cleanupUI: function() {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                if (geoRunMiniMapActiveTargetMarker) geoRunMiniMapActiveTargetMarker.setMap(null);
                geoRunMiniMapUserMarker = null;
                geoRunMiniMapActiveTargetMarker = null;

                const mapDiv = document.getElementById(`georun-map-in-post${POST_ID}`);
                if (mapDiv) mapDiv.innerHTML = ''; // Fjern innholdet for å la Google Maps rydde opp
                geoRunMiniMapInstance = null; // Sett til null for å tillate re-initialisering
                currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: MiniMap ryddet.`, "debug");
            }
        }
    };
    // return postData; // Denne linjen var kommentert ut, men bør være aktiv.
}
/* Version: #80 */
