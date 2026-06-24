const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "gpx");

const result = {
    tervezett: [],
    teljesitett: {}
};

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
    }
}

fs.writeFileSync(
    path.join(__dirname, "data", "tracks.json"),
    JSON.stringify(result, null, 2),
    "utf8"
);

console.log("tracks.json generálva");