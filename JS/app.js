let map = L.map('map').setView([20.59, 78.96], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let parcelLayer;
let selectedFeature = null;
let geojsonData;
let drawnLine;

fetch('Data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    parcelLayer = L.geoJSON(data, {
      onEachFeature: (feature, layer) => {
        layer.on('click', () => {
          selectedFeature = feature;
          document.getElementById("attributePanel").style.display = "block";
          document.getElementById("ownerInput").value = feature.properties.owner || "";
        });
      },
      style: {
        color: 'blue',
        weight: 2,
        fillOpacity: 0.4
      }
    }).addTo(map);
    map.fitBounds(parcelLayer.getBounds());
  });

function saveAttribute() {
  if (!selectedFeature) return;

  const newOwner = document.getElementById("ownerInput").value;
  selectedFeature.properties.owner = newOwner;

  parcelLayer.clearLayers();
  parcelLayer.addData(geojsonData);
  alert("Attribute updated (not saved to file)");
}

function activateSplitMode() {
  alert("Draw a line to split a parcel. Double-click to finish.");

  const drawLayer = L.featureGroup().addTo(map);

  const drawControl = new L.Draw.Polyline(map, {
    shapeOptions: {
      color: 'red',
      weight: 3
    }
  });

  drawControl.enable();

  map.once(L.Draw.Event.CREATED, (e) => {
    drawnLine = e.layer.toGeoJSON();
    drawLayer.addLayer(e.layer);

    performSplit();
    drawControl.disable();
  });
}

function performSplit() {
  if (!selectedFeature || !drawnLine) {
    alert("No parcel selected or no line drawn.");
    return;
  }

  const parcel = selectedFeature;
  const splitResult = turf.lineSplit(parcel, drawnLine);

  if (!splitResult.features.length) {
    alert("Split failed. Line may not intersect the parcel.");
    return;
  }

  const index = geojsonData.features.indexOf(parcel);
  geojsonData.features.splice(index, 1);

  splitResult.features.forEach(f => {
    f.properties = { ...parcel.properties };
    geojsonData.features.push(f);
  });

  parcelLayer.clearLayers();
  parcelLayer.addData(geojsonData);
  selectedFeature = null;
  document.getElementById("attributePanel").style.display = "none";

  alert("Parcel split successfully.");
}

function exportGeoJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "edited_parcels.geojson");
  dlAnchor.click();
}
