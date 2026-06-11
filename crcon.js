function authHeaders(token) {
  const headers = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function extractMapName(payload) {
  if (!payload) return null;

  let name = null;
  if (typeof payload === "string") {
    name = payload;
  } else if (payload.current_map) {
    const current = payload.current_map;
    if (typeof current === "string") {
      name = current;
    } else if (current.map != null) {
      const map = current.map;
      if (typeof map === "string") {
        name = map;
      } else {
        name = map.id || map.name || map.layer_name || map.map?.id || null;
      }
    }
  } else if (payload.map != null) {
    const map = payload.map;
    name = typeof map === "string" ? map : map.id || map.name || null;
  }

  if (!name) return null;
  name = String(name).trim();
  if (!name || /^untitled_/i.test(name)) return null;
  return name.replace(/_RESTART$/i, "");
}

async function readJsonResponse(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { result: text.trim() };
  }
}

async function requestCrcon(baseUrl, token, path, options = {}) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders(token),
      ...(options.headers || {})
    }
  });

  if (!res.ok) {
    throw new Error(`CRCON ${path} failed (${res.status})`);
  }

  const data = await readJsonResponse(res);
  if (data?.failed) {
    throw new Error(data.error || `CRCON ${path} failed`);
  }

  return data;
}

async function getCrconMap(baseUrl, token) {
  const attempts = [
    () => requestCrcon(baseUrl, token, "/api/get_public_info"),
    () =>
      requestCrcon(baseUrl, token, "/api/get_gamestate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }),
    () => requestCrcon(baseUrl, token, "/api/get_map")
  ];

  let lastError = "Could not read map from CRCON";

  for (const attempt of attempts) {
    try {
      const data = await attempt();
      const mapName = extractMapName(data?.result ?? data);
      if (mapName) {
        return { success: true, mapName };
      }
      lastError = "CRCON response did not include a map name";
    } catch (err) {
      lastError = err.message;
    }
  }

  return { success: false, error: lastError };
}

function playerListFromResult(result) {
  if (!result) return [];
  if (Array.isArray(result)) return result;
  if (Array.isArray(result.players)) return result.players;
  if (result.players && typeof result.players === "object") {
    return Object.values(result.players);
  }
  return [];
}

function parsePlayerEntry(player) {
  const pos = player.world_position || player.worldPosition || {};
  const x = Number(pos.x);
  const y = Number(pos.y);
  const z = Number(pos.z);

  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x === 0 && y === 0 && z === 0) return null;

  const name = player.name || "";
  if (!name) return null;

  return {
    id: player.player_id || player.iD || player.id,
    name,
    team: player.team || null,
    role: player.role || null,
    squad: player.unit_name || player.platoon || null,
    x,
    y,
    z: Number.isFinite(z) ? z : 0
  };
}

function parsePlayers(result) {
  return playerListFromResult(result)
    .map(parsePlayerEntry)
    .filter(Boolean);
}

async function getCrconPlayers(baseUrl, token) {
  if (!token) {
    return {
      players: [],
      playersError: "Add CRCON_API_TOKEN for live player positions"
    };
  }

  try {
    const detailed = await requestCrcon(baseUrl, token, "/api/get_detailed_players");
    const players = parsePlayers(detailed?.result);
    return { players, playersError: null };
  } catch (err) {
    return { players: [], playersError: err.message };
  }
}

async function getCrconLiveState(baseUrl, token) {
  const data = await requestCrcon(baseUrl, token, "/api/get_public_info");
  const result = data?.result || {};
  const score = result.score || { allied: 0, axis: 0 };
  const { players, playersError } = await getCrconPlayers(baseUrl, token);

  return {
    success: true,
    score,
    players,
    playersError,
    playerCounts: result.player_count_by_team || null
  };
}

module.exports = {
  getCrconMap,
  getCrconLiveState,
  getCrconPlayers,
  extractMapName
};
