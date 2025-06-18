const map = L.map('map').setView([22.572, 88.365], 17);

// 1. Basemap
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

// 2. Load GeoJSON Parcels
let parcelLayer;

fetch('data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    parcelLayer = L.geoJSON(data, {
      style: {
        color: "#ff7800",
        weight: 2
      },
      onEachFeature: function (feature, layer) {
        layer.bindPopup("Owner: " + feature.properties.owner);
      }
    }).addTo(map);
  });

// 3. Initialize Draw Control
const drawnItems = new L.FeatureGroup();
map.addLayer(drawnItems);

const drawControl = new L.Control.Draw({
  draw: {
    polygon: false,
    rectangle: false,
    circle: false,
    marker: false,
    circlemarker: false,
    polyline: {
      shapeOptions: {
        color: 'blue',
        weight: 3
      }
    }
  },
  edit: {
    featureGroup: drawnItems,
    remove: true
  }
});
map.addControl(drawControl);

// 4. Handle Drawing Events
map.on(L.Draw.Event.CREATED, function (event) {
  const layer = event.layer;
  if (event.layerType === 'polyline') {
    // Perform split logic here using Turf.js
    if (parcelLayer) {
      const polyline = layer.toGeoJSON();
      const newFeatures = [];

      parcelLayer.eachLayer(function (pLayer) {
        const parcel = pLayer.toGeoJSON();
        try {
          const splitResult = turf.lineSplit(parcel, polyline);
          if (splitResult.features.length > 1) {
            splitResult.features.forEach(f => {
              f.properties = { ...parcel.properties };
              newFeatures.push(f);
            });
          } else {
            newFeatures.push(parcel);
          }
        } catch (e) {
          console.error("Split failed: ", e);
        }
      });

      map.removeLayer(parcelLayer);
      parcelLayer = L.geoJSON(newFeatures, {
        style: { color: '#00cc88', weight: 2 },
        onEachFeature: function (feature, layer) {
          layer.bindPopup("Owner: " + feature.properties.owner);
        }
      }).addTo(map);
    }
  }

  drawnItems.addLayer(layer);
});
