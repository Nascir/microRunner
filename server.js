const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const fs = require("fs");
const chokidar = require("chokidar");
const backup = require("./src/backup.js");
const config = require("./src/config.js");

const PORT = process.env.PORT || 3000;
const PROJECTS_DIR = path.join(__dirname, "projects");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(require("express-fileupload")());
app.use(express.static(path.join(__dirname, "static")));

const projectClients = new Map();
const projectSpriteWatchers = new Map();

function ensureProjectsDir() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    fs.mkdirSync(PROJECTS_DIR, { recursive: true });
  }
}

function ensureProjectStructure(projectPath, projectName, options = {}) {
  fs.mkdirSync(path.join(projectPath, "ms"), { recursive: true });
  fs.mkdirSync(path.join(projectPath, "sprites"), { recursive: true });

  const defaultIconPath = path.join(__dirname, "static", "icon.png");
  if (fs.existsSync(defaultIconPath)) {
    fs.copyFileSync(
      defaultIconPath,
      path.join(projectPath, "sprites", "icon.png"),
    );
  }

  const mainMsPath = path.join(projectPath, "ms", "main.ms");
  if (!fs.existsSync(mainMsPath)) {
    const mainMs = `init = function()
end

update = function()
end

draw = function()
  screen.clear()
  screen.drawText("Hello, World!", 0, 0, 12, "white")
end
`;
    fs.writeFileSync(mainMsPath, mainMs);
  }

  if (options.createConfig !== false) {
    const projectConfig = config.createConfig(options.name || projectName, path.basename(projectPath), {
      orientation: options.orientation || "any",
      aspect: options.aspect || "free",
      spriteDirection: options.spriteDirection || "vertical",
      spriteFrames: { "icon.png": 1 }
    });
    config.write(projectPath, projectConfig);
  }
}

function createDemoProject() {
  const demoPath = path.join(PROJECTS_DIR, "demo");

  if (!fs.existsSync(demoPath)) {
    fs.mkdirSync(demoPath, { recursive: true });
  }

  const mainMsPath = path.join(demoPath, "ms", "main.ms");
  if (!fs.existsSync(mainMsPath)) {
    fs.mkdirSync(path.join(demoPath, "ms"), { recursive: true });
    fs.mkdirSync(path.join(demoPath, "sprites"), { recursive: true });

    fs.writeFileSync(
      mainMsPath,
      `init = function()
end

update = function()
end

draw = function()
end
`,
    );
  }

  const tomlPath = path.join(demoPath, "project.toml");
  if (!fs.existsSync(tomlPath)) {
    const demoConfig = config.createConfig("Demo Project", "demo", {});
    config.write(demoPath, demoConfig);
  }
}

async function migrateProjectToToml(projectName) {
  const projectPath = path.join(PROJECTS_DIR, projectName);
  const tomlPath = path.join(projectPath, "project.toml");

  if (fs.existsSync(tomlPath)) {
    return;
  }

  const projectJsonPath = path.join(projectPath, "project.json");
  const configJsonPath = path.join(projectPath, "config.json");

  let legacyConfig = null;

  if (fs.existsSync(projectJsonPath)) {
    try {
      const projectJson = JSON.parse(fs.readFileSync(projectJsonPath, "utf-8"));
      legacyConfig = config.fromProjectJson(projectJson);
      console.log(`[Server] Migrated project.json to TOML for ${projectName}`);
    } catch (e) {
      console.warn(`[Server] Failed to parse project.json for ${projectName}:`, e.message);
    }
  } else if (fs.existsSync(configJsonPath)) {
    try {
      const configJson = JSON.parse(fs.readFileSync(configJsonPath, "utf-8"));
      legacyConfig = config.createConfig(configJson.name || projectName, projectName, {
        orientation: configJson.orientation || "any",
        aspect: configJson.aspect || "free",
        graphics: configJson.graphics || "m1",
        spriteDirection: configJson.spriteDirection || "vertical"
      });
      console.log(`[Server] Migrated config.json to TOML for ${projectName}`);
    } catch (e) {
      console.warn(`[Server] Failed to parse config.json for ${projectName}:`, e.message);
    }
  }

  if (legacyConfig) {
    await config.write(projectPath, legacyConfig);
  } else {
    ensureProjectStructure(projectPath, projectName, { createConfig: false });
    const defaultConfig = config.createConfig(projectName, projectName, {});
    await config.write(projectPath, defaultConfig);
    console.log(`[Server] Utworzono domyślne pliki projektu: ${projectName}`);
  }
}

async function migrateAllProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return;
  }

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      await migrateProjectToToml(entry.name);
    }
  }
}

function getLatestMtime(dir) {
  let latest = 0;

  function walk(currentPath) {
    if (!fs.existsSync(currentPath)) return;

    const stats = fs.statSync(currentPath);
    if (stats.mtimeMs > latest) {
      latest = stats.mtimeMs;
    }

    if (stats.isDirectory()) {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });
      for (const entry of entries) {
        walk(path.join(currentPath, entry.name));
      }
    }
  }

  walk(dir);
  return latest;
}

function getProjectLastUpdated(projectSlug) {
  const projectDir = path.join(PROJECTS_DIR, projectSlug);
  const mtimeMs = getLatestMtime(projectDir);
  return mtimeMs > 0 ? new Date(mtimeMs) : null;
}

function validatePath(project, subdir, userPath) {
  const basePath = path.resolve(PROJECTS_DIR, project, subdir);
  const resolved = path.resolve(basePath, userPath);
  const relative = path.relative(basePath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return resolved;
}

async function getProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return [];

  const projects = [];
  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const projectPath = path.join(PROJECTS_DIR, entry.name);
      let projectConfig;

      try {
        projectConfig = await config.read(projectPath);
      } catch (e) {
        console.warn(`Failed to read project.toml for ${entry.name}:`, e.message);
        continue;
      }

      const projectData = {
        name: projectConfig.meta.name,
        slug: projectConfig.meta.slug,
        orientation: projectConfig.settings.orientation,
        aspect: projectConfig.settings.aspect,
        projectPath: "~/projects/" + entry.name + "/",
        lastUpdated: getProjectLastUpdated(entry.name),
      };
      projects.push(projectData);
    }
  }
  return projects;
}

async function getProjectFiles(project) {
  const projectPath = path.join(PROJECTS_DIR, project);

  const msDir = path.join(projectPath, "ms");
  const sources = [];
  if (fs.existsSync(msDir)) {
    const msFiles = fs.readdirSync(msDir, { recursive: true });
    for (const file of msFiles) {
      if (file.endsWith(".ms")) {
        const name = file.replace(".ms", "").replace(/\//g, "-");
        sources.push({
          file: file,
          name: name,
          version: Date.now(),
        });
      }
    }
  }

  const spritesDir = path.join(projectPath, "sprites");
  const images = [];
  if (fs.existsSync(spritesDir)) {
    const spriteFiles = fs.readdirSync(spritesDir);

    let spriteProperties = {};

    try {
      const projectConfig = await config.read(projectPath);
      const spriteDirection = projectConfig.sprites?.direction || "vertical";

      for (const [key, value] of Object.entries(projectConfig.sprites || {})) {
        if (key !== "direction") {
          spriteProperties[key] = { frames: value.frames, fps: 5 };
        }
      }

      for (const file of spriteFiles) {
        if (file.match(/\.(png|jpg|jpeg|gif)$/i)) {
          const name = file
            .replace(/\.(png|jpg|jpeg|gif)$/i, "")
            .replace(/\//g, "-");
          const imageObj = {
            file: name + ".png",
            version: Date.now(),
          };

          if (spriteProperties[file]) {
            imageObj.properties = spriteProperties[file];
          } else {
            const pngPath = path.join(spritesDir, file);
            if (fs.existsSync(pngPath)) {
              try {
                const buffer = fs.readFileSync(pngPath);
                if (buffer.length >= 24) {
                  const width = buffer.readUInt32BE(16);
                  const height = buffer.readUInt32BE(20);
                  let frames = 1;

                  if (spriteDirection === "horizontal") {
                    frames = Math.max(1, Math.round(width / height));
                  } else {
                    frames = Math.max(1, Math.round(height / width));
                  }

                  imageObj.properties = { frames: frames, fps: 5 };
                }
              } catch (err) {
                imageObj.properties = { frames: 1, fps: 5 };
              }
            } else {
              imageObj.properties = { frames: 1, fps: 5 };
            }
          }

          images.push(imageObj);
        }
      }
    } catch (e) {
      console.warn("Failed to read project.toml for", project, e.message);
    }
  }

  const mapsDir = path.join(projectPath, "maps");
  const maps = [];
  if (fs.existsSync(mapsDir)) {
    const mapFiles = fs.readdirSync(mapsDir);
    for (const file of mapFiles) {
      if (file.endsWith(".json") || file.endsWith(".map")) {
        const name = file.replace(/\.(json|map)$/i, "").replace(/\//g, "-");
        maps.push({
          file: name + ".json",
          version: Date.now(),
        });
      }
    }
  }

  const soundsDir = path.join(PROJECTS_DIR, project, "sounds");
  const sounds = [];
  if (fs.existsSync(soundsDir)) {
    const soundFiles = fs.readdirSync(soundsDir);
    for (const file of soundFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, "").replace(/\//g, "-");
        const ext = file.split(".").pop();
        sounds.push({
          file: name + "." + ext,
          version: Date.now(),
        });
      }
    }
  }

  const musicDir = path.join(PROJECTS_DIR, project, "music");
  const music = [];
  if (fs.existsSync(musicDir)) {
    const musicFiles = fs.readdirSync(musicDir);
    for (const file of musicFiles) {
      if (file.match(/\.(wav|mp3|ogg)$/i)) {
        const name = file.replace(/\.(wav|mp3|ogg)$/i, "").replace(/\//g, "-");
        const ext = file.split(".").pop();
        music.push({
          file: name + "." + ext,
          version: Date.now(),
        });
      }
    }
  }

  const assetsDir = path.join(PROJECTS_DIR, project, "assets");
  const assets = [];
  if (fs.existsSync(assetsDir)) {
    const assetFiles = fs.readdirSync(assetsDir);
    for (const file of assetFiles) {
      if (file.match(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i)) {
        const name = file
          .replace(/\.(json|glb|obj|jpg|ttf|wasm|txt|csv|md)$/i, "")
          .replace(/\//g, "-");
        assets.push({
          file: name + "." + file.split(".").pop(),
          version: Date.now(),
        });
      }
    }
  }

  return { sources, images, maps, sounds, music, assets };
}

function watchProject(project) {
  if (projectClients.has(project)) return;

  const projectPath = path.join(PROJECTS_DIR, project);
  const msDir = path.join(projectPath, "ms");

  if (!fs.existsSync(msDir)) return;

  const watcher = chokidar.watch(msDir, {
    ignored: /^\./,
    persistent: true,
  });

  watcher.on("change", async (filePath) => {
    const fileName = path.basename(filePath);
    const content = fs.readFileSync(filePath, "utf-8");

    broadcastToProject(project, {
      type: "update",
      file: fileName.replace(".ms", ""),
      code: content,
      version: Date.now(),
    });

    await config.touch(projectPath);
    broadcastToAllProjects();
  });

  projectClients.set(project, watcher);
  watchSprites(project);
}

async function handleSpriteChange(project, event, filePath) {
  const projectPath = path.join(PROJECTS_DIR, project);
  const fileName = path.basename(filePath);

  try {
    await config.syncSprites(projectPath);
    const spriteProps = config.getSpriteProperties(fileName, projectPath);

    broadcastToProject(project, {
      type: "sprites",
      file: fileName.replace(/\.(png|jpg|jpeg|gif)$/i, ""),
      version: Date.now(),
      properties: spriteProps || { frames: 1 },
    });
  } catch (e) {
    console.error(`[Server] Error handling sprite change for ${project}:`, e);
  }
}

function watchSprites(project) {
  if (projectSpriteWatchers.has(project)) return;

  const projectPath = path.join(PROJECTS_DIR, project);
  const spritesDir = path.join(projectPath, "sprites");

  if (!fs.existsSync(spritesDir)) return;

  const watcher = chokidar.watch(spritesDir, {
    ignored: /^\./,
    persistent: true,
  });

  watcher.on("add", (filePath) => handleSpriteChange(project, "add", filePath));
  watcher.on("unlink", (filePath) => handleSpriteChange(project, "unlink", filePath));
  watcher.on("change", (filePath) => handleSpriteChange(project, "change", filePath));

  projectSpriteWatchers.set(project, watcher);
}

function watchAllProjects() {
  if (!fs.existsSync(PROJECTS_DIR)) return;

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      watchProject(entry.name);
    }
  }
}

function broadcastToProject(project, message) {
  const clients = getWSClients(project);
  const msg = JSON.stringify(message);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

function broadcastToAllProjects() {
  const message = JSON.stringify({ type: "projectListUpdated" });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function getWSClients(project) {
  return Array.from(wss.clients).filter((client) => {
    return client.project === project && client.readyState === WebSocket.OPEN;
  });
}

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const project = url.searchParams.get("project");
  ws.project = project;

  if (project) {
    watchProject(project);
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "index.html"));
});

app.get("/api/projects", async (req, res) => {
  const projects = await getProjects();
  res.json(projects);
});

app.get("/api/project/:name", async (req, res) => {
  const project = req.params.name;
  const projectPath = path.join(PROJECTS_DIR, project);

  let projectConfig;
  try {
    projectConfig = await config.read(projectPath);
  } catch (e) {
    return res.status(404).json({ error: "Project not found" });
  }

  const files = await getProjectFiles(project);
  const configData = {
    name: projectConfig.meta.name,
    slug: projectConfig.meta.slug,
    orientation: projectConfig.settings.orientation,
    aspect: projectConfig.settings.aspect,
    graphics: projectConfig.settings.graphics,
    spriteDirection: projectConfig.sprites.direction
  };
  res.json({ ...configData, files });
});

app.get("/api/file/:project/*", (req, res) => {
  const { project } = req.params;
  const file = req.params[0];
  const filePath = validatePath(project, "ms", file);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "text/plain");
    res.send(fs.readFileSync(filePath, "utf-8"));
  } else {
    res.status(404).send("File not found");
  }
});

app.put("/api/project/:name/config", async (req, res) => {
  const { name } = req.params;
  const newConfig = req.body;

  const projectPath = path.join(PROJECTS_DIR, name);
  const tomlPath = path.join(projectPath, "project.toml");

  if (!fs.existsSync(tomlPath)) {
    return res.status(404).json({ error: "Project not found" });
  }

  const oldSlug = name;
  const newSlug = newConfig.slug || name;

  try {
    if (oldSlug !== newSlug) {
      const oldProjectPath = path.join(PROJECTS_DIR, oldSlug);
      const newProjectPath = path.join(PROJECTS_DIR, newSlug);
      if (fs.existsSync(newProjectPath)) {
        return res
          .status(400)
          .json({ error: "A project with this slug already exists" });
      }
      fs.renameSync(oldProjectPath, newProjectPath);
    }

    const projectConfig = await config.read(path.join(PROJECTS_DIR, newSlug));
    projectConfig.meta.name = newConfig.name;
    projectConfig.meta.slug = newConfig.slug;
    projectConfig.settings.orientation = newConfig.orientation;
    projectConfig.settings.aspect = newConfig.aspect;
    projectConfig.settings.graphics = newConfig.graphics;
    projectConfig.sprites.direction = newConfig.spriteDirection;
    projectConfig.meta.lastModified = new Date().toISOString().slice(0, 19) + 'Z';

    await config.write(path.join(PROJECTS_DIR, newSlug), projectConfig);

    res.json({ success: true, slug: newSlug });
  } catch (e) {
    console.error("Failed to update project config:", e);
    res.status(500).json({ error: "Failed to update configuration" });
  }
});

app.post("/api/projects", (req, res) => {
  const { name, slug, orientation, aspect, spriteDirection } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Project name is required" });
  }

  const generateSlug = (n) =>
    n
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");
  const baseSlug = slug || generateSlug(name);
  let projectSlug = baseSlug;
  let counter = 1;

  while (fs.existsSync(path.join(PROJECTS_DIR, projectSlug))) {
    projectSlug = `${baseSlug}-${counter}`;
    counter++;
  }

  try {
    const projectPath = path.join(PROJECTS_DIR, projectSlug);

    ensureProjectStructure(projectPath, projectSlug, {
      name: name,
      orientation: orientation || "any",
      aspect: aspect || "free",
      spriteDirection: spriteDirection || "vertical"
    });

    res.json({ success: true, slug: projectSlug });
  } catch (e) {
    console.error("Failed to create project:", e);
    res.status(500).json({ error: "Failed to create project" });
  }
});

app.delete("/api/project/:name", (req, res) => {
  const { name } = req.params;
  const projectPath = path.join(PROJECTS_DIR, name);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({ error: "Project not found" });
  }

  try {
    fs.rmSync(projectPath, { recursive: true, force: true });
    backup.deleteAllBackups(name);
    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete project:", e);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

app.post("/api/project/:name/duplicate", async (req, res) => {
  const { name } = req.params;
  const projectPath = path.join(PROJECTS_DIR, name);

  if (!fs.existsSync(projectPath)) {
    return res.status(404).json({ error: "Project not found" });
  }

  try {
    const result = await backup.duplicateProject(name);
    res.json(result);
  } catch (e) {
    console.error("Failed to duplicate project:", e);
    res.status(500).json({ error: "Failed to duplicate project" });
  }
});

app.get("/api/sprite/:project/*", (req, res) => {
  const { project } = req.params;
  const spritePath = req.params[0];
  const filePath = validatePath(project, "sprites", spritePath);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("Sprite not found");
  }
});

app.get("/api/map/:project/*", (req, res) => {
  const { project } = req.params;
  const mapPath = req.params[0];
  const filePath = validatePath(project, "maps", mapPath);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/json");
    res.sendFile(filePath);
  } else {
    res.status(404).send("Map not found");
  }
});

app.get("/api/sound/:project/*", (req, res) => {
  const { project } = req.params;
  const soundPath = req.params[0];
  let filePath = validatePath(project, "sounds", soundPath);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = soundPath.split(".").pop();
    if (ext !== "wav" && ext !== "mp3" && ext !== "ogg") {
      const basePath = soundPath.replace(/\.(wav|mp3|ogg)$/i, "");
      for (const tryExt of ["wav", "mp3", "ogg"]) {
        const tryPath = validatePath(
          project,
          "sounds",
          basePath + "." + tryExt,
        );
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send("Sound not found");
  }
});

app.get("/api/music/:project/*", (req, res) => {
  const { project } = req.params;
  const musicPath = req.params[0];
  let filePath = validatePath(project, "music", musicPath);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    const ext = musicPath.split(".").pop();
    if (ext !== "wav" && ext !== "mp3" && ext !== "ogg") {
      const basePath = musicPath.replace(/\.(wav|mp3|ogg)$/i, "");
      for (const tryExt of ["wav", "mp3", "ogg"]) {
        const tryPath = validatePath(project, "music", basePath + "." + tryExt);
        if (tryPath && fs.existsSync(tryPath)) {
          return res.sendFile(tryPath);
        }
      }
    }
    res.status(404).send("Music not found");
  }
});

app.get("/api/assets/:project/*", (req, res) => {
  const { project } = req.params;
  const assetPath = req.params[0];
  const filePath = validatePath(project, "assets", assetPath);
  if (!filePath) {
    return res.status(403).send("Access denied");
  }
  if (fs.existsSync(filePath)) {
    res.setHeader("Content-Type", "application/octet-stream");
    res.sendFile(filePath);
  } else {
    res.status(404).send("Asset not found");
  }
});

app.post("/api/project/:name/backup", async (req, res) => {
  const { name } = req.params;
  try {
    const result = await backup.createBackup(name);
    res.json({
      success: true,
      fileName: result.fileName,
      timestamp: result.timestamp,
    });
  } catch (e) {
    console.error("Failed to create backup:", e);
    res.status(500).json({ error: "Failed to create backup" });
  }
});

app.get("/api/project/:name/export", async (req, res) => {
  const { name } = req.params;
  try {
    const result = await backup.createExport(name);
    res.download(result.filePath, result.fileName, (err) => {
      if (fs.existsSync(result.filePath)) {
        fs.unlinkSync(result.filePath);
      }
    });
  } catch (e) {
    console.error("Failed to export project:", e);
    res.status(500).json({ error: "Failed to export project" });
  }
});

app.get("/api/project/:name/backups", (req, res) => {
  const { name } = req.params;
  try {
    const backups = backup.listBackups(name);
    res.json(backups);
  } catch (e) {
    console.error("Failed to list backups:", e);
    res.status(500).json({ error: "Failed to list backups" });
  }
});

app.delete("/api/project/:name/backups/:file", (req, res) => {
  const { name, file } = req.params;
  try {
    backup.deleteBackup(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete backup:", e);
    res.status(500).json({ error: "Failed to delete backup" });
  }
});

app.get("/api/project/:name/backups/:file/download", (req, res) => {
  const { name, file } = req.params;
  try {
    const filePath = backup.getBackupPath(name, file);
    if (fs.existsSync(filePath)) {
      res.download(filePath, file);
    } else {
      res.status(404).json({ error: "Backup file not found" });
    }
  } catch (e) {
    console.error("Failed to download backup:", e);
    res.status(500).json({ error: "Failed to download backup" });
  }
});

app.post("/api/project/:name/restore", async (req, res) => {
  const { name } = req.params;
  const { backupFile, createPreRestoreBackup } = req.body;

  if (!backupFile) {
    return res.status(400).json({ error: "Backup file is required" });
  }

  try {
    const result = await backup.restoreProject(name, backupFile, {
      createPreRestoreBackup: createPreRestoreBackup,
    });
    res.json(result);
  } catch (e) {
    console.error("Failed to restore backup:", e);
    res.status(500).json({ error: "Failed to restore backup: " + e.message });
  }
});

app.post("/api/project/:name/restore-upload", async (req, res) => {
  const { name } = req.params;

  if (!req.files || !req.files.backup) {
    return res.status(400).json({ error: "No backup file uploaded" });
  }

  const backupFile = req.files.backup;
  const tempPath = path.join(__dirname, "temp_upload_" + Date.now() + ".zip");

  try {
    await backupFile.mv(tempPath);

    await backup.restoreProjectFromUpload(name, tempPath, {
      createPreRestoreBackup: true,
    });

    fs.unlinkSync(tempPath);

    res.json({ success: true });
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error("Failed to restore from uploaded backup:", e);
    res.status(500).json({ error: "Failed to restore backup: " + e.message });
  }
});

app.post("/api/import-project", async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const uploadedFile = req.files.file;
  const tempPath = path.join(__dirname, "temp_import_" + Date.now() + ".zip");

  try {
    await uploadedFile.mv(tempPath);

    const result = await backup.importProjectFromArchive(tempPath);

    fs.unlinkSync(tempPath);

    res.json(result);
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error("Failed to import project:", e);
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/project/:name/backups/upload", async (req, res) => {
  const { name } = req.params;

  if (!req.files || !req.files.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const uploadedFile = req.files.file;
  const tempPath = path.join(
    __dirname,
    "temp_backup_upload_" + Date.now() + ".zip",
  );

  try {
    await uploadedFile.mv(tempPath);

    const result = await backup.uploadBackupToArchive(name, tempPath);

    fs.unlinkSync(tempPath);

    res.json(result);
  } catch (e) {
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    console.error("Failed to upload backup:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/api/project/:name/backups/:file/note", (req, res) => {
  const { name, file } = req.params;
  try {
    const note = backup.getBackupNote(name, file);
    res.json({ note });
  } catch (e) {
    console.error("Failed to get note:", e);
    res.status(500).json({ error: "Failed to get note" });
  }
});

app.put("/api/project/:name/backups/:file/note", (req, res) => {
  const { name, file } = req.params;
  const { note } = req.body;
  try {
    backup.saveBackupNote(name, file, note || "");
    res.json({ success: true });
  } catch (e) {
    console.error("Failed to save note:", e);
    res.status(500).json({ error: "Failed to save note" });
  }
});

app.delete("/api/project/:name/backups/:file/note", (req, res) => {
  const { name, file } = req.params;
  try {
    backup.deleteBackupNote(name, file);
    res.json({ success: true });
  } catch (e) {
    console.error("Failed to delete note:", e);
    res.status(500).json({ error: "Failed to delete note" });
  }
});

app.get("/run/:project", (req, res) => {
  res.sendFile(path.join(__dirname, "static", "game.html"));
});

const GITHUB_REPO = "Nascir/microrunner";

app.get("/api/version", (req, res) => {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
  );
  const currentVersion = pkg.version;
  const updateConfig = pkg.update || { repository: "Nascir/microrunner", branch: "main" };
  const repo = updateConfig.repository;
  const branch = updateConfig.branch || "main";

  const https = require("https");
  https
    .get(
      `https://raw.githubusercontent.com/${repo}/${branch}/package.json`,
      {
        headers: {
          "User-Agent": "microRunner",
        },
        timeout: 10000,
      },
      (response) => {
        if (response.statusCode !== 200) {
          return res.json({
            current: currentVersion,
            latest: currentVersion,
            hasUpdate: false,
            downloadUrl: null,
            error: response.statusCode === 404 ? "Not found" : "Connection failed",
          });
        }

        let data = "";
        response.on("data", (chunk) => (data += chunk));
        response.on("end", () => {
          try {
            const remotePkg = JSON.parse(data);
            const latestVersion = remotePkg.version || currentVersion;
            res.json({
              current: currentVersion,
              latest: latestVersion,
              hasUpdate: latestVersion !== currentVersion,
              downloadUrl: `https://github.com/${repo}/archive/${branch}.zip`,
            });
          } catch (e) {
            res.json({
              current: currentVersion,
              latest: currentVersion,
              hasUpdate: false,
              downloadUrl: null,
              error: "Failed to parse remote package.json",
            });
          }
        });
      },
    )
    .on("error", () => {
      res.json({
        current: currentVersion,
        latest: currentVersion,
        hasUpdate: false,
        downloadUrl: null,
        error: "Connection failed",
      });
    });
});

app.get("/api/update/download", async (req, res) => {
  const https = require("https");
  const AdmZip = require("adm-zip");
  const crypto = require("crypto");

  const pkg = JSON.parse(
    fs.readFileSync(path.join(__dirname, "package.json"), "utf-8"),
  );
  const currentVersion = pkg.version;
  const updateConfig = pkg.update || { repository: "Nascir/microrunner", branch: "main" };
  const repo = updateConfig.repository;
  const branch = updateConfig.branch || "main";

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
  });
  res.write("\n");

  function sendProgress(message, progress = null) {
    const data = { message };
    if (progress !== null) data.progress = progress;
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  const excludePatterns = [
    "projects",
    "archive",
    ".gitignore",
    ".DS_Store",
    "node_modules",
    "temp_update_",
    "temp_extract_",
    "logs",
  ];

  function shouldExclude(filePath) {
    const baseName = path.basename(filePath);
    return excludePatterns.some((p) => baseName === p);
  }

  function getAllFiles(dir, baseDir) {
    const result = [];
    if (!fs.existsSync(dir)) return result;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      if (shouldExclude(relativePath) || shouldExclude(entry.name)) continue;

      if (entry.isDirectory()) {
        result.push(...getAllFiles(fullPath, baseDir));
      } else {
        result.push(relativePath);
      }
    }
    return result;
  }

  function calculateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash("sha256");
    hashSum.update(fileBuffer);
    return hashSum.digest("hex");
  }

  try {
    sendProgress("Checking for updates...", 5);

    const remotePackageJson = await new Promise((resolve, reject) => {
      https
        .get(
          `https://raw.githubusercontent.com/${repo}/${branch}/package.json`,
          { headers: { "User-Agent": "microRunner" }, timeout: 10000 },
          (response) => {
            if (response.statusCode !== 200) {
              reject(new Error(`HTTP ${response.statusCode}`));
              return;
            }
            let data = "";
            response.on("data", (chunk) => (data += chunk));
            response.on("end", () => {
              try {
                resolve(JSON.parse(data));
              } catch (e) {
                reject(new Error("Failed to parse remote package.json"));
              }
            });
          },
        )
        .on("error", reject)
        .setTimeout(10000, () => {
          reject(new Error("Request timeout"));
        });
    });

    const latestVersion = remotePackageJson.version;
    if (latestVersion === currentVersion) {
      sendProgress("Already up to date", 100);
      res.end();
      return;
    }

    sendProgress(`Downloading update (${currentVersion} → ${latestVersion})...`, 20);

    const zipUrl = `https://github.com/${repo}/archive/${branch}.zip`;
    const tempZip = path.join(__dirname, `temp_update_${Date.now()}.zip`);

    await new Promise((resolve, reject) => {
      let redirects = 0;

      function doRequest(url) {
        if (redirects > 5) {
          reject(new Error("Too many redirects"));
          return;
        }

        https
          .get(
            url,
            { headers: { "User-Agent": "microRunner" } },
            (response) => {
              if (response.statusCode === 302 || response.statusCode === 301) {
                redirects++;
                const location = response.headers.location;
                if (!location) {
                  reject(new Error("Redirect without location"));
                  return;
                }
                doRequest(
                  location.startsWith("http")
                    ? location
                    : `https://github.com${location}`,
                );
                return;
              }

              if (response.statusCode !== 200) {
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
              }

              const totalBytes = parseInt(response.headers["content-length"]) || 0;
              let downloadedBytes = 0;

              response.on("data", (chunk) => {
                downloadedBytes += chunk.length;
                if (totalBytes > 0) {
                  const percent = 20 + Math.min(20, (downloadedBytes / totalBytes) * 20);
                  sendProgress(`Downloading... ${Math.round(percent)}%`, percent);
                }
              });

              const file = fs.createWriteStream(tempZip);
              response.pipe(file);
              file.on("finish", () => {
                file.close();
                resolve();
              });
              file.on("error", (err) => {
                if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
                reject(err);
              });
            },
          )
            .on("error", reject)
            .setTimeout(60000, () => reject(new Error("Download timeout")));
      }

      doRequest(zipUrl);
    });

    const checksum = calculateChecksum(tempZip);
    console.log(`Downloaded archive SHA256: ${checksum}`);

    sendProgress("Extracting files...", 40);

    const tempDir = path.join(__dirname, `temp_extract_${Date.now()}`);
    const zip = new AdmZip(tempZip);
    zip.extractAllTo(tempDir, true);

    const entries = fs.readdirSync(tempDir);
    let sourceDir = null;

    for (const entry of entries) {
      const p = path.join(tempDir, entry);
      if (fs.statSync(p).isDirectory()) {
        if (fs.existsSync(path.join(p, 'package.json'))) {
          sourceDir = p;
          break;
        }
      }
    }

    if (!sourceDir) {
      throw new Error("Could not find source directory in update archive");
    }

    sendProgress("Installing files...", 70);

    fs.cpSync(sourceDir, __dirname, {
      recursive: true,
      force: true,
      filter: (src) => {
        const baseName = path.basename(src);
        return !excludePatterns.includes(baseName);
      }
    });

    const archiveFiles = getAllFiles(sourceDir, sourceDir);
    const localFiles = getAllFiles(__dirname, __dirname);

    let deletedCount = 0;
    for (const file of localFiles) {
      const topLevel = file.split('/')[0];
      if (excludePatterns.includes(topLevel)) continue;
      if (archiveFiles.includes(file)) continue;

      const fullPath = path.join(__dirname, file);
      if (fs.existsSync(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        deletedCount++;
      }
    }

    console.log(`[Update] Update complete. ${deletedCount} obsolete files removed.`);

    sendProgress("Verifying installation...", 90);

    const newPackagePath = path.join(__dirname, "package.json");
    if (fs.existsSync(newPackagePath)) {
      const newPackage = JSON.parse(fs.readFileSync(newPackagePath, "utf-8"));
      sendProgress(`Updated to v${newPackage.version}`, 100);
    } else {
      sendProgress("Update complete", 100);
    }

    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(tempDir))
      fs.rmSync(tempDir, { recursive: true, force: true });

    console.log("\n🔄 Update complete. Server stopped.");
    console.log("📝 Run 'npm install' then 'npm start' to continue.\n");

    setTimeout(() => {
      res.end();
      server.close(() => {
        console.log('Server closed gracefully');
        process.exit(0);
      });
      setTimeout(() => {
        console.log('Forcing server shutdown...');
        process.exit(0);
      }, 5000);
    }, 2000);
  } catch (e) {
    sendProgress("Error: " + e.message, 0);
    if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    res.end();
  }
});

ensureProjectsDir();
backup.ensureArchiveDir();
createDemoProject();
migrateAllProjects().then(() => {
  watchAllProjects();
});

// Sprawdzenie wersji Node.js (wymagana wersja 16+)
const MIN_NODE_VERSION = 16;
const currentNodeVersion = parseInt(process.version.slice(1).split('.')[0]);
if (currentNodeVersion < MIN_NODE_VERSION) {
  console.error(`Error: Node.js ${MIN_NODE_VERSION}.0.0 or higher is required.`);
  console.error(`Current version: ${process.version}`);
  console.error(`Please update Node.js from https://nodejs.org/`);
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`🟢 microRunner running at http://localhost:${PORT}`);
  console.log(`📁 Projects directory: ${PROJECTS_DIR}\n`);
});

function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.log('Forcing shutdown...');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
