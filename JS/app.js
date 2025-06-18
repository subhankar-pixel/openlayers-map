let map;
let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;
let drawLineLayer = null; // line drawn for split

// Load parcels
fetch('Data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    initMap();
    loadParcels();
  });

function initMap() {
  map = L.map('map');
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  map.pm.addControls({
    position: 'topleft',
    drawCircle: false,
    drawMarker: false,
    drawCircleMarker: false,
    drawText: false,
    drawPolygon: false,
    drawRectangle: false,
    drawPolyline: false,
    editMode: false,
    dragMode: false,
    cutPolygon: false,
    removalMode: false
  });
}

function loadParcels() {
  if (parcelLayer) parcelLayer.remove();

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

  if (parcelLayer.getBounds().isValid()) {
    map.fitBounds(parcelLayer.getBounds());
  } else {
    map.setView([20, 80], 5);
  }
}

function highlightSelected(layer) {
  parcelLayer.eachLayer(l => parcelLayer.resetStyle(l));
  layer.setStyle({
    color: 'red',
    weight: 3
  });
}

function saveAttribute() {
  if (!selectedFeature) return;
  selectedFeature.properties.owner = document.getElementById("ownerInput").value;
  loadParcels();
  alert("Attribute updated");
}

// ✅ NEW: Enable drawing a line and split selected parcel
function enableGeomanSplit() {
  if (!selectedFeature) {
    alert("Please select a parcel first.");
    return;
  }

  alert("Draw a line across the parcel to split. Double-click to finish.");

  // Enable polyline drawing mode
  map.pm.enableDraw('Line', {
    snappable: true,
    snapDistance: 15,
    templineStyle: { color: 'red' },
    hintlineStyle: { color: 'red' }
  });

  // Handle line draw
  map.once('pm:create', e => {
    drawLineLayer = e.layer;
    map.removeLayer(drawLineLayer); // We’ll just use geometry

    const drawnLine = drawLineLayer.toGeoJSON();
    const selectedPoly = turf.feature(selectedFeature.geometry);

    try {
      const result = turf.lineSplit(selectedPoly, drawnLine);

      if (!result.features || result.features.length < 2) {
        alert("Split failed. Make sure line cuts through the polygon.");
        return;
      }

      const index = geojsonData.features.indexOf(selectedFeature);
      if (index !== -1) geojsonData.features.splice(index, 1);

      result.features.forEach(f => {
        f.properties = { ...selectedFeature.properties };
        geojsonData.features.push(f);
      });

      selectedFeature = null;
      selectedLayer = null;
      document.getElementById("attributePanel").style.display = "none";

      loadParcels();
      alert("Parcel split successfully.");
    } catch (err) {
      console.error("Split error:", err);
      alert("An error occurred during the split.");
    }

    // Disable draw mode after use
    map.pm.disableDraw('Line');
  });
}

function exportGeoJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "edited_parcels.geojson");
  dlAnchor.click();
}
