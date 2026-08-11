async function buildLayerTree(map) {

    const mapTracks = await loadMapTracks();

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

    freemap.addTo(map);

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
            { style: { color: '#0200b8', weight: 4, opacity: 0.8 } }
        );

        plannedChildren.push({
            label: track.properties.filename.replace(".gpx", ""),
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
                { style: { color: '#ff0000', weight: 3, opacity: 0.9 } }
            );

            // induláskor látszódjon
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

    //
    // TELJESÍTETT TÚRÁK AUTOMATIKUS BEKAPCSOLÁSA
    //

    for (const layer of defaultLayers) {
        map.addLayer(layer);
    }
}
