/* Version: #71 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapActiveTargetMarker = null; // Kun én aktiv målmarkør om gangen

function definePost7() {
    const POST_ID = 7;
    const geoRunPointsData = [
        { lat: 60.80063153980609, lng: 10.68346857893824, name: "Start / Mål" },   // Indeks 0
        { lat: 60.80016284763752, lng: 10.683027279834748, name: "Vendepunkt 1" },  // Indeks 1
        { lat: 60.80044715403525, lng: 10.68399856015822, name: "Vendepunkt 2" },  // Indeks 2
        { lat: 60.800418311472285, lng: 10.682976604339615, name: "Vendepunkt 3" },  // Indeks 3
        { lat: 60.800194780728354, lng: 10.684047124174391, name: "Vendepunkt 4" }   // Indeks 4
    ];

    const runTargetIndices = [1, 2, 3, 4, 0];
    const totalLegsToComplete = runTargetIndices.length;

    const miniMapStyles = [ // Stiler for å fjerne POIs og etiketter
        { featureType: "all", elementType: "labels", stylers: [{ visibility: "off" }] },
        { featureType: "poi", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "transit", elementType: "all", stylers: [{ visibility: "off" }] },
        { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] }
    ];

    return {
        id: POST_ID,
        name: "Geo-løp Stjerne (Kunstgresset)",
        lat: geoRunPointsData[0].lat,
        lng: geoRunPointsData[0].lng,
        type: "georun",

        instructionsInitial: "Du har ankommet startområdet for Geo-løpet! Kartet nedenfor viser din posisjon og Startpunktet.",
        instructionsBeforeStart: `Når du er innenfor ${GEO_RUN_START_RADIUS} meter av Startpunktet (se kart), vil 'Start Geo-Løp'-knappen nedenfor bli aktiv. Trykk på den for å starte tidtakingen.`,
        instructionsDuringRun: `Løp til det GULE markerte vendepunktet på kartet. Du skal løpe fra punkt til punkt og avslutte tilbake ved startpunktet. Totalt ${totalLegsToComplete} etapper. Følg kartet!`,

        geoRunPoints: geoRunPointsData,
        runTargetIndices: runTargetIndices,
        lapsToComplete: totalLegsToComplete,

        pointsScale: {
            120: 10, 150: 9, 180: 8, 210: 7, 240: 6, 270: 5, 300: 4, 360: 3, 420: 2, Infinity: 1
        },

        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun Stjerne) initUI: Kjører.`, "debug");

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
            const resultsSectionEl = pageElement.querySelector('.geo-run-results-section');
            const totalTimeEl = pageElement.querySelector('.geo-run-total-time');
            const pointsAwardedEl = pageElement.querySelector('.geo-run-points-awarded');
            const proceedButtonEl = pageElement.querySelector(`#geo-run-proceed-btn-post${POST_ID}`);
            const miniMapDiv = pageElement.querySelector(`#georun-map-in-post${POST_ID}`);

            if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
            if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';
            if(startButtonSectionEl) startButtonSectionEl.style.display = 'none';
            if(activeSectionEl) activeSectionEl.style.display = 'none';
            if(resultsSectionEl) resultsSectionEl.style.display = 'none';
            if(duringRunInstructionsEl) duringRunInstructionsEl.style.display = 'none';
            if(miniMapDiv) miniMapDiv.style.display = 'block';

            if(totalLapsDisplayEl) totalLapsDisplayEl.textContent = this.lapsToComplete;

            if (miniMapDiv && typeof google !== 'undefined' && google.maps) {
                if (!geoRunMiniMapInstance || !geoRunMiniMapInstance.getDiv() || geoRunMiniMapInstance.getDiv().id !== miniMapDiv.id ) {
                    currentLog(`Post ${POST_ID} initUI: Initialiserer/Re-initialiserer GeoRun MiniMap.`, "debug");
                    if (geoRunMiniMapInstance) { this.cleanupUI(); }

                    geoRunMiniMapInstance = new google.maps.Map(miniMapDiv, {
                        mapTypeId: google.maps.MapTypeId.SATELLITE, // Endret til SATELLITE
                        disableDefaultUI: true,
                        zoomControl: true, draggable: true, scrollwheel: true,
                        styles: miniMapStyles // Bruker lokal, aggressiv stil
                    });

                    // Sett initialt kartutsnitt til å dekke alle punkter
                    const bounds = new google.maps.LatLngBounds();
                    this.geoRunPoints.forEach(point => bounds.extend(point));
                    if (!bounds.isEmpty()) {
                        geoRunMiniMapInstance.fitBounds(bounds);
                        // Du kan legge til en listener for 'idle' for å justere zoom etter fitBounds hvis nødvendig
                        // google.maps.event.addListenerOnce(geoRunMiniMapInstance, 'idle', () => {
                        // if (geoRunMiniMapInstance.getZoom() > 18) geoRunMiniMapInstance.setZoom(18);
                        // });
                    } else if (this.geoRunPoints[0]) { // Fallback hvis ingen punkter (usannsynlig)
                        geoRunMiniMapInstance.setCenter(this.geoRunPoints[0]);
                        geoRunMiniMapInstance.setZoom(17);
                    }
                }

                let currentUserPosForMiniMap = null;
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                } else if (DEV_MODE_NO_GEOFENCE && this.geoRunPoints[0]) { // Bruk startpunktet som dummy
                    currentUserPosForMiniMap = new google.maps.LatLng(this.geoRunPoints[0].lat, this.geoRunPoints[0].lng);
                }
                this.updateMiniMapDisplay(currentUserPosForMiniMap, teamData);

            } else if (miniMapDiv) {
                miniMapDiv.innerHTML = "<p style='text-align:center; color:red;'>Google Maps API ikke lastet ennå, eller kart-div feil.</p>";
            }

            // UI-seksjoner basert på tilstand
            if (runState.finished) {
                currentLog(`Post ${POST_ID} initUI: Løp fullført. Viser resultater.`, "debug");
                if(resultsSectionEl) resultsSectionEl.style.display = 'block';
                if(totalTimeEl && runState.endTime && runState.startTime) {
                    totalTimeEl.textContent = formatTimeFromMs(runState.endTime - runState.startTime);
                }
                if(pointsAwardedEl) {
                    pointsAwardedEl.textContent = runState.pointsAwarded !== undefined ? runState.pointsAwarded : "0";
                }
                if(proceedButtonEl) proceedButtonEl.style.display = 'inline-block';

            } else if (runState.active) {
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
            } else if (runState.awaitingGeoRunStartConfirmation) {
                currentLog(`Post ${POST_ID} initUI: Venter på startknapp-trykk.`, "debug");
                 if(initialInstructionsEl) {
                    initialInstructionsEl.textContent = this.instructionsInitial;
                    initialInstructionsEl.style.display = 'block';
                }
                if(beforeStartInstructionsEl) {
                    beforeStartInstructionsEl.textContent = this.instructionsBeforeStart;
                    beforeStartInstructionsEl.style.display = 'block';
                }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true;
            } else {
                currentLog(`Post ${POST_ID} initUI: Første ankomst / generelle instruksjoner.`, "debug");
                if(initialInstructionsEl) {
                    initialInstructionsEl.textContent = this.instructionsInitial;
                    initialInstructionsEl.style.display = 'block';
                }
                 if(beforeStartInstructionsEl) {
                    beforeStartInstructionsEl.textContent = this.instructionsBeforeStart;
                    beforeStartInstructionsEl.style.display = 'block';
                }
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
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: (DEV_MODE_NO_GEOFENCE && this.geoRunPoints[0] && userLatLng.lat() === this.geoRunPoints[0].lat && userLatLng.lng() === this.geoRunPoints[0].lng) ? "#FFA500" : "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                    });
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
                targetLabel = targetIndex === 0 ? 'M' : (targetIndex).toString(); // M for Mål (som er Startpunktet)
            } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) {
                nextTargetPointData = this.geoRunPoints[0];
                targetLabel = 'S'; // S for Start
            } else if (runState.finished) {
                nextTargetPointData = this.geoRunPoints[0]; // Vis Målpunktet
                targetLabel = 'M';
            }

            if (nextTargetPointData) {
                geoRunMiniMapActiveTargetMarker = new google.maps.Marker({
                    position: nextTargetPointData,
                    map: geoRunMiniMapInstance,
                    title: nextTargetPointData.name,
                    icon: 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png',
                    label: { text: targetLabel, color: "black", fontWeight: "bold" }
                });
            }

            // Ikke kall fitBounds her for å unngå konstant re-zooming under løpet.
            // Panorer heller for å holde bruker og mål synlig om nødvendig.
            if (geoRunMiniMapInstance && userLatLng && nextTargetPointData) {
                const tempBounds = new google.maps.LatLngBounds();
                tempBounds.extend(userLatLng);
                tempBounds.extend(nextTargetPointData);
                // Panorer slik at begge er synlige, men unngå å endre zoom for mye.
                // Dette kan være komplekst. Enklere: panTo(userLatLng) eller panTo(nextTargetPointData)
                // Eller la brukeren panorere selv. For nå, ingen automatisk panorering her.
            }
        },

        cleanupUI: function() {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                if (geoRunMiniMapActiveTargetMarker) geoRunMiniMapActiveTargetMarker.setMap(null);
                // geoRunAllPointMarkers er ikke lenger i bruk for å holde alle markører samtidig på kartet
                geoRunMiniMapUserMarker = null;
                geoRunMiniMapActiveTargetMarker = null;

                const mapDiv = document.getElementById(`georun-map-in-post${POST_ID}`);
                if (mapDiv) mapDiv.innerHTML = '';
                geoRunMiniMapInstance = null;
                currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: MiniMap ryddet.`, "debug");
            }
        }
    };
    return postData;
}
/* Version: #71 */
