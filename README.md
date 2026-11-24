# Celos y Camadas

App para llevar el control de celo, progesterona, cruzas, partos y pedigrí (FCM) de perros.

- **Android:** app nativa (Capacitor) con notificaciones locales. Se descarga el APK desde [Releases](../../releases).
- **iPhone:** app web instalable (PWA): abrir en Safari › Compartir › *Agregar a pantalla de inicio*.
- **Datos:** solo en cada teléfono. Usa *Más › Exportar respaldo* para guardarlos o pasarlos a otro equipo.

## Estructura

```
src/index.html        Interfaz y estilos
src/app.js            Lógica: ciclos, progesterona, gestación, pedigrí, vistas
src/native.js         Puente al teléfono: almacenamiento, notificaciones, compartir
public/               Manifiesto PWA, service worker e íconos web
scripts/build.mjs     Compila a www/ (esbuild) e inyecta la versión de package.json
android/              Proyecto nativo Android generado por Capacitor
assets/               Fuentes del ícono y splash
.github/workflows/    Compilación automática de APK y web
```

## Desarrollo

```bash
npm ci
npm run build          # genera www/
npx cap sync android   # copia www/ al proyecto Android
npx cap open android   # abrir en Android Studio (opcional)
```

## Publicar una versión nueva

1. Anota los cambios en `CHANGELOG.md` bajo un encabezado `## [X.Y.Z] - fecha`.
2. Sube la versión y crea el tag:
   ```bash
   npm version minor -m "v%s"   # o patch / major
   git push --follow-tags
   ```
3. GitHub Actions compila el APK firmado y crea el Release con las notas del CHANGELOG.
   Instala el APK encima de la versión anterior: los datos se conservan.

La firma usa los secretos del repo `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`
y `ANDROID_KEY_ALIAS`. **Guarda una copia del keystore fuera de GitHub**: sin él no se pueden
publicar actualizaciones que se instalen sobre la app existente.
