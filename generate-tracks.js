const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "gpx");

const result = {
    tervezett: [],
    teljesitett: {}
};

const stats = {
    generatedAt: new Date().toISOString(),
    tracks: []
};

function distanceInKm(a, b) {
    const earthRadiusKm = 6371;
    const toRadians = value => value * Math.PI / 180;
    const deltaLat = toRadians(b.lat - a.lat);
    const deltaLon = toRadians(b.lon - a.lon);
    const lat1 = toRadians(a.lat);
    const lat2 = toRadians(b.lat);
    const haversine = Math.sin(deltaLat / 2) ** 2
        + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    return 2 * earthRadiusKm * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function readGpxStats(filePath) {
    const content = fs.readFileSync(filePath, "utf8");
    const points = [];
    const pointPattern = /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
    let match;

    while ((match = pointPattern.exec(content)) !== null) {
        const elevationMatch = match[3].match(/<ele>([^<]+)<\/ele>/);
        points.push({
            lat: Number.parseFloat(match[1]),
            lon: Number.parseFloat(match[2]),
            elevation: elevationMatch ? Number.parseFloat(elevationMatch[1]) : null
        });
    }

    let distanceKm = 0;
    let elevationGainM = 0;

    for (let index = 1; index < points.length; index++) {
        distanceKm += distanceInKm(points[index - 1], points[index]);

        const previousElevation = points[index - 1].elevation;
        const currentElevation = points[index].elevation;
        if (Number.isFinite(previousElevation) && Number.isFinite(currentElevation)) {
            elevationGainM += Math.max(0, currentElevation - previousElevation);
        }
    }

    return { distanceKm, elevationGainM };
}

//
// tervezett
//

const plannedDir = path.join(ROOT, "tervezett");

if (fs.existsSync(plannedDir)) {

    const files = fs.readdirSync(plannedDir);

    result.tervezett = files
        .filter(f => f.toLowerCase().endsWith(".gpx"))
        .sort();
}

//
// teljesitett
//

const completedDir = path.join(ROOT, "teljesitett");

if (fs.existsSync(completedDir)) {

    const movements = fs.readdirSync(
        completedDir,
        { withFileTypes: true }
    );

    for (const movement of movements) {

        if (!movement.isDirectory()) {
            continue;
        }

        const movementPath = path.join(
            completedDir,
            movement.name
        );

        const tracks = fs.readdirSync(movementPath)
            .filter(f => f.toLowerCase().endsWith(".gpx"))
            .sort();

        result.teljesitett[movement.name] = tracks;

        for (const filename of tracks) {
            const dateMatch = filename.match(/^(\d{4})\.(\d{2})\.(\d{2})\s/);
            const trackStats = readGpxStats(path.join(movementPath, filename));

            stats.tracks.push({
                movement: movement.name,
                filename,
                date: dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : null,
                year: dateMatch ? Number.parseInt(dateMatch[1], 10) : null,
                month: dateMatch ? Number.parseInt(dateMatch[2], 10) : null,
                distanceKm: trackStats.distanceKm,
                elevationGainM: trackStats.elevationGainM
            });
        }
    }
}

fs.writeFileSync(
    path.join(__dirname, "data", "tracks.json"),
    JSON.stringify(result, null, 2),
    "utf8"
);

fs.writeFileSync(
    path.join(__dirname, "data", "statistics.json"),
    JSON.stringify(stats, null, 2),
    "utf8"
);

console.log("tracks.json generálva");
