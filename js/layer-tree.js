async function buildLayerTree(map) {

    const trackStructure = await loadTrackStructure();

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
    // TERVEZETT TÚRAMOZGALMAK
    //

    const plannedChildren = [];

    for (const filename of trackStructure.tervezett) {

        const gpxLayer = new L.GPX(
            `gpx/tervezett/${filename}`,
            {
                async: true,
                markers: {
                    startIcon: null,
                    endIcon: null,
                    wptIcons: {}
                }
            }
        );

        plannedChildren.push({
            label: filename.replace(".gpx", ""),
            layer: gpxLayer
        });
    }

    //
    // TELJESÍTETT TÚRÁK
    //

    const completedChildren = [];

    for (const movementName in trackStructure.teljesitett) {

        const trackNodes = [];

        for (const filename of trackStructure.teljesitett[movementName]) {

            const gpxLayer = new L.GPX(
                `gpx/teljesitett/${movementName}/${filename}`,
                {
                    async: true,
                    markers: {
                        startIcon: null,
                        endIcon: null,
                        wptIcons: {}
                    }
                }
            );

            trackNodes.push({
                label: filename.replace(".gpx", ""),
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
            }
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
                selectAllCheckbox: true,
                children: plannedChildren
            },

            {
                label: 'Teljesített túrák',
                selectAllCheckbox: true,
                children: completedChildren
            }
        ]
    };

    L.control.layers.tree(
        baseTree,
        overlayTree,
        {
            collapsed: false
        }
    ).addTo(map);
}