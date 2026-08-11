async function loadMapTracks() {
    const response = await fetch("data/map-tracks.json");

    if (!response.ok) {
        throw new Error("Az útvonal-adatfájl nem tölthető be.");
    }

    return response.json();
}
