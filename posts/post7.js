/* Version: #69 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapActiveTargetMarker = null;
let geoRunAllPointMarkers = []; // For å holde alle faste punktmarkører (S, 1, 2, 3, 4)

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
                        // Senter og zoom settes av fitBounds nedenfor
                        mapTypeId: google.maps.MapTypeId.HYBRID,
                        disableDefaultUI: true,
                        zoomControl: true, draggable: true, scrollwheel: true,
                        styles: window.MAP_STYLES_NO_LABELS || []
                    });

                    geoRunAllPointMarkers.forEach(marker => marker.setMap(null)); // Rydd opp eventuelle gamle
                    geoRunAllPointMarkers = [];

                    // Opprett alle faste punktmarkører (S, 1, 2, 3, 4)
                    // Disse vil alltid være på kartet, men fargen endres for aktivt mål
                    this.geoRunPoints.forEach((point, index) => {
                        const marker = new google.maps.Marker({
                            position: point,
                            map: geoRunMiniMapInstance,
                            title: point.name,
                            label: `${index === 0 ? 'S' : (index).toString()}`,
                            icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' // Starter som rød
                        });
                        geoRunAllPointMarkers.push(marker);
                    });
                }

                let currentUserPosForMiniMap = null;
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                } else if (DEV_MODE_NO_GEOFENCE) {
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

            // Oppdater/opprett brukermarkør
            if (userLatLng) {
                if (geoRunMiniMapUserMarker) {
                    geoRunMiniMapUserMarker.setPosition(userLatLng);
                } else if (geoRunMiniMapInstance) {
                     geoRunMiniMapUserMarker = new google.maps.Marker({
                        position: userLatLng, map: geoRunMiniMapInstance, title: "Din Posisjon",
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: (DEV_MODE_NO_GEOFENCE && userLatLng.lat() === this.geoRunPoints[0].lat && userLatLng.lng() === this.geoRunPoints[0].lng) ? "#FFA500" : "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                    });
                }
            } else if (geoRunMiniMapUserMarker) {
                geoRunMiniMapUserMarker.setMap(null);
                geoRunMiniMapUserMarker = null;
            }

            // Bestem neste målpunkt
            let nextTargetPointData = null;
            if (runState.active && !runState.finished && runState.lap > 0 && runState.lap <= this.runTargetIndices.length) {
                const targetIndex = this.runTargetIndices[runState.lap - 1];
                nextTargetPointData = this.geoRunPoints[targetIndex];
            } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) {
                nextTargetPointData = this.geoRunPoints[0]; // Før start, eller hvis ikke aktiv, er målet Startpunktet
            } else if (runState.finished) {
                nextTargetPointData = this.geoRunPoints[0]; // Etter målgang, vis målpunktet (Start/Mål)
            }


            // Oppdater faste punktmarkører (S, 1, 2, 3, 4)
            geoRunAllPointMarkers.forEach((marker, index) => {
                if (marker) {
                    const isThisMarkerTheNextTarget = nextTargetPointData &&
                                                 marker.getPosition().lat().toFixed(6) === nextTargetPointData.lat.toFixed(6) &&
                                                 marker.getPosition().lng().toFixed(6) === nextTargetPointData.lng.toFixed(6);

                    // Hvis løpet ikke er startet eller venter på bekreftelse, vis kun startpunktet (S) tydelig.
                    // Andre ytre punkter (1-4) skal ikke vises før løpet er aktivt og de er neste mål.
                    let shouldBeVisible = false;
                    if (index === 0) { // Start/Mål-punktet (S)
                        shouldBeVisible = true; // Alltid synlig, farge endres
                    } else if (runState.active && !runState.finished && isThisMarkerTheNextTarget) {
                        shouldBeVisible = true; // Vis neste aktive mål
                    } else if (runState.finished && index === 0){ // Vis målpunktet når ferdig
                        shouldBeVisible = true;
                    }


                    if (shouldBeVisible) {
                        marker.setMap(geoRunMiniMapInstance); // Sørg for at den er på kartet
                        const newIconUrl = isThisMarkerTheNextTarget ? 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
                        if (marker.getIcon() !== newIconUrl) marker.setIcon(newIconUrl);
                    } else {
                        marker.setMap(null); // Skjul markøren hvis den ikke skal vises
                    }
                }
            });

            // Juster kartutsnitt
             if (geoRunMiniMapInstance) {
                const bounds = new google.maps.LatLngBounds();
                if (geoRunMiniMapUserMarker && geoRunMiniMapUserMarker.getPosition()) {
                    bounds.extend(geoRunMiniMapUserMarker.getPosition());
                }
                // Inkluder kun det aktive målet i bounds, eller startpunktet hvis før løp/etter mål
                if (nextTargetPointData) {
                    bounds.extend(nextTargetPointData);
                } else if (this.geoRunPoints[0]) { // Fallback til startpunktet hvis ingen aktivt mål
                     bounds.extend(this.geoRunPoints[0]);
                }


                if (!bounds.isEmpty()) {
                    geoRunMiniMapInstance.fitBounds(bounds);
                    if (geoRunMiniMapInstance.getZoom() > 18) geoRunMiniMapInstance.setZoom(18); // Begrens maks zoom
                } else if (this.geoRunPoints[0]) {
                    geoRunMiniMapInstance.setCenter(this.geoRunPoints[0]);
                    geoRunMiniMapInstance.setZoom(17);
                }
            }
        },

        cleanupUI: function() {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun Stjerne) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                geoRunAllPointMarkers.forEach(marker => marker.setMap(null)); // Fjern alle faste punktmarkører
                if (geoRunMiniMapActiveTargetMarker) geoRunMiniMapActiveTargetMarker.setMap(null); // Selv om dette er en av de i arrayen

                geoRunMiniMapUserMarker = null;
                geoRunAllPointMarkers = [];
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
/* Version: #69 */
