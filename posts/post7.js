/* Version: #67 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapMarkers = []; // Array for å holde alle punktmarkører

function definePost7() {
    const POST_ID = 7;
    // Definerer punktene i den rekkefølgen de skal besøkes.
    // Punkt 0 er start, Punkt 1 er første mål, osv. Siste punkt i arrayen er siste mål før retur til start (Punkt 0).
    // Med den nye sekvensen: Start(P1) -> P2 -> P3 -> P4 -> P5 -> Mål(P1)
    const geoRunPointsData = [
        { lat: 60.80063153980609, lng: 10.68346857893824, name: "Start / Mål" },   // Indeks 0
        { lat: 60.80016284763752, lng: 10.683027279834748, name: "Vendepunkt 1" },  // Indeks 1 (Første mål etter start)
        { lat: 60.80044715403525, lng: 10.68399856015822, name: "Vendepunkt 2" },  // Indeks 2
        { lat: 60.800418311472285, lng: 10.682976604339615, name: "Vendepunkt 3" },  // Indeks 3
        { lat: 60.800194780728354, lng: 10.684047124174391, name: "Vendepunkt 4" }   // Indeks 4 (Siste ytre punkt)
    ];

    // Løpssekvensen er nå enklere: indekser av punktene som skal besøkes i rekkefølge.
    // Start ved geoRunPointsData[0]. Første etappe er TIL geoRunPointsData[1].
    // Siste etappe er FRA geoRunPointsData[4] TIL geoRunPointsData[0].
    const runTargetIndices = [1, 2, 3, 4, 0]; // Indekser for målene for hver etappe.
                                              // Etappe 1: mål er index 1 (P2)
                                              // Etappe 2: mål er index 2 (P3)
                                              // ...
                                              // Etappe 5: mål er index 0 (P1 - Mål)
    const totalLegsToComplete = runTargetIndices.length; // 5 etapper

    return {
        id: POST_ID,
        name: "Geo-løp Stjerne (Kunstgresset)",
        lat: geoRunPointsData[0].lat, // Hovedpostens koordinat er startpunktet
        lng: geoRunPointsData[0].lng,
        type: "georun",

        instructionsInitial: "Du har ankommet startområdet for Geo-løpet! Kartet nedenfor viser din posisjon og Startpunktet.",
        instructionsBeforeStart: `Når du er innenfor ${GEO_RUN_START_RADIUS} meter av Startpunktet (se kart), vil 'Start Geo-Løp'-knappen nedenfor bli aktiv. Trykk på den for å starte tidtakingen.`,
        instructionsDuringRun: `Løp til det GULE markerte vendepunktet på kartet. Du skal løpe fra punkt til punkt i en stjerneform, og avslutte tilbake ved startpunktet. Totalt ${totalLegsToComplete} etapper. Følg kartet!`,

        geoRunPoints: geoRunPointsData,
        runTargetIndices: runTargetIndices, // Hvilket punkt som er målet for hver etappe
        lapsToComplete: totalLegsToComplete, // Antall etapper å fullføre

        pointsScale: { // Juster tidene for 5 etapper
            120: 10, // 2 min
            150: 9,  // 2.5 min
            180: 8,  // 3 min
            210: 7,  // 3.5 min
            240: 6,  // 4 min
            270: 5,  // 4.5 min
            300: 4,  // 5 min
            360: 3,  // 6 min
            420: 2,  // 7 min
            Infinity: 1
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

            if(totalLapsDisplayEl) totalLapsDisplayEl.textContent = this.lapsToComplete; // Viser "av X etapper"

            if (miniMapDiv && typeof google !== 'undefined' && google.maps) {
                if (!geoRunMiniMapInstance || !geoRunMiniMapInstance.getDiv() || geoRunMiniMapInstance.getDiv().id !== miniMapDiv.id ) {
                    currentLog(`Post ${POST_ID} initUI: Initialiserer/Re-initialiserer GeoRun MiniMap.`, "debug");
                    if (geoRunMiniMapInstance) { this.cleanupUI(); }

                    geoRunMiniMapInstance = new google.maps.Map(miniMapDiv, {
                        center: this.geoRunPoints[0],
                        zoom: 17,
                        mapTypeId: google.maps.MapTypeId.HYBRID,
                        disableDefaultUI: true,
                        zoomControl: true, draggable: true, scrollwheel: true,
                        styles: window.MAP_STYLES_NO_LABELS || []
                    });

                    geoRunMiniMapMarkers.forEach(marker => marker.setMap(null));
                    geoRunMiniMapMarkers = [];

                    this.geoRunPoints.forEach((point, index) => {
                        const marker = new google.maps.Marker({
                            position: point,
                            map: geoRunMiniMapInstance,
                            title: point.name,
                            label: `${index === 0 ? 'S' : (index).toString()}`, // S for start/mål, 1-4 for vendepunkter
                            icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                        });
                        geoRunMiniMapMarkers.push(marker);
                    });
                }

                let currentUserPosForMiniMap = null;
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                } else if (DEV_MODE_NO_GEOFENCE) {
                    currentUserPosForMiniMap = new google.maps.LatLng(this.geoRunPoints[0].lat, this.geoRunPoints[0].lng);
                }
                if(currentUserPosForMiniMap) this.updateMiniMap(currentUserPosForMiniMap, teamData);

            } else if (miniMapDiv) {
                miniMapDiv.innerHTML = "<p style='text-align:center; color:red;'>Google Maps API ikke lastet ennå, eller kart-div feil.</p>";
            }

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
                if(currentLapEl) currentLapEl.textContent = `${runState.lap}`; // Viser nåværende etappe
                if(nextTargetEl) {
                    // runState.lap er 1-basert for etapper. runTargetIndices er 0-basert.
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
                currentLog(`Post ${POST_ID} initUI: Første ankomst / generelle instruksjoner (venter på geofence for startområdet).`, "debug");
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
        cleanupUI: function() {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                geoRunMiniMapMarkers.forEach(marker => marker.setMap(null));
                geoRunMiniMapUserMarker = null;
                geoRunMiniMapMarkers = [];

                const mapDiv = document.getElementById(`georun-map-in-post${POST_ID}`);
                if (mapDiv) mapDiv.innerHTML = '';
                geoRunMiniMapInstance = null;
                currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: MiniMap ryddet.`, "debug");
            }
        },
        updateMiniMap: function(userLatLng, teamData) {
            if (!geoRunMiniMapInstance || !teamData || !teamData.geoRunState) return;
            const runState = teamData.geoRunState[`post${POST_ID}`];
            if (!runState || !this.geoRunPoints || !this.runTargetIndices) return;

            if (userLatLng) {
                if (geoRunMiniMapUserMarker) {
                    geoRunMiniMapUserMarker.setPosition(userLatLng);
                } else if (geoRunMiniMapInstance) {
                     geoRunMiniMapUserMarker = new google.maps.Marker({
                        position: userLatLng, map: geoRunMiniMapInstance, title: "Din Posisjon",
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: (DEV_MODE_NO_GEOFENCE && userLatLng.lat() === this.geoRunPoints[0].lat && userLatLng.lng() === this.geoRunPoints[0].lng) ? "#FFA500" : "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                    });
                }
            }

            let nextTargetPointData = null;
            if (runState.active && !runState.finished && runState.lap > 0 && runState.lap <= this.runTargetIndices.length) {
                const targetIndex = this.runTargetIndices[runState.lap - 1]; // lap er 1-basert
                nextTargetPointData = this.geoRunPoints[targetIndex];
            } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) {
                nextTargetPointData = this.geoRunPoints[0]; // Før start, mål er Startpunktet
            }

            geoRunMiniMapMarkers.forEach((marker, index) => {
                if (marker) {
                    const isThisMarkerTheNextTarget = nextTargetPointData &&
                                                 marker.getPosition().lat().toFixed(6) === nextTargetPointData.lat.toFixed(6) &&
                                                 marker.getPosition().lng().toFixed(6) === nextTargetPointData.lng.toFixed(6);

                    const newIconUrl = isThisMarkerTheNextTarget ? 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
                    if (marker.getIcon() !== newIconUrl) marker.setIcon(newIconUrl);
                }
            });

             if (geoRunMiniMapInstance && geoRunMiniMapMarkers.length > 0) {
                const bounds = new google.maps.LatLngBounds();
                if (geoRunMiniMapUserMarker && geoRunMiniMapUserMarker.getPosition()) {
                    bounds.extend(geoRunMiniMapUserMarker.getPosition());
                }
                this.geoRunPoints.forEach(point => bounds.extend(point)); // Inkluder alle definerte punkter
                geoRunMiniMapInstance.fitBounds(bounds);
                if (geoRunMiniMapInstance.getZoom() > 18) geoRunMiniMapInstance.setZoom(18);
            }
        }
    };
    return postData;
}
/* Version: #67 */
