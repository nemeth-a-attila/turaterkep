const numberFormatter = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 1 });
const integerFormatter = new Intl.NumberFormat("hu-HU", { maximumFractionDigits: 0 });
const formatKm = value => `${numberFormatter.format(value)} km`;
const formatMeters = value => `${integerFormatter.format(value)} m`;
const displayName = filename => filename.replace(/\.gpx$/i, "").replace(/^\d{4}\.\d{2}\.\d{2}\s*/, "");

function groupBy(items, key) {
    return items.reduce((groups, item) => {
        (groups[item[key]] ??= []).push(item);
        return groups;
    }, {});
}

function renderSummary(tracks) {
    const totalKm = tracks.reduce((sum, track) => sum + track.distanceKm, 0);
    const totalElevation = tracks.reduce((sum, track) => sum + track.elevationGainM, 0);
    const longest = [...tracks].sort((a, b) => b.distanceKm - a.distanceKm)[0];
    const shortest = [...tracks].sort((a, b) => a.distanceKm - b.distanceKm)[0];
    const cards = [["Összes távolság", formatKm(totalKm)], ["Teljesített túrák", `${tracks.length} db`], ["Átlagos táv", formatKm(totalKm / tracks.length)], ["Összes szintemelkedés", formatMeters(totalElevation)], ["Leghosszabb túra", formatKm(longest.distanceKm), displayName(longest.filename)], ["Legrövidebb túra", formatKm(shortest.distanceKm), displayName(shortest.filename)]];
    document.querySelector("#summary-cards").innerHTML = cards.map(([label, value, detail]) => `<article class="summary-card"><p>${label}</p><strong>${value}</strong>${detail ? `<span>${detail}</span>` : ""}</article>`).join("");
}

function renderYears(tracks) {
    const years = Object.entries(groupBy(tracks.filter(track => track.year), "year")).map(([year, entries]) => ({ year, distance: entries.reduce((sum, track) => sum + track.distanceKm, 0) })).sort((a, b) => a.year - b.year);
    const maximum = Math.max(...years.map(year => year.distance));
    document.querySelector("#year-chart").innerHTML = years.map(({ year, distance }) => `<div class="bar-row"><span>${year}</span><div class="bar-track"><div class="bar" style="width: ${(distance / maximum) * 100}%"></div></div><strong>${formatKm(distance)}</strong></div>`).join("");
}

function renderMovements(tracks) {
    const movements = Object.entries(groupBy(tracks, "movement")).map(([movement, entries]) => ({ movement, count: entries.length, distance: entries.reduce((sum, track) => sum + track.distanceKm, 0) })).sort((a, b) => b.distance - a.distance);
    document.querySelector("#movement-table").innerHTML = `<table><thead><tr><th>Mozgalom</th><th>Túrák</th><th>Távolság</th></tr></thead><tbody>${movements.map(item => `<tr><td>${item.movement}</td><td>${item.count} db</td><td>${formatKm(item.distance)}</td></tr>`).join("")}</tbody></table>`;
}

function renderLongestTracks(tracks) {
    document.querySelector("#longest-tracks").innerHTML = [...tracks].sort((a, b) => b.distanceKm - a.distanceKm).slice(0, 10).map(track => `<li><div><strong>${displayName(track.filename)}</strong><span>${track.movement} · ${track.date ?? "ismeretlen dátum"}</span></div><b>${formatKm(track.distanceKm)}</b></li>`).join("");
}

function renderTracks(tracks) {
    document.querySelector("#track-table-body").innerHTML = [...tracks].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "")).map(track => `<tr><td>${track.date ?? "—"}</td><td>${track.movement}</td><td>${displayName(track.filename)}</td><td>${formatKm(track.distanceKm)}</td><td>${formatMeters(track.elevationGainM)}</td></tr>`).join("");
}

fetch("data/statistics.json")
    .then(response => { if (!response.ok) throw new Error("A statisztikai adatfájl nem tölthető be."); return response.json(); })
    .then(data => { renderSummary(data.tracks); renderYears(data.tracks); renderMovements(data.tracks); renderLongestTracks(data.tracks); renderTracks(data.tracks); document.querySelector("#updated-at").textContent = `Az adatok a teljesített GPX-fájlokból készültek. Frissítve: ${new Date(data.generatedAt).toLocaleString("hu-HU")}.`; })
    .catch(error => { document.querySelector("main").innerHTML = `<p class="error">${error.message} Futtasd a generate-tracks.bat fájlt.</p>`; });
