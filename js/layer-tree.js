async function buildLayerTree(map) {

const mapTracks = await loadMapTracks();
    const defaultLineStyles = {
        planned: { color: '#0200b8', weight: 3, opacity: 0.8 },
        completed: { color: '#ff0000', weight: 3, opacity: 0.9 }
    };
    const storedLineStyles = JSON.parse(localStorage.getItem('turaterkep-line-styles') || '{}');
    const lineStyles = {
        planned: { ...defaultLineStyles.planned, ...storedLineStyles.planned },
        completed: { ...defaultLineStyles.completed, ...storedLineStyles.completed }
    };
    const routeLayers = { planned: [], completed: [] };

    //
    // ALAPTÃ‰RKÃ‰PEK
    //

    const freemap = L.tileLayer(
        'https://outdoor.tiles.freemap.sk/{z}/{x}/{y}',
        {
            attribution: 'Â© Freemap Slovakia'
        }
    );

    const mapy = L.tileLayer(
        'https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=eA-cMTDwX8Ik74btJNe-zHrkSIeOsOG5pkOel-VgHZA',
        {
            attribution: 'Â© Mapy.com'
        }
    );

    const mapnik = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: 'Â© OpenStreetMap contributors' }
    );

    const openTopoMap = L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        { maxZoom: 17, attribution: 'Map data: Â© OpenStreetMap contributors, SRTM | Map style: Â© OpenTopoMap (CC-BY-SA)' }
    );

    const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles Â© Esri' }
    );

    const thunderforestApiKey = window.mapConfig?.thunderforestApiKey;
    const thunderforest = thunderforestApiKey
        ? L.tileLayer(
            `https://api.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${thunderforestApiKey}`,
            { maxZoom: 22, attribution: 'Maps Â© Thunderforest, Data Â© OpenStreetMap contributors' }
        )
        : null;

    freemap.addTo(map);

    //
    // TÃšRAJELZÃ‰SEK
    //

    const turistautak = L.tileLayer(
        'https://a.tile.openstreetmap.hu/tt/{z}/{x}/{y}.png',
        {
            opacity: 0.8
        }
    );

    const waymarked = L.tileLayer(
        'https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',
        {
            opacity: 0.8
        }
    );

    //
    // EBBE GYÅ°JTJÃœK AZ INDULÃSKOR LÃTSZÃ“ RÃ‰TEGEKET
    //

    const defaultLayers = [];

    //
    // TERVEZETT TÃšRAMOZGALMAK
    //

    const plannedChildren = [];

    const plannedTracks = mapTracks.features.filter(track => track.properties.category === "planned");
    const completedTracks = mapTracks.features.filter(track => track.properties.category === "completed");

    for (const track of plannedTracks) {

        const gpxLayer = L.geoJSON(
            track,
            { style: lineStyles.planned }
        );

        routeLayers.planned.push(gpxLayer);

        plannedChildren.push({
            label: track.properties.filename.replace(".gpx", ""),
            layer: gpxLayer
        });
    }

    //
    // TELJESÃTETT TÃšRÃK
    //

    const completedChildren = [];

    const completedByMovement = completedTracks.reduce(
        (groups, track) => {
            (groups[track.properties.movement] ??= []).push(track);
            return groups;
        },
        {}
    );

    for (const movementName in completedByMovement) {

        const trackNodes = [];

        for (const track of completedByMovement[movementName]) {

            const gpxLayer = L.geoJSON(
                track,
                { style: lineStyles.completed }
            );

            routeLayers.completed.push(gpxLayer);

            // indulÃ¡skor lÃ¡tszÃ³djon
            defaultLayers.push(gpxLayer);

            trackNodes.push({
                label: track.properties.filename.replace(".gpx", ""),
                layer: gpxLayer
            });
        }

        completedChildren.push({
            label: movementName,
            selectAllCheckbox: true,
            children: trackNodes
        });
    }

    //
    // TREE CONTROL
    //

    const baseTree = {
        label: 'AlaptÃ©rkÃ©p',
        children: [
            {
                label: 'Freemap Slovakia',
                layer: freemap
            },
            {
                label: 'Mapy.com Outdoor',
                layer: mapy
            },
            {
                label: 'OpenStreetMap Mapnik',
                layer: mapnik
            },
            {
                label: 'OpenTopoMap',
                layer: openTopoMap
            },
            {
                label: 'MÅ±holdkÃ©p (Esri)',
                layer: satellite
            },
            ...(thunderforest ? [{
                label: 'Thunderforest Outdoors',
                layer: thunderforest
            }] : [])
        ]
    };

    const overlayTree = {
        label: 'RÃ©tegek',
        children: [

            {
                label: 'TÃºrajelzÃ©sek',
                selectAllCheckbox: true,
                children: [
                    {
                        label: 'Turistautak',
                        layer: turistautak
                    },
                    {
                        label: 'WayMarkedTrails',
                        layer: waymarked
                    }
                ]
            },

            {
                label: 'Tervezett tÃºramozgalmak',
                collapsed: true,
                selectAllCheckbox: true,
                children: plannedChildren
            },

            {
                label: 'TeljesÃ­tett tÃºrÃ¡k',
                collapsed: true,
                selectAllCheckbox: true,
                children: completedChildren
            }
        ]
    };

    const treeControl = L.control.layers.tree(
        baseTree,
        overlayTree,
        {
            collapsed: false
        }
    );

treeControl.addTo(map);

    const lineStyleControl = L.control({ position: 'topright' });
    lineStyleControl.onAdd = () => {
        const container = L.DomUtil.create('div', 'leaflet-bar line-style-control');
        container.innerHTML = `
            <details>
                <summary>Vonalstílusok</summary>
                <div class="line-style-panel">
                    <fieldset data-category="planned">
                        <legend>Tervezett túrák</legend>
                        <label>Szín <input type="color" value="${lineStyles.planned.color}" data-property="color"></label>
                        <label>Vastagság <span><input type="range" min="1" max="10" step="1" value="${lineStyles.planned.weight}" data-property="weight"><output>${lineStyles.planned.weight} px</output></span></label>
                        <button type="button">Alaphelyzet</button>
                    </fieldset>
                    <fieldset data-category="completed">
                        <legend>Teljesített túrák</legend>
                        <label>Szín <input type="color" value="${lineStyles.completed.color}" data-property="color"></label>
                        <label>Vastagság <span><input type="range" min="1" max="10" step="1" value="${lineStyles.completed.weight}" data-property="weight"><output>${lineStyles.completed.weight} px</output></span></label>
                        <button type="button">Alaphelyzet</button>
                    </fieldset>
                </div>
            </details>`;
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        const saveAndApply = category => {
            routeLayers[category].forEach(layer => layer.setStyle(lineStyles[category]));
            localStorage.setItem('turaterkep-line-styles', JSON.stringify(lineStyles));
        };
        container.querySelectorAll('fieldset').forEach(fieldset => {
            const category = fieldset.dataset.category;
            const colorInput = fieldset.querySelector('[data-property="color"]');
            const weightInput = fieldset.querySelector('[data-property="weight"]');
            const output = fieldset.querySelector('output');
            colorInput.addEventListener('input', () => { lineStyles[category].color = colorInput.value; saveAndApply(category); });
            weightInput.addEventListener('input', () => {
                lineStyles[category].weight = Number(weightInput.value);
                output.textContent = `${weightInput.value} px`;
                saveAndApply(category);
            });
            fieldset.querySelector('button').addEventListener('click', () => {
                lineStyles[category] = { ...defaultLineStyles[category] };
                colorInput.value = lineStyles[category].color;
                weightInput.value = lineStyles[category].weight;
                output.textContent = `${lineStyles[category].weight} px`;
                saveAndApply(category);
            });
        });
        return container;
    };
    lineStyleControl.addTo(map);

    //
    // TELJESÃTETT TÃšRÃK AUTOMATIKUS BEKAPCSOLÃSA
    //

    for (const layer of defaultLayers) {
        map.addLayer(layer);
    }
}
