let map = L.map('map');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19
}).addTo(map);

let parcelLayer;
let selectedFeature = null;
let selectedLayer = null;
let geojsonData;
let drawLayer;
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

  // Automatically zoom to parcel extent
  map.fitBounds(parcelLayer.getBounds());
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

  if (drawLayer) {
    map.removeLayer(drawLayer);
  }
  drawLayer = L.featureGroup().addTo(map);

  const drawControl = new L.Draw.Polyline(map, {
    shapeOptions: {
      color: 'red',
      weight: 3
    }
  });

  drawControl.enable();

  map.once(L.Draw.Event.CREATED, (e) => {
    const originalLine = e.layer;
    const snappedLine = snapLineToParcelEdges(originalLine);

    drawnLine = snappedLine.toGeoJSON();

    drawLayer.addLayer(snappedLine);
    performSplit();

    drawControl.disable();
  });
}

function snapLineToParcelEdges(lineLayer) {
  const latlngs = lineLayer.getLatLngs();
  const snappedLatLngs = latlngs.map(pt => {
    let closest = pt;
    let minDist = Infinity;

    parcelLayer.eachLayer(layer => {
      const latlngs = layer.getLatLngs().flat(Infinity);
      latlngs.forEach(vertex => {
        const dist = pt.distanceTo(vertex);
        if (dist < minDist && dist < 20) { // Snap only if within 20 meters
          minDist = dist;
          closest = vertex;
        }
      });
    });

    return closest;
  });

  return L.polyline(snappedLatLngs, {
    color: 'red',
    weight: 3
  });
}

function performSplit() {
  if (!selectedFeature || !drawnLine) {
    alert("Missing selected parcel or drawn line.");
    return;
  }

  const polygonFeature = turf.cleanCoords(turf.feature(selectedFeature.geometry, selectedFeature.properties));
  const lineFeature = turf.cleanCoords(turf.feature(drawnLine.geometry));

  try {
    const splitResult = turf.lineSplit(polygonFeature, lineFeature);

    if (splitResult.features.length < 2) {
      alert("Split failed: Make sure the line intersects the polygon fully.");
      return;
    }

    // Replace original with split parts
    const index = geojsonData.features.indexOf(selectedFeature);
    if (index !== -1) {
      geojsonData.features.splice(index, 1); // remove original

      splitResult.features.forEach(f => {
        f.properties = { ...selectedFeature.properties }; // copy attributes
        geojsonData.features.push(f);
      });

      selectedFeature = null;
      selectedLayer = null;
      document.getElementById("attributePanel").style.display = "none";

      loadParcels();
      alert("Parcel split successfully.");
    }

  } catch (err) {
    console.error("Error during split:", err);
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
