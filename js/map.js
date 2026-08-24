const map = L.map("map", {
    zoomSnap: 0.01,
    zoomDelta: 0.25,
    wheelPxPerZoomLevel: 120
}).setView(
    [47.2, 19.5],
    8
);

buildLayerTree(map);
const mapScreenshoter = L.simpleMapScreenshoter({
    hidden: true,
    hideElementsWithSelectors: ['.leaflet-control-container']
}).addTo(map);

const screenshotControl = L.control({ position: 'topleft' });
screenshotControl.onAdd = () => {
    const container = L.DomUtil.create('div', 'leaflet-bar screenshot-control');
    const button = L.DomUtil.create('button', '', container);
    button.type = 'button';
    button.title = 'Aktuális térkép mentése PNG-ként';
    button.setAttribute('aria-label', button.title);
    button.textContent = '\u{1F4F7} PNG';

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.on(button, 'click', () => {
        button.disabled = true;
        button.textContent = 'Készül…';

        const takeScreenshot = map.freemapLayer && map.hasLayer(map.freemapLayer)
            ? takeBrowserCapturedScreenshot
            : () => mapScreenshoter.takeScreen('blob');

        takeScreenshot()
            .then(blob => {
                const link = document.createElement('a');
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                link.href = URL.createObjectURL(blob);
                link.download = `turaterkep-${timestamp}.png`;
                link.click();
                URL.revokeObjectURL(link.href);
            })
            .catch(error => {
                console.error('A térképkép mentése nem sikerült.', error);
                alert('A térképkép mentése nem sikerült. Próbáld újra néhány másodperc múlva.');
            })
            .finally(() => {
                button.disabled = false;
                button.textContent = '\u{1F4F7} PNG';
            });
    });

    return container;
};
screenshotControl.addTo(map);

const preciseZoomControl = L.control({ position: 'bottomleft' });
preciseZoomControl.onAdd = () => {
    const container = L.DomUtil.create('div', 'leaflet-bar precise-zoom-control');
    container.innerHTML = `
        <label for="precise-zoom">Pontos zoom <output></output></label>
        <input id="precise-zoom" type="range" min="1" max="19" step="0.01" aria-label="Térkép nagyítása">
    `;

    const slider = container.querySelector('input');
    const output = container.querySelector('output');
    const updateValue = () => {
        slider.value = map.getZoom();
        output.textContent = map.getZoom().toFixed(2);
    };

    slider.addEventListener('input', () => map.setZoom(Number(slider.value), { animate: false }));
    map.on('zoomend', updateValue);
    updateValue();
    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    return container;
};
preciseZoomControl.addTo(map);
async function takeBrowserCapturedScreenshot() {
    document.body.classList.add('taking-map-screenshot');

    try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
            video: { displaySurface: 'browser' },
            audio: false,
            preferCurrentTab: true
        });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        await new Promise(resolve => setTimeout(resolve, 250));

        const mapElement = document.querySelector('#map');
        const bounds = mapElement.getBoundingClientRect();
        const scale = video.videoWidth / window.innerWidth;
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(bounds.width * scale);
        canvas.height = Math.round(bounds.height * scale);
        canvas.getContext('2d').drawImage(
            video,
            Math.round(bounds.left * scale),
            Math.round(bounds.top * scale),
            canvas.width,
            canvas.height,
            0,
            0,
            canvas.width,
            canvas.height
        );

        stream.getTracks().forEach(track => track.stop());
        return await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    } finally {
        document.body.classList.remove('taking-map-screenshot');
    }
}