const GITHUB_OWNER = "nemeth-a-attila";
const GITHUB_REPO = "turaterkep";

//async function getFolderContents(path) {
//
//    const response = await fetch(
//        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`
//    );
//
//    return await response.json();
//}

async function getFolderContents(path) {

    const url =
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${path}`;

    console.log("Lekérés:", url);

    const response = await fetch(url);

    console.log("Status:", response.status);

    const data = await response.json();

    console.log("Válasz:", data);

    return data;
}

async function getPlannedTracks() {

    return await getFolderContents("gpx/tervezett");
}

async function getCompletedMovements() {

    return await getFolderContents("gpx/teljesitett");
}

async function getMovementTracks(folderName) {

    return await getFolderContents(
        `gpx/teljesitett/${folderName}`
    );
}