const { app, BrowserWindow, session, shell, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');

// Deux modes : site YouTube classique (menu latéral, abonnements, historique, commentaires)
// et interface "TV" (F2 pour basculer).
const CHROME_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const TV_UA =
  'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36';
const MODES = {
  desktop: { url: 'https://www.youtube.com/', ua: CHROME_UA },
  tv: { url: 'https://www.youtube.com/tv', ua: TV_UA }
};

const AD_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/get_midroll_info*',
  '*://*.youtube.com/ptracking*'
];

const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function loadState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (_) { return {}; }
}
function saveState(win, mode) {
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized(), mode }));
  } catch (_) {}
}

function createWindow() {
  const st = loadState();
  let mode = MODES[st.mode] ? st.mode : 'desktop';

  const win = new BrowserWindow({
    width: st.width || 1280,
    height: st.height || 720,
    x: st.x,
    y: st.y,
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    title: 'SmartTube',
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false,
      sandbox: false,
      nodeIntegration: false
    }
  });
  win.setMenu(null);
  if (st.maximized) win.maximize();

  const open = () => {
    win.webContents.setUserAgent(MODES[mode].ua);
    win.loadURL(MODES[mode].url, { userAgent: MODES[mode].ua });
  };

  // Garde le titre de la fenêtre propre.
  win.on('page-title-updated', (e) => e.preventDefault());

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/(www\.|m\.|music\.)?youtube\.com\//.test(url)) {
      win.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  win.on('close', () => saveState(win, mode));

  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  globalShortcut.register('F5', () => win.webContents.reload());
  globalShortcut.register('F2', () => {
    mode = mode === 'desktop' ? 'tv' : 'desktop';
    open();
  });
  globalShortcut.register('Alt+Left', () => win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack());

  open();
  return win;
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: AD_PATTERNS }, (_d, cb) => cb({ cancel: true }));
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
