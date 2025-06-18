let map;
let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;

// Load GeoJSON parcels then initialize map
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
  map = L.map('map');

  console.log('Map object:', map);
  console.log('Geoman plugin:', map.pm); // <--- this should not be undefined

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  map.pm.addControls({
    position: 'topleft',
    drawCircle: false,
    drawMarker: false,
    drawPolyline: false,
    drawRectangle: false,
    drawPolygon: false,
    editMode: false,
    dragMode: false,
    cutPolygon: true,
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

  const bounds = parcelLayer.getBounds();
  if (bounds.isValid()) {
    map.fitBounds(bounds);
  } else {
    map.setView([20, 80], 5); // fallback
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
  loadParcels();
  alert("Attribute updated (not saved to file)");
}

function enableGeomanSplit() {
  if (!selectedLayer) {
    alert("Please select a parcel first.");
    return;
  }

  alert("Draw a line across the parcel to split. Double-click to finish.");

  // Enable line draw
  map.pm.enableDraw('Line', {
    snappable: true,
    snapDistance: 15
  });

  // Handle the completed line drawing
  map.once('pm:drawend', e => {
    const lineLayer = e.layer;
    performSplit(lineLayer);
  });
}

function performSplit(lineLayer) {
  // Convert selected parcel to temporary editable layer
  const tempLayer = L.geoJSON(selectedFeature).addTo(map);

  // Enable cut mode
  tempLayer.pm.enable({ allowSelfIntersection: false });
  map.pm.setGlobalOptions({ snappable: true, snapDistance: 15 });

  // Manually fire cut (simulate cut using drawn line)
  const cutEvent = {
    layer: {
      getLayers: () => {
        try {
          return turf.difference(tempLayer.toGeoJSON().features[0], lineLayer.toGeoJSON())?.features || [];
        } catch (err) {
          alert("Error splitting parcel. Try a different line.");
          return [];
        }
      }
    }
  };

  const cutLayers = cutEvent.layer.getLayers();
  if (cutLayers.length < 2) {
    alert("Split failed. Make sure the line cuts across the entire parcel.");
    return;
  }

  // Remove original feature
  const index = geojsonData.features.indexOf(selectedFeature);
  if (index !== -1) geojsonData.features.splice(index, 1);

  // Add split features
  cutLayers.forEach(l => {
    const newFeat = l; // already a GeoJSON feature
    newFeat.properties = { ...selectedFeature.properties };
    geojsonData.features.push(newFeat);
  });

  selectedFeature = null;
  selectedLayer = null;
  document.getElementById("attributePanel").style.display = "none";

  map.removeLayer(tempLayer);
  map.removeLayer(lineLayer);
  loadParcels();
  alert("Parcel split successfully.");
}

function exportGeoJSON() {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(geojsonData));
  const dlAnchor = document.createElement('a');
  dlAnchor.setAttribute("href", dataStr);
  dlAnchor.setAttribute("download", "edited_parcels.geojson");
  dlAnchor.click();
}
