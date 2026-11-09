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
    const movementCodes = {
        'Balaton-felvidéki Kéktúra': 'BFK', 'Budai Zöld': 'BZ', 'Dornyai Béla Emlékút': 'DBE',
        'Dél-Dunántúli Piros': 'DDP', 'Gödöllői Kéktúra': 'GK', 'Három forrás útja a Pilisben': '3F',
        'Kerüld a Pilist': 'KaP', 'Közép-Dunántúli Piros': 'KDP', 'Országos Kéktúra': 'OKT',
        'Pest megyei Piros': 'PMP', 'Pilis CsipaPiros': 'PCsP', 'Pilisi vándorlás': 'PV',
        'Rockenbauer Pál Dél-Dunántúli Kéktúra': 'RPDDK', 'Rómer Flóris Emlékút': 'RFE', 'Visegrádi Pirosút': 'VP'
    };
    const movementCodeFor = movement => {
        const normalized = movement.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu-HU');
        return Object.entries(movementCodes).find(([name]) => {
            const candidate = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('hu-HU');
            return normalized.startsWith(candidate);
        })?.[1];
    };
    const initialUrl = new URLSearchParams(location.search);
    const urlStatePresent = ['base', 'signs', 'planned', 'completed'].some(key => initialUrl.has(key));
    const baseLayers = {};

    //
    // ALAPTÉRKÉPEK
    //

    const freemap = L.tileLayer(
        'https://outdoor.tiles.freemap.sk/{z}/{x}/{y}',
        {
            attribution: '© Freemap Slovakia'
        }
    );

    const mapy = L.tileLayer(
        'https://api.mapy.com/v1/maptiles/outdoor/256/{z}/{x}/{y}?apikey=eA-cMTDwX8Ik74btJNe-zHrkSIeOsOG5pkOel-VgHZA',
        {
            attribution: '© Mapy.com'
        }
    );

    const mapnik = L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '© OpenStreetMap contributors' }
    );

    const openTopoMap = L.tileLayer(
        'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        { maxZoom: 17, attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)' }
    );

    const satellite = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        { maxZoom: 19, attribution: 'Tiles © Esri' }
    );

    const thunderforestApiKey = window.mapConfig?.thunderforestApiKey;
    const thunderforest = thunderforestApiKey
        ? L.tileLayer(
            `https://api.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${thunderforestApiKey}`,
            { maxZoom: 22, attribution: 'Maps © Thunderforest, Data © OpenStreetMap contributors' }
        )
        : null;

    Object.assign(baseLayers, { freemap, mapy, mapnik, openTopoMap, satellite });
    if (thunderforest) baseLayers.thunderforest = thunderforest;
    freemap.addTo(map);
    map.freemapLayer = freemap;

    //
    // TÚRAJELZÉSEK
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
    // EBBE GYŰJTJÜK AZ INDULÁSKOR LÁTSZÓ RÉTEGEKET
    //

    const defaultLayers = [];

    //
    // TERVEZETT TÚRAMOZGALMAK
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
            shareCode: Object.entries(movementCodes).find(([name]) => track.properties.filename.startsWith(name))?.[1],
            layer: gpxLayer
        });
    }

    //
    // TELJESÍTETT TÚRÁK
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

            // induláskor látszódjon
            defaultLayers.push(gpxLayer);

            trackNodes.push({
                label: track.properties.filename.replace(".gpx", ""),
                layer: gpxLayer
            });
        }

        completedChildren.push({
            label: movementName,
            shareCode: movementCodeFor(movementName),
            shareKey: movementCodeFor(movementName) || movementName,
            selectAllCheckbox: true,
            children: trackNodes
        });
    }

    //
    // TREE CONTROL
    //

    const baseTree = {
        label: 'Alaptérkép',
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
                label: 'Műholdkép (Esri)',
                layer: satellite
            },
            ...(thunderforest ? [{
                label: 'Thunderforest Outdoors',
                layer: thunderforest
            }] : [])
        ]
    };

    const overlayTree = {
        label: 'Rétegek',
        children: [

            {
                label: 'Túrajelzések',
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
                label: 'Tervezett túramozgalmak',
                collapsed: true,
                selectAllCheckbox: true,
                children: plannedChildren
            },

            {
                label: 'Teljesített túrák',
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

    const plannedEntries = plannedChildren.filter(node => node.shareCode);
    const completedEntries = completedChildren;
    const allCompletedLayers = completedChildren.flatMap(node => node.children.map(child => child.layer));
    const allPlannedLayers = plannedChildren.map(node => node.layer);
    const signLayers = { turistautak, waymarked };
    const applyUrlState = () => {
        if (initialUrl.has('base')) {
            Object.values(baseLayers).forEach(layer => map.removeLayer(layer));
            const selected = baseLayers[initialUrl.get('base')];
            if (selected) map.addLayer(selected);
        }
        if (initialUrl.has('signs')) {
            Object.values(signLayers).forEach(layer => map.removeLayer(layer));
            const value = initialUrl.get('signs');
            if (value === 'b' || value === 't') map.addLayer(turistautak);
            if (value === 'b' || value === 'w') map.addLayer(waymarked);
        }
        if (initialUrl.has('planned')) {
            allPlannedLayers.forEach(layer => map.removeLayer(layer));
            const codes = new Set(initialUrl.get('planned').split(',').filter(Boolean));
            plannedEntries.filter(node => codes.has(node.shareCode)).forEach(node => map.addLayer(node.layer));
        }
        if (urlStatePresent) {
            allCompletedLayers.forEach(layer => map.removeLayer(layer));
            const codes = new Set((initialUrl.get('completed') || '').split(',').filter(Boolean));
            completedEntries.filter(node => codes.has(node.shareKey)).forEach(node => node.children.forEach(child => map.addLayer(child.layer)));
        }
    };
    if (urlStatePresent) applyUrlState();

    const currentShareUrl = () => {
        const params = new URLSearchParams();
        const activeBase = Object.entries(baseLayers).find(([, layer]) => map.hasLayer(layer))?.[0] || 'freemap';
        params.set('base', activeBase);
        const activeSigns = Object.entries(signLayers).filter(([, layer]) => map.hasLayer(layer)).map(([key]) => key === 'turistautak' ? 't' : 'w');
        params.set('signs', activeSigns.length === 2 ? 'b' : activeSigns[0] || 'none');
        params.set('planned', plannedEntries.filter(node => map.hasLayer(node.layer)).map(node => node.shareCode).join(','));
        params.set('completed', completedEntries.filter(node => node.children.some(child => map.hasLayer(child.layer))).map(node => node.shareKey).join(','));
        return `${location.origin}${location.pathname}?${params}`;
    };
    const syncUrl = () => history.replaceState(null, '', currentShareUrl());
    map.on('baselayerchange overlayadd overlayremove', syncUrl);
    const shareControl = L.control({ position: 'topright' });
    shareControl.onAdd = () => {
        const container = L.DomUtil.create('div', 'leaflet-bar');
        const button = L.DomUtil.create('button', '', container);
        button.type = 'button'; button.textContent = 'URL megosztása';
        button.title = 'A jelenlegi térképállapotot tartalmazó URL másolása';
        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.on(button, 'click', async () => {
            try { await navigator.clipboard.writeText(currentShareUrl()); button.textContent = 'URL másolva'; }
            catch { prompt('Másold ki a megosztható URL-t:', currentShareUrl()); }
            setTimeout(() => { button.textContent = 'URL megosztása'; }, 1800);
        });
        return container;
    };
    shareControl.addTo(map);

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
    // TELJESÍTETT TÚRÁK AUTOMATIKUS BEKAPCSOLÁSA
    //

    if (!urlStatePresent) {
        for (const layer of defaultLayers) {
            map.addLayer(layer);
        }
    }
}
