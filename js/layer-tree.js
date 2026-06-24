async function buildLayerTree(map) {

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
    // TERVEZETT
    //

    const plannedChildren = [];

    const plannedFiles = await getPlannedTracks();

    for (const file of plannedFiles) {

        if (!file.name.endsWith(".gpx")) {
            continue;
        }

        const gpxLayer = new L.GPX(
            file.download_url,
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
            label: file.name.replace(".gpx", ""),
            layer: gpxLayer
        });
    }

    //
    // TELJESÍTETT
    //

    const completedChildren = [];

    const movements = await getCompletedMovements();

    for (const movement of movements) {

        if (movement.type !== "dir") {
            continue;
        }

        const tracks = await getMovementTracks(
            movement.name
        );

        const trackNodes = [];

        for (const track of tracks) {

            if (!track.name.endsWith(".gpx")) {
                continue;
            }

            const gpxLayer = new L.GPX(
                track.download_url,
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
                label: track.name.replace(".gpx", ""),
                layer: gpxLayer
            });
        }

        completedChildren.push({
            label: movement.name,
            children: trackNodes
        });
    }

    //
    // TREE
    //

    const baseTree = {
        label: 'Alaptérkép',
        noShow: true,
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
        selectAllCheckbox: true,
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