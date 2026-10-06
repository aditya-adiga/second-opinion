// Thin Electron wrapper: launches the existing Next.js dev server as a child process and
// opens a native window pointed at it. The app itself (UI, API route, claude CLI subprocess
// logic) is completely unchanged — this file only owns the window and the server's lifecycle.

const { app, BrowserWindow } = require("electron");
const { spawn } = require("node:child_process");
const path = require("node:path");
const http = require("node:http");

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;
const PROJECT_ROOT = path.join(__dirname, "..");

let serverProcess;
let mainWindow;

function waitForServer(url, timeoutMs = 30000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    function check() {
      http
        .get(url, (res) => {
          res.resume();
          resolve();
        })
        .on("error", () => {
          if (Date.now() - start > timeoutMs) {
            reject(new Error(`Timed out waiting for ${url}`));
            return;
          }
          setTimeout(check, 300);
        });
    }
    check();
  });
}

function startNextServer() {
  const nextBin = path.join(
    PROJECT_ROOT,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "next.cmd" : "next",
  );
  serverProcess = spawn(nextBin, ["dev"], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(PORT) },
    stdio: "inherit",
    // Detached on POSIX so we can kill the whole process group on quit — `next dev` (Turbopack)
    // spawns its own child workers that a plain kill of the parent pid can leave orphaned.
    detached: process.platform !== "win32",
  });
  serverProcess.on("exit", (code) => {
    if (code !== null && code !== 0) {
      console.error(`Next.js dev server exited with code ${code}`);
    }
  });
}

function stopNextServer() {
  if (!serverProcess) return;
  if (process.platform !== "win32") {
    try {
      process.kill(-serverProcess.pid);
    } catch {
      serverProcess.kill();
    }
  } else {
    serverProcess.kill();
  }
  serverProcess = undefined;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 560,
    title: "Second Opinion",
    backgroundColor: "#bfd9d2", // matches the app's own "desk" background token
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await waitForServer(SERVER_URL);
  } catch (err) {
    console.error("Next.js dev server never became ready:", err);
  }
  mainWindow.loadURL(SERVER_URL);

  mainWindow.on("closed", () => {
    mainWindow = undefined;
  });
}

app.whenReady().then(() => {
  startNextServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  stopNextServer();
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", stopNextServer);
app.on("will-quit", stopNextServer);
