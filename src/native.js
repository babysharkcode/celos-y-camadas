// Puente entre la app y el teléfono: almacenamiento, notificaciones, compartir archivos.
// En Android usa los plugins nativos de Capacitor; en navegador (iPhone/PWA) usa equivalentes web.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'
const KEY = 'celos-camadas.v1';

export async function loadDogs() {
  try {
    const raw = isNative ? (await Preferences.get({ key: KEY })).value : localStorage.getItem(KEY);
    const v = raw ? JSON.parse(raw) : [];
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

export async function saveDogs(dogs) {
  const raw = JSON.stringify(dogs);
  if (isNative) await Preferences.set({ key: KEY, value: raw });
  else localStorage.setItem(KEY, raw);
}

/** Guarda un archivo y lo comparte (Android) o lo descarga (navegador). */
export async function shareFile(filename, text, mime) {
  if (isNative) {
    const r = await Filesystem.writeFile({ path: filename, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: filename, files: [r.uri] });
    return;
  }
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------- notificaciones locales (solo app nativa) ---------- */
export const canNotify = isNative;
let channelReady = false;

export async function notifyPermission(ask) {
  if (!isNative) return 'unsupported';
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted' && ask) p = await LocalNotifications.requestPermissions();
  return p.display; // 'granted' | 'denied' | 'prompt'
}

async function ensureChannel() {
  if (channelReady || platform !== 'android') return;
  await LocalNotifications.createChannel({ id: 'celos', name: 'Celos, cruzas y partos', importance: 4, vibration: true });
  channelReady = true;
}

/** Reemplaza todas las notificaciones programadas por la lista recibida. items: {at: Date, title, body} */
export async function scheduleAll(items) {
  if (!isNative) return 0;
  if ((await notifyPermission(false)) !== 'granted') return 0;
  await ensureChannel();
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map(n => ({ id: n.id })) });
  const now = Date.now();
  const list = items.filter(i => i.at.getTime() > now).sort((a, b) => a.at - b.at).slice(0, 60);
  if (!list.length) return 0;
  await LocalNotifications.schedule({
    notifications: list.map((i, n) => ({
      id: n + 1, title: i.title, body: i.body, channelId: 'celos', smallIcon: 'ic_stat_paw',
      schedule: { at: i.at, allowWhileIdle: true },
    })),
  });
  return list.length;
}

export async function testNotification() {
  if (!isNative) return false;
  if ((await notifyPermission(true)) !== 'granted') return false;
  await ensureChannel();
  await LocalNotifications.schedule({ notifications: [{ id: 999, title: '🐾 Celos y Camadas', body: 'Así se verán tus avisos.', channelId: 'celos', smallIcon: 'ic_stat_paw', schedule: { at: new Date(Date.now() + 3000), allowWhileIdle: true } }] });
  return true;
}

export function onBack(handler) {
  if (isNative) App.addListener('backButton', () => { if (!handler()) App.exitApp(); });
}
