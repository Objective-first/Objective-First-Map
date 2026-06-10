const LIVE_MAP_SIZE = 1000;

let liveLayer = null;
let mapGeometryCache = null;
let lastLiveFingerprint = "";

function initLiveLayer(leafletMap) {
  if (!liveLayer) {
    if (!leafletMap.getPane("livePane")) {
      leafletMap.createPane("livePane");
      leafletMap.getPane("livePane").style.zIndex = 350;
    }
    liveLayer = L.layerGroup([], { pane: "livePane" }).addTo(leafletMap);
  }
  return liveLayer;
}

async function loadMapGeometry() {
  if (mapGeometryCache) return mapGeometryCache;
  const res = await fetch("/map-geometry.json");
  if (!res.ok) return null;
  mapGeometryCache = await res.json();
  return mapGeometryCache;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function worldToLatLng(x, y, geo) {
  const { bounds } = geo;
  const nx = clamp01((x - bounds.minX) / (bounds.maxX - bounds.minX));
  const ny = clamp01((y - bounds.minY) / (bounds.maxY - bounds.minY));

  if (geo.orientation === "horizontal") {
    return L.latLng((1 - ny) * LIVE_MAP_SIZE, nx * LIVE_MAP_SIZE);
  }

  return L.latLng(ny * LIVE_MAP_SIZE, nx * LIVE_MAP_SIZE);
}

function addSectorOverlay(geo, score) {
  const allied = Number(score?.allied) || 0;
  const axis = Number(score?.axis) || 0;
  const size = LIVE_MAP_SIZE;
  const gridLines = [0.2, 0.4, 0.6, 0.8].map((f) => Math.round(f * size));
  const alliedDepth = (allied / 5) * size;
  const axisDepth = (axis / 5) * size;

  const zoneStyle = {
    interactive: false,
    stroke: false
  };

  const gridStyle = {
    color: "#d6d3c8",
    weight: 2,
    opacity: 0.45,
    interactive: false
  };

  const frontStyle = (color) => ({
    color,
    weight: 4,
    opacity: 0.9,
    interactive: false
  });

  if (geo.orientation === "horizontal") {
    if (allied > 0) {
      L.rectangle(
        [[0, 0], [size, alliedDepth]],
        { ...zoneStyle, fillColor: "#3b82f6", fillOpacity: 0.14 }
      ).addTo(liveLayer);
      L.polyline([[0, alliedDepth], [size, alliedDepth]], frontStyle("#3b82f6")).addTo(liveLayer);
    }

    if (axis > 0) {
      L.rectangle(
        [[0, size - axisDepth], [size, size]],
        { ...zoneStyle, fillColor: "#ef4444", fillOpacity: 0.14 }
      ).addTo(liveLayer);
      L.polyline([[0, size - axisDepth], [size, size - axisDepth]], frontStyle("#ef4444")).addTo(liveLayer);
    }

    for (const lng of gridLines) {
      L.polyline([[0, lng], [size, lng]], gridStyle).addTo(liveLayer);
    }
    return;
  }

  if (allied > 0) {
    L.rectangle(
      [[0, 0], [alliedDepth, size]],
      { ...zoneStyle, fillColor: "#3b82f6", fillOpacity: 0.14 }
    ).addTo(liveLayer);
    L.polyline([[alliedDepth, 0], [alliedDepth, size]], frontStyle("#3b82f6")).addTo(liveLayer);
  }

  if (axis > 0) {
    L.rectangle(
      [[size - axisDepth, 0], [size, size]],
      { ...zoneStyle, fillColor: "#ef4444", fillOpacity: 0.14 }
    ).addTo(liveLayer);
    L.polyline([[size - axisDepth, 0], [size - axisDepth, size]], frontStyle("#ef4444")).addTo(liveLayer);
  }

  for (const lat of gridLines) {
    L.polyline([[lat, 0], [lat, size]], gridStyle).addTo(liveLayer);
  }
}

function addCapturePoints(geo) {
  for (const point of geo.points) {
    const latlng = worldToLatLng(point.x, point.y, geo);
    L.circleMarker(latlng, {
      radius: 5,
      color: "#b45309",
      weight: 2,
      fillColor: "#fbbf24",
      fillOpacity: 0.95,
      interactive: false
    }).addTo(liveLayer);
  }
}

function addPlayers(players, geo) {
  for (const player of players) {
    const latlng = worldToLatLng(player.x, player.y, geo);
    const color =
      player.team === "allies" ? "#3b82f6" : player.team === "axis" ? "#ef4444" : "#d1d5db";

    L.circleMarker(latlng, {
      radius: 5,
      color: "#111",
      weight: 1,
      fillColor: color,
      fillOpacity: 1,
      interactive: false
    }).addTo(liveLayer);
  }
}

function liveFingerprint(mapId, live) {
  return JSON.stringify({
    mapId,
    score: live?.score,
    players: (live?.players || []).map((p) => [p.id, Math.round(p.x), Math.round(p.y)])
  });
}

async function renderLiveState(mapId, live, leafletMap) {
  initLiveLayer(leafletMap);
  if (!mapId || !live) return;

  const fingerprint = liveFingerprint(mapId, live);
  if (fingerprint === lastLiveFingerprint) return;
  lastLiveFingerprint = fingerprint;

  const geometry = await loadMapGeometry();
  const geo = geometry?.maps?.[mapId];
  liveLayer.clearLayers();
  if (!geo) return;

  addSectorOverlay(geo, live.score);
  addCapturePoints(geo);
  addPlayers(live.players || [], geo);
}

function clearLiveLayer() {
  lastLiveFingerprint = "";
  liveLayer?.clearLayers();
}
