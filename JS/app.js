let map; // declare map globally
let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;

// Load GeoJSON parcels first, then initialize map
fetch('Data/parcels.geojson')
  .then(res => res.json())
  .then(data => {
    geojsonData = data;
    initMap();        // ✅ Initialize map only after data is loaded
    loadParcels();    // ✅ Load parcel layer
  })
  .catch(err => {
    alert("Could not load parcel data. Check console for error.");
    console.error("Parcel Load Error:", err);
  });

function initMap() {
  map = L.map('map');

  // Add base layer
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  // Add Geoman controls (but no draw tools initially)
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

  // ✅ Zoom to parcel extent
  if (parcelLayer.getBounds().isValid()) {
    map.fitBounds(parcelLayer.getBounds());
  } else {
    map.setView([20, 80], 5); // fallback if no valid geometry
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

  const newOwner = document.getElementById("ownerInput").value;
  selectedFeature.properties.owner = newOwner;

  loadParcels(); // reload to reflect updated label
  alert("Attribute updated (not saved to file)");
}

// ✅ Working Geoman Split Mode
function enableGeomanSplit() {
  if (!selectedLayer || !selectedFeature) {
    alert("Please select a parcel first.");
    return;
  }

  alert("Draw a line to split the selected parcel. Double-click to finish.");

  // Add selected feature to map as editable temp layer
  const tempLayer = L.geoJSON(selectedFeature, {
    pmIgnore: false
  }).addTo(map);

  // Enable Geoman cut mode on that layer
  tempLayer.pm.enable({ allowSelfIntersection: false });
  map.pm.setGlobalOptions({ snappable: true, snapDistance: 15 });

  tempLayer.on('pm:cut', e => {
    const cutLayers = e.layer.getLayers();

    if (!cutLayers || cutLayers.length < 2) {
      alert("Split failed. Ensure the line fully crosses the parcel.");
      return;
    }

    // Remove original feature
    const index = geojsonData.features.indexOf(selectedFeature);
    if (index !== -1) geojsonData.features.splice(index, 1);

    // Add split parts
    cutLayers.forEach(layer => {
      const newFeat = layer.toGeoJSON();
      newFeat.properties = { ...selectedFeature.properties }; // retain attributes
      geojsonData.features.push(newFeat);
    });

    // Clean up
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
