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

const mapTracks = {
    type: "FeatureCollection",
    features: []
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
    const segments = [];
    const pointPattern = /<trkpt\b([^>]*)>([\s\S]*?)<\/trkpt>|<trkpt\b([^>]*)\/>/g;
    let match;

    for (const segment of content.matchAll(/<trkseg>([\s\S]*?)<\/trkseg>/g)) {
        const points = [];
        pointPattern.lastIndex = 0;

        while ((match = pointPattern.exec(segment[1])) !== null) {
            const attributes = match[1] ?? match[3];
            const latitudeMatch = attributes.match(/\blat="([^"]+)"/);
            const longitudeMatch = attributes.match(/\blon="([^"]+)"/);
            const elevationMatch = match[2]?.match(/<ele>([^<]+)<\/ele>/);

            if (!latitudeMatch || !longitudeMatch) continue;

            points.push({
                lat: Number.parseFloat(latitudeMatch[1]),
                lon: Number.parseFloat(longitudeMatch[1]),
                elevation: elevationMatch ? Number.parseFloat(elevationMatch[1]) : null
            });
        }

        if (points.length > 0) segments.push(points);
    }

    let distanceKm = 0;
    let elevationGainM = 0;

    for (const points of segments) {
        for (let index = 1; index < points.length; index++) {
            distanceKm += distanceInKm(points[index - 1], points[index]);

            const previousElevation = points[index - 1].elevation;
            const currentElevation = points[index].elevation;
            if (Number.isFinite(previousElevation) && Number.isFinite(currentElevation)) {
                elevationGainM += Math.max(0, currentElevation - previousElevation);
            }
        }
    }

    return { distanceKm, elevationGainM, segments };
}

function pointToSegmentDistanceSquared(point, start, end) {
    const deltaLat = end.lat - start.lat;
    const deltaLon = end.lon - start.lon;
    const lengthSquared = deltaLat ** 2 + deltaLon ** 2;
    if (lengthSquared === 0) return (point.lat - start.lat) ** 2 + (point.lon - start.lon) ** 2;

    const position = Math.max(0, Math.min(1, ((point.lat - start.lat) * deltaLat + (point.lon - start.lon) * deltaLon) / lengthSquared));
    return (point.lat - (start.lat + position * deltaLat)) ** 2 + (point.lon - (start.lon + position * deltaLon)) ** 2;
}

function simplify(points, tolerance = 0.00003) {
    if (points.length < 3) return points;

    const first = points[0];
    const last = points[points.length - 1];
    let furthestIndex = 0;
    let furthestDistance = 0;

    for (let index = 1; index < points.length - 1; index++) {
        const distance = pointToSegmentDistanceSquared(points[index], first, last);
        if (distance > furthestDistance) {
            furthestDistance = distance;
            furthestIndex = index;
        }
    }

    if (furthestDistance <= tolerance ** 2) return [first, last];
    return [...simplify(points.slice(0, furthestIndex + 1), tolerance).slice(0, -1), ...simplify(points.slice(furthestIndex), tolerance)];
}

function mapCoordinates(segments) {
    return segments.map(segment => simplify(segment).map(point => [Number(point.lon.toFixed(6)), Number(point.lat.toFixed(6))]));
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

    for (const filename of result.tervezett) {
        const trackStats = readGpxStats(path.join(plannedDir, filename));
        const coordinates = mapCoordinates(trackStats.segments);
        mapTracks.features.push({
            type: "Feature",
            properties: { category: "planned", filename },
            geometry: {
                type: coordinates.length === 1 ? "LineString" : "MultiLineString",
                coordinates: coordinates.length === 1 ? coordinates[0] : coordinates
            }
        });
    }
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

            const coordinates = mapCoordinates(trackStats.segments);
            mapTracks.features.push({
                type: "Feature",
                properties: { category: "completed", movement: movement.name, filename },
                geometry: {
                    type: coordinates.length === 1 ? "LineString" : "MultiLineString",
                    coordinates: coordinates.length === 1 ? coordinates[0] : coordinates
                }
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

fs.writeFileSync(
    path.join(__dirname, "data", "map-tracks.json"),
    JSON.stringify(mapTracks),
    "utf8"
);

console.log("tracks.json generálva");
