/* Version: #54 */
// Filnavn: posts/post7.js

// Globale variabler spesifikke for Post 7 sitt minimap
let geoRunMiniMapInstance = null;
let geoRunMiniMapUserMarker = null;
let geoRunMiniMapPoint1Marker = null;
let geoRunMiniMapPoint2Marker = null;
let geoRunMiniMapNextTargetMarker = null; // For å fremheve neste mål

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

            // === Hent UI Elementer ===
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

            // === Skjul alle seksjoner som standard ===
            if(initialInstructionsEl) initialInstructionsEl.style.display = 'none';
            if(beforeStartInstructionsEl) beforeStartInstructionsEl.style.display = 'none';
            if(startButtonSectionEl) startButtonSectionEl.style.display = 'none';
            if(activeSectionEl) activeSectionEl.style.display = 'none';
            if(resultsSectionEl) resultsSectionEl.style.display = 'none';
            if(duringRunInstructionsEl) duringRunInstructionsEl.style.display = 'none';
            if(miniMapDiv) miniMapDiv.style.display = 'block'; // Kartet skal vises

            if(totalLapsDisplayEl) totalLapsDisplayEl.textContent = this.lapsToComplete;

            // === Initialiser/Oppdater MiniMap ===
            if (miniMapDiv && typeof google !== 'undefined' && google.maps) {
                if (!geoRunMiniMapInstance) { // Opprett kun hvis det ikke finnes
                    currentLog(`Post ${POST_ID} initUI: Initialiserer GeoRun MiniMap.`, "debug");
                    const centerLat = (this.geoRunPoint1.lat + this.geoRunPoint2.lat) / 2;
                    const centerLng = (this.geoRunPoint1.lng + this.geoRunPoint2.lng) / 2;
                    geoRunMiniMapInstance = new google.maps.Map(miniMapDiv, {
                        center: { lat: centerLat, lng: centerLng },
                        zoom: 17, // Juster zoom etter behov
                        mapTypeId: google.maps.MapTypeId.HYBRID,
                        disableDefaultUI: true,
                        zoomControl: true,
                        draggable: true,
                        scrollwheel: true,
                    });

                    // Legg til markører for Point1 og Point2
                    geoRunMiniMapPoint1Marker = new google.maps.Marker({
                        position: this.geoRunPoint1,
                        map: geoRunMiniMapInstance,
                        title: this.geoRunPoint1.name,
                        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' // Standard rød
                    });
                    geoRunMiniMapPoint2Marker = new google.maps.Marker({
                        position: this.geoRunPoint2,
                        map: geoRunMiniMapInstance,
                        title: this.geoRunPoint2.name,
                        icon: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' // Standard rød
                    });
                }

                // Oppdater brukermarkør (hvis den finnes i hovedkartet)
                if (window.userPositionMarker && window.userPositionMarker.getPosition()) {
                    const userPos = window.userPositionMarker.getPosition();
                    if (geoRunMiniMapUserMarker) {
                        geoRunMiniMapUserMarker.setPosition(userPos);
                    } else {
                        geoRunMiniMapUserMarker = new google.maps.Marker({
                            position: userPos,
                            map: geoRunMiniMapInstance,
                            title: "Din Posisjon",
                            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                        });
                    }
                } else if (DEV_MODE_NO_GEOFENCE && geoRunMiniMapInstance) { // Vis dummy i dev mode hvis ingen ekte posisjon
                     const dummyUserPos = this.geoRunPoint1; // Start på punkt 1 i dev mode
                     if (geoRunMiniMapUserMarker) {
                        geoRunMiniMapUserMarker.setPosition(dummyUserPos);
                    } else {
                        geoRunMiniMapUserMarker = new google.maps.Marker({
                            position: dummyUserPos,
                            map: geoRunMiniMapInstance,
                            title: "Din Posisjon (DEV)",
                            icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#FFA500", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" } // Oransje for dev
                        });
                    }
                }


                // Fremhev neste mål
                let nextTargetForMap = null;
                if (runState.active && !runState.finished) {
                    nextTargetForMap = (runState.lap % 2 !== 0) ? this.geoRunPoint2 : this.geoRunPoint1;
                } else if (runState.awaitingGeoRunStartConfirmation || (!runState.active && !runState.finished)) {
                    nextTargetForMap = this.geoRunPoint1; // Før start, mål er Point1
                }

                [geoRunMiniMapPoint1Marker, geoRunMiniMapPoint2Marker].forEach(marker => {
                    if (marker) {
                        const isActiveTarget = nextTargetForMap && marker.getPosition().lat() === nextTargetForMap.lat && marker.getPosition().lng() === nextTargetForMap.lng;
                        marker.setIcon(isActiveTarget ? 'https://maps.google.com/mapfiles/ms/icons/yellow-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/red-dot.png');
                        marker.setAnimation(isActiveTarget ? google.maps.Animation.BOUNCE : null);
                        if (isActiveTarget && geoRunMiniMapInstance) {
                           // Forsikre at kartet er panorert slik at aktivt mål er synlig, spesielt i dev mode
                           // geoRunMiniMapInstance.panTo(marker.getPosition());
                        }
                    }
                });
                 if (geoRunMiniMapInstance && geoRunMiniMapUserMarker && geoRunMiniMapPoint1Marker && geoRunMiniMapPoint2Marker) {
                    const bounds = new google.maps.LatLngBounds();
                    bounds.extend(geoRunMiniMapUserMarker.getPosition());
                    bounds.extend(geoRunMiniMapPoint1Marker.getPosition());
                    bounds.extend(geoRunMiniMapPoint2Marker.getPosition());
                    geoRunMiniMapInstance.fitBounds(bounds);
                    if (geoRunMiniMapInstance.getZoom() > 18) geoRunMiniMapInstance.setZoom(18); // Ikke zoom for mye inn
                }


            } else if (miniMapDiv) {
                miniMapDiv.innerHTML = "<p style='text-align:center; color:red;'>Google Maps API ikke lastet ennå.</p>";
            }


            // === Vis/skjul seksjoner basert på runState ===
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
                 if(initialInstructionsEl) { // Vis også initielle instruksjoner
                    initialInstructionsEl.textContent = this.instructionsInitial;
                    initialInstructionsEl.style.display = 'block';
                }
                if(beforeStartInstructionsEl) {
                    beforeStartInstructionsEl.textContent = this.instructionsBeforeStart;
                    beforeStartInstructionsEl.style.display = 'block';
                }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true;
            } else { // Første ankomst, ikke ulåst for start ennå (dvs. unlockedPosts er true, men awaitingGeoRunStartConfirmation er ikke satt ennå)
                currentLog(`Post ${POST_ID} initUI: Første ankomst / generelle instruksjoner (venter på geofence for startområdet).`, "debug");
                if(initialInstructionsEl) {
                    initialInstructionsEl.textContent = this.instructionsInitial;
                    initialInstructionsEl.style.display = 'block';
                }
                 if(beforeStartInstructionsEl) { // Vis også disse for å lede brukeren
                    beforeStartInstructionsEl.textContent = this.instructionsBeforeStart;
                    beforeStartInstructionsEl.style.display = 'block';
                }
                if(startButtonSectionEl) startButtonSectionEl.style.display = 'block';
                if(startButtonEl) startButtonEl.disabled = true;
            }
        },
        // Funksjon for å rydde opp minimap når man forlater post 7
        cleanupUI: function() {
            const currentLog = window.logToMobile || console.debug;
            currentLog(`Post ${POST_ID} (GeoRun) cleanupUI: Kjører.`, "debug");
            if (geoRunMiniMapInstance) {
                // Fjern markører
                if (geoRunMiniMapUserMarker) geoRunMiniMapUserMarker.setMap(null);
                if (geoRunMiniMapPoint1Marker) geoRunMiniMapPoint1Marker.setMap(null);
                if (geoRunMiniMapPoint2Marker) geoRunMiniMapPoint2Marker.setMap(null);
                if (geoRunMiniMapNextTargetMarker) geoRunMiniMapNextTargetMarker.setMap(null); // Hvis vi hadde en egen
                geoRunMiniMapUserMarker = null;
                geoRunMiniMapPoint1Marker = null;
                geoRunMiniMapPoint2Marker = null;
                geoRunMiniMapNextTargetMarker = null;

                // Nullstill kartinstansen
                const mapDiv = document.getElementById(`georun-map-in-post${POST_ID}`);
                if (mapDiv) mapDiv.innerHTML = ''; // Tøm div-en
                geoRunMiniMapInstance = null;
                currentLog(`Post ${POST_ID} (GeoRun) cleanupUI: MiniMap ryddet.`, "debug");
            }
        },
        // Funksjon for å oppdatere minimap (kalles fra core.js)
        updateMiniMap: function(userLatLng, teamData) {
            if (!geoRunMiniMapInstance || !teamData || !teamData.geoRunState) return;
            const runState = teamData.geoRunState[`post${POST_ID}`];
            if (!runState) return;

            if (geoRunMiniMapUserMarker) {
                geoRunMiniMapUserMarker.setPosition(userLatLng);
            } else if (geoRunMiniMapInstance) { // Lag hvis ikke finnes
                 geoRunMiniMapUserMarker = new google.maps.Marker({
                    position: userLatLng, map: geoRunMiniMapInstance, title: "Din Posisjon",
                    icon: { path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: "#4285F4", fillOpacity: 1, strokeWeight: 1.5, strokeColor: "white" }
                });
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
                    
                    const currentAnimation = marker.getAnimation();
                    if (isActiveTarget && !currentAnimation) {
                        // marker.setAnimation(google.maps.Animation.BOUNCE); // Bounce kan være irriterende
                    } else if (!isActiveTarget && currentAnimation) {
                        // marker.setAnimation(null);
                    }
                }
            });
             if (geoRunMiniMapInstance && geoRunMiniMapUserMarker && geoRunMiniMapPoint1Marker && geoRunMiniMapPoint2Marker) {
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
/* Version: #54 */
