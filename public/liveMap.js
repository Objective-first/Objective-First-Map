const LIVE_MAP_SIZE = 1000;

let sectorLayer = null;
let playerLayer = null;
let leaderLayer = null;
let mapGeometryCache = null;
let lastSectorKey = "";
let lastPlayerKey = "";
let renderToken = 0;

function initLiveLayer(leafletMap) {
  if (!leafletMap.getPane("livePane")) {
    leafletMap.createPane("livePane");
    leafletMap.getPane("livePane").style.zIndex = 350;
  }
  if (!leafletMap.getPane("liveLeaderPane")) {
    leafletMap.createPane("liveLeaderPane");
    leafletMap.getPane("liveLeaderPane").style.zIndex = 520;
  }

  if (!sectorLayer) {
    sectorLayer = L.layerGroup([], { pane: "livePane" }).addTo(leafletMap);
  }
  if (!playerLayer) {
    playerLayer = L.layerGroup([], { pane: "livePane" }).addTo(leafletMap);
  }
  if (!leaderLayer) {
    leaderLayer = L.layerGroup().addTo(leafletMap);
  }

  return { sectorLayer, playerLayer, leaderLayer };
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

function addTeamZone(layer, start, end, color, isHorizontal) {
  const zoneStyle = {
    interactive: false,
    stroke: false,
    fillColor: color,
    fillOpacity: 0.14
  };

  const frontStyle = {
    color,
    weight: 4,
    opacity: 0.9,
    interactive: false
  };

  if (isHorizontal) {
    L.rectangle([[0, start], [LIVE_MAP_SIZE, end]], zoneStyle).addTo(layer);
    L.polyline([[0, end], [LIVE_MAP_SIZE, end]], frontStyle).addTo(layer);
    return;
  }

  L.rectangle([[start, 0], [end, LIVE_MAP_SIZE]], zoneStyle).addTo(layer);
  L.polyline([[end, 0], [end, LIVE_MAP_SIZE]], frontStyle).addTo(layer);
}

function addSectorOverlay(layer, geo, score) {
  const allied = Number(score?.allied) || 0;
  const axis = Number(score?.axis) || 0;
  const size = LIVE_MAP_SIZE;
  const mirror = geo.mirror_factions === true;
  const isHorizontal = geo.orientation === "horizontal";

  const gridLines = [0.2, 0.4, 0.6, 0.8].map((f) => Math.round(f * size));
  const alliedDepth = (allied / 5) * size;
  const axisDepth = (axis / 5) * size;

  const gridStyle = {
    color: "#d6d3c8",
    weight: 2,
    opacity: 0.45,
    interactive: false
  };

  const alliesOnStartSide = !mirror;

  if (alliesOnStartSide) {
    if (allied > 0) {
      addTeamZone(layer, 0, alliedDepth, "#3b82f6", isHorizontal);
    }
    if (axis > 0) {
      addTeamZone(layer, size - axisDepth, size, "#ef4444", isHorizontal);
    }
  } else {
    if (axis > 0) {
      addTeamZone(layer, 0, axisDepth, "#ef4444", isHorizontal);
    }
    if (allied > 0) {
      addTeamZone(layer, size - alliedDepth, size, "#3b82f6", isHorizontal);
    }
  }

  if (isHorizontal) {
    for (const lng of gridLines) {
      L.polyline([[0, lng], [size, lng]], gridStyle).addTo(layer);
    }
    return;
  }

  for (const lat of gridLines) {
    L.polyline([[lat, 0], [lat, size]], gridStyle).addTo(layer);
  }
}

function addPlayers(layer, players, geo) {
  for (const player of players) {
    const latlng = worldToLatLng(player.x, player.y, geo);

    L.circleMarker(latlng, {
      radius: 5,
      color: "#111",
      weight: 1,
      fillColor: "#ef4444",
      fillOpacity: 1,
      interactive: false
    }).addTo(layer);
  }
}

function normalizeRole(role) {
  return String(role || "").toLowerCase().replace(/[^a-z]/g, "");
}

function liveLeaderKind(player) {
  const role = normalizeRole(player.role);
  if (!role) return null;

  if (role === "armycommander" || role === "commander") return "commander";
  if (
    role === "officer" ||
    role === "squadleader" ||
    role === "squadlead" ||
    role === "platoonleader" ||
    role === "tankcommander" ||
    role === "crewcommander" ||
    role === "spotter"
  ) {
    return "squadLeader";
  }

  return null;
}

function liveLeaderLabel(player, kind) {
  if (kind === "commander") return "CMD";
  const squad = String(player.squad || "").trim();
  if (squad) return squad;
  return "SL";
}

function liveLeaderColor(player, kind) {
  if (kind === "commander") return "#facc15";

  const team = String(player.team || "").toLowerCase();
  if (team.includes("axis") || team.includes("german")) return "#ef4444";
  if (team.includes("allied") || team.includes("ally") || team.includes("us") || team.includes("brit")) {
    return "#3b82f6";
  }
  return "#22c55e";
}

function createLiveLeaderMarker(latlng, player, kind) {
  const type = kind === "commander" ? "defend" : "observe";
  const label = liveLeaderLabel(player, kind);
  const color = liveLeaderColor(player, kind);
  const layout = markerIconLayout(type);
  const role = player.role ? ` - ${player.role}` : "";

  const icon = L.divIcon({
    className: "hll-marker-wrap live-leader-marker-wrap",
    html: markerHtml(type, label, color),
    iconSize: layout.iconSize,
    iconAnchor: layout.iconAnchor
  });

  return L.marker(latlng, {
    icon,
    interactive: false,
    keyboard: false,
    pane: "liveLeaderPane",
    title: `${label}: ${player.name || "Leader"}${role}`,
    zIndexOffset: kind === "commander" ? 1200 : 1000
  });
}

function addLeaderMarkers(layer, players, geo) {
  for (const player of players) {
    const kind = liveLeaderKind(player);
    if (!kind) continue;

    const latlng = worldToLatLng(player.x, player.y, geo);
    createLiveLeaderMarker(latlng, player, kind).addTo(layer);
  }
}

function sectorKey(mapId, live) {
  return JSON.stringify({ mapId, score: live?.score });
}

function playerKey(live) {
  return JSON.stringify({
    updatedAt: live?.updatedAt || null,
    error: live?.playersError || null,
    players: (live?.players || []).map((p) => [
      p.id,
      p.role,
      p.team,
      p.squad,
      Math.round(p.x / 100),
      Math.round(p.y / 100)
    ])
  });
}

async function renderLiveState(mapId, live, leafletMap) {
  initLiveLayer(leafletMap);

  if (!mapId || !live) return;

  const token = ++renderToken;
  const geometry = await loadMapGeometry();
  if (token !== renderToken) return;

  const geo = geometry?.maps?.[mapId];
  if (!geo) return;

  const nextSectorKey = sectorKey(mapId, live);
  if (nextSectorKey !== lastSectorKey) {
    sectorLayer.clearLayers();
    addSectorOverlay(sectorLayer, geo, live.score);
    lastSectorKey = nextSectorKey;
  }

  const nextPlayerKey = playerKey(live);
  if (nextPlayerKey === lastPlayerKey) return;

  lastPlayerKey = nextPlayerKey;
  playerLayer.clearLayers();
  leaderLayer.clearLayers();

  if (live.playersError || !live.players?.length) return;

  addPlayers(playerLayer, live.players, geo);
  addLeaderMarkers(leaderLayer, live.players, geo);
}

function clearLiveLayer() {
  renderToken += 1;
  lastSectorKey = "";
  lastPlayerKey = "";
  sectorLayer?.clearLayers();
  playerLayer?.clearLayers();
  leaderLayer?.clearLayers();
}
