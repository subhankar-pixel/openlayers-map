let map = L.map('map').setView([20.59, 78.96], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;
let drawnLine;

// Load GeoJSON
fetch('Data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    loadParcels();
  });

function loadParcels() {
  if (parcelLayer) {
    parcelLayer.remove();
  }

  parcelLayer = L.geoJSON(geojsonData, {
    onEachFeature: (feature, layer) => {
      layer.on('click', () => {
        selectedFeature = feature;
        selectedLayer = layer;

        highlightSelected(layer);

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
}

function highlightSelected(layer) {
  parcelLayer.eachLayer(l => {
    parcelLayer.resetStyle(l);
  });
  layer.setStyle({
    color: 'red',
    weight: 3
  });
}

function saveAttribute() {
  if (!selectedFeature) return;

  const newOwner = document.getElementById("ownerInput").value;
  selectedFeature.properties.owner = newOwner;

  loadParcels();
  alert("Attribute updated (not saved to file)");
}

function activateSplitMode() {
  if (!selectedFeature || !selectedFeature.geometry) {
    alert("Please select a parcel first.");
    return;
  }

  alert("Draw a line to split the selected parcel. Double-click to finish.");

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
  const splitLine = drawnLine;
  const polygon = selectedFeature.geometry;

  if (!polygon || polygon.type !== "Polygon") {
    alert("Selected feature is not a valid Polygon.");
    return;
  }

  // Turf splitting logic
  try {
    const polyFeature = turf.feature(polygon, selectedFeature.properties);
    const result = turf.lineSplit(polyFeature, splitLine);

    if (!result.features.length) {
      alert("Split failed: Line may not intersect the parcel.");
      return;
    }

    const index = geojsonData.features.indexOf(selectedFeature);
    if (index !== -1) {
      geojsonData.features.splice(index, 1);
      result.features.forEach(f => {
        f.properties = { ...selectedFeature.properties }; // retain original attributes
        geojsonData.features.push(f);
      });

      selectedFeature = null;
      selectedLayer = null;
      document.getElementById("attributePanel").style.display = "none";

      loadParcels();
      alert("Parcel split successfully.");
    }
  } catch (err) {
    console.error("Split error:", err);
    alert("An error occurred during the split.");
  }
}

function exportGeoJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "edited_parcels.geojson");
  dlAnchor.click();
}
