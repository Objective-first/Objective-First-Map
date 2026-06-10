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

function parsePlayers(detailedResult) {
  const playersById = detailedResult?.players;
  if (!playersById || typeof playersById !== "object") return [];

  return Object.values(playersById)
    .map((player) => {
      const pos = player.world_position || player.worldPosition || {};
      const x = Number(pos.x) || 0;
      const y = Number(pos.y) || 0;
      const z = Number(pos.z) || 0;
      const alive = !(x === 0 && y === 0 && z === 0);

      return {
        id: player.player_id || player.iD || player.id,
        name: player.name || "",
        team: player.team || null,
        role: player.role || null,
        squad: player.unit_name || null,
        x,
        y,
        z,
        alive
      };
    })
    .filter((player) => player.alive && player.name);
}

async function getCrconLiveState(baseUrl, token) {
  const data = await requestCrcon(baseUrl, token, "/api/get_public_info");
  const result = data?.result || {};
  const score = result.score || { allied: 0, axis: 0 };

  let players = [];
  let playersError = null;

  if (token) {
    try {
      const detailed = await requestCrcon(baseUrl, token, "/api/get_detailed_players");
      players = parsePlayers(detailed?.result);
    } catch (err) {
      playersError = err.message;
    }
  } else {
    playersError = "Add CRCON_API_TOKEN for live player positions";
  }

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
  extractMapName
};
