const map = L.map("map").setView(
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

        mapScreenshoter.takeScreen('blob')
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