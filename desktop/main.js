const { app, BrowserWindow, session, shell, globalShortcut } = require('electron');
const path = require('path');

// UA "Smart TV" : YouTube sert alors l'interface plein écran navigable au clavier/télécommande.
const TV_UA =
  'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) 85.0.4183.93/6.5 TV Safari/537.36';
const START_URL = 'https://www.youtube.com/tv';

// Domaines et chemins publicitaires bloqués.
const AD_PATTERNS = [
  '*://*.doubleclick.net/*',
  '*://googleads.g.doubleclick.net/*',
  '*://*.googlesyndication.com/*',
  '*://*.youtube.com/api/stats/ads*',
  '*://*.youtube.com/pagead/*',
  '*://*.youtube.com/get_midroll_info*',
  '*://*.youtube.com/ptracking*',
  '*://static.doubleclick.net/*'
];

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    backgroundColor: '#0f0f0f',
    autoHideMenuBar: true,
    title: 'SmartTube',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: false, // le préload injecte du code dans la page
      sandbox: false,
      nodeIntegration: false
    }
  });
  win.setMenu(null);
  win.webContents.setUserAgent(TV_UA);

  // Les liens externes s'ouvrent dans le navigateur par défaut.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(START_URL, { userAgent: TV_UA });
  return win;
}

app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: AD_PATTERNS }, (_d, cb) => cb({ cancel: true }));

  const win = createWindow();

  globalShortcut.register('F11', () => win.setFullScreen(!win.isFullScreen()));
  globalShortcut.register('F5', () => win.webContents.reload());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => app.quit());
