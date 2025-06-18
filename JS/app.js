let map;
let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;

// Load GeoJSON then initialize
fetch('Data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    initMap();
    loadParcels();
  })
  .catch(err => {
    alert("Could not load parcel data. Check console for error.");
    console.error(err);
  });

function initMap() {
  map = L.map('map').setView([20, 80], 5);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  map.pm.addControls({
    position: 'topleft',
    drawCircle: false,
    drawMarker: false,
    drawCircleMarker: false,
    drawText: false,
    drawPolyline: false,
    drawRectangle: false,
    drawPolygon: false,
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
  }
}

function highlightSelected(layer) {
  parcelLayer.eachLayer(l => parcelLayer.resetStyle(l));
  layer.setStyle({ color: 'red', weight: 3 });
}

function saveAttribute() {
  if (!selectedFeature) return;
  const newOwner = document.getElementById("ownerInput").value;
  selectedFeature.properties.owner = newOwner;
  loadParcels();
  alert("Attribute updated (not saved to file)");
}

// ✅ SPLIT using Leaflet-Geoman only
function enableGeomanSplit() {
  if (!selectedLayer) {
    alert("Please select a parcel first.");
    return;
  }

  alert("Draw a line across the parcel to split. Double-click to finish.");

  const tempLayer = L.geoJSON(selectedFeature).addTo(map);

  // Enable cut mode on the temp layer
  tempLayer.pm.enableCut();

  tempLayer.on('pm:cut', e => {
    const cutLayers = e.layer.getLayers();

    if (cutLayers.length < 2) {
      alert("Split failed. Make sure the line cuts across the parcel completely.");
      map.removeLayer(tempLayer);
      return;
    }

    // Replace original with split parts
    const index = geojsonData.features.indexOf(selectedFeature);
    if (index !== -1) geojsonData.features.splice(index, 1);

    cutLayers.forEach(l => {
      const newFeature = l.toGeoJSON();
      newFeature.properties = { ...selectedFeature.properties };
      geojsonData.features.push(newFeature);
    });

    selectedFeature = null;
    selectedLayer = null;
    document.getElementById("attributePanel").style.display = "none";

    map.removeLayer(tempLayer);
    loadParcels();
    alert("Parcel split successfully.");
  });
}

function exportGeoJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "edited_parcels.geojson");
  dlAnchor.click();
}
