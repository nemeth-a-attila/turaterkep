async function loadTrackStructure() {

    const response =
        await fetch("data/tracks.json");

    return await response.json();
}