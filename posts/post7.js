/* Version: #55 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapPoint1Marker = null;
let geoRunMiniMapPoint2Marker = null;
// let geoRunMiniMapNextTargetMarker = null; // Ikke i bruk, bruker ikonendring

function definePost7() {
    const POST_ID = 7;
    const postData = {
        id: POST_ID,
        name: "Geo-løp Kunstgresset",
        lat: 60.8006280021653,
        lng: 10.683461472668988,
        type: "georun",

        instructionsInitial: "Du har ankommet startområdet for Geo-løpet! Kartet nedenfor viser din posisjon og startpunktet for løpet (Punkt 1).",
        instructionsBeforeStart: "Når du er innenfor 5 meter av Punkt 1 (se kart), vil 'Start Geo-Løp'-knappen nedenfor bli aktiv. Trykk på den for å starte tidtakingen.",
        instructionsDuringRun: "Løp til det markerte vendepunktet på kartet (den gule prikken). Når du når det, vil neste vendepunkt vises. Du skal krysse banen totalt 5 ganger. Lykke til!",

        geoRunPoint1: { lat: 60.8006280021653, lng: 10.683461472668988, name: "Start/Mål (Punkt 1)" },
        geoRunPoint2: { lat: 60.79971947637134, lng: 10.683614899042398, name: "Vendepunkt (Punkt 2)" },
        lapsToComplete: 5,

        pointsScale: {
            60: 10, 75: 9, 90: 8, 105: 7, 120: 6, 150: 5, 180: 4, 210: 3, 240: 2, Infinity: 1
        },

        initUI: function(pageElement, teamData) {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun) initUI: Kjører.`, "debug");

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
                if (!geoRunMiniMapInstance || !geoRunMiniMapInstance.getDiv() || geoRunMiniMapInstance.getDiv().id !== miniMapDiv.id ) { // Sjekk om kartet må reinitialiseres
                    currentLog(`Post ${POST_ID} initUI: Initialiserer/Re-initialiserer GeoRun MiniMap.`, "debug");
                    if (geoRunMiniMapInstance) { // Rydd opp gammel instans hvis den finnes
                        this.cleanupUI(); // Kall cleanup for å fjerne gamle markører etc.
                    }
                    const centerLat = (this.geoRunPoint1.lat + this.geoRunPoint2.lat) / 2;
                    const centerLng = (this.geoRunPoint1.lng + this.geoRunPoint2.lng) / 2;
                    geoRunMiniMapInstance = new google.maps.Map(miniMapDiv, {
                        center: { lat: centerLat, lng: centerLng },
                        zoom: 17,
                        mapTypeId: google.maps.MapTypeId.HYBRID,
                        disableDefaultUI: true,
                        zoomControl: true,
                        draggable: true,
                        scrollwheel: true,
                        styles: window.MAP_STYLES_NO_LABELS || [] // Bruk global stil
                    });

                    geoRunMiniMapPoint1Marker = new google.maps.Marker({
                        position: this.geoRunPoint1, map: geoRunMiniMapInstance, title: this.geoRunPoint1.name,
                        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                    });
                    geoRunMiniMapPoint2Marker = new google.maps.Marker({
                        position: this.geoRunPoint2, map: geoRunMiniMapInstance, title: this.geoRunPoint2.name,
                        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                    });
                }

                // Kall updateMiniMap for å sette brukerposisjon og mål
                let currentUserPosForMiniMap = null;
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    currentUserPosForMiniMap = window.userPositionMarker.getPosition();
                } else if (DEV_MODE_NO_GEOFENCE) { // global DEV_MODE_NO_GEOFENCE
                    currentUserPosForMiniMap = new google.maps.LatLng(this.geoRunPoint1.lat, this.geoRunPoint1.lng);
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
                if(currentLapEl) currentLapEl.textContent = `${runState.lap}`;
                if(nextTargetEl) {
                    nextTargetEl.textContent = (runState.lap % 2 !== 0) ? this.geoRunPoint2.name : this.geoRunPoint1.name;
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
            currentLog(`Post ${POST_ID} (GeoRun) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                if (geoRunMiniMapPoint1Marker) geoRunMiniMapPoint1Marker.setMap(null);
                if (geoRunMiniMapPoint2Marker) geoRunMiniMapPoint2Marker.setMap(null);
                geoRunMiniMapUserMarker = null;
                geoRunMiniMapPoint1Marker = null;
                geoRunMiniMapPoint2Marker = null;

                const mapDiv = document.getElementById(`georun-map-in-post${POST_ID}`);
                if (mapDiv) mapDiv.innerHTML = '';
                geoRunMiniMapInstance = null; // Viktig å nullstille for re-initialisering
                currentLog(`Post ${POST_ID} (GeoRun) cleanupUI: MiniMap ryddet.`, "debug");
            }
        },
        updateMiniMap: function(userLatLng, teamData) {
            if (!geoRunMiniMapInstance || !teamData || !teamData.geoRunState) return;
            const runState = teamData.geoRunState[`post${POST_ID}`];
            if (!runState) return;

            if (userLatLng) { // Kun oppdater hvis vi har en gyldig userLatLng
                if (geoRunMiniMapUserMarker) {
                    geoRunMiniMapUserMarker.setPosition(userLatLng);
                } else if (geoRunMiniMapInstance) {
                     geoRunMiniMapUserMarker = new google.maps.Marker({
                        position: userLatLng, map: geoRunMiniMapInstance, title: "Din Posisjon",
                        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: (DEV_MODE_NO_GEOFENCE && userLatLng.lat() === this.geoRunPoint1.lat && userLatLng.lng() === this.geoRunPoint1.lng) ? "#FFA500" : "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                    });
                }
            }


            let nextTargetForMap = null;
            if (runState.active && !runState.finished) {
                nextTargetForMap = (runState.lap % 2 !== 0) ? this.geoRunPoint2 : this.geoRunPoint1;
            } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) {
                nextTargetForMap = this.geoRunPoint1;
            }

            [geoRunMiniMapPoint1Marker, geoRunMiniMapPoint2Marker].forEach(marker => {
                if (marker) {
                    const isActiveTarget = nextTargetForMap && marker.getPosition().lat().toFixed(6) === nextTargetForMap.lat.toFixed(6) && marker.getPosition().lng().toFixed(6) === nextTargetForMap.lng.toFixed(6);
                    const newIconUrl = isActiveTarget ? 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png';
                    if (marker.getIcon() !== newIconUrl) marker.setIcon(newIconUrl);
                }
            });
             if (geoRunMiniMapInstance && geoRunMiniMapUserMarker && geoRunMiniMapPoint1Marker && geoRunMiniMapPoint2Marker && geoRunMiniMapUserMarker.getPosition()) { // Sjekk at user marker har posisjon
                const bounds = new google.maps.LatLngBounds();
                bounds.extend(geoRunMiniMapUserMarker.getPosition());
                bounds.extend(geoRunMiniMapPoint1Marker.getPosition());
                bounds.extend(geoRunMiniMapPoint2Marker.getPosition());
                geoRunMiniMapInstance.fitBounds(bounds);
                if (geoRunMiniMapInstance.getZoom() > 18) geoRunMiniMapInstance.setZoom(18);
            }
        }
    };
    return postData;
}
/* Version: #55 */
