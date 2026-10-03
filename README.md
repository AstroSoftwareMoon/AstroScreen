# AstroScreen

Graba tu pantalla y haz capturas con una interfaz espacial. Código abierto, para Linux, Windows y macOS. Creado por [AstroSoftware](https://github.com/AstroSoftwareMoon).

- Elige cualquier pantalla o ventana y mira la vista previa en directo.
- Capturas PNG (con copia al portapapeles) y vídeo WebM con pausa, micrófono y, en Windows, audio del sistema.
- Calidad y FPS ajustables, cuenta atrás y atajos globales: `Ctrl/Cmd+Mayús+R` graba y `Ctrl/Cmd+Mayús+S` captura.
- Guardado automático en `Imágenes/AstroScreen` y `Vídeos/AstroScreen`, con una biblioteca integrada.
- Botón de soporte que lleva a nuestro Discord: https://discord.gg/eBszxvAuhN

## Ejecutar en local

```bash
npm install
npm start
```

## Compilar con GitHub

1. Sube este proyecto a un repositorio de GitHub.
2. En la pestaña **Actions**, ejecuta el flujo **Build** a mano (*Run workflow*), o crea una etiqueta:
   ```bash
   git tag v1.0.0 && git push origin v1.0.0
   ```
3. Descarga los instaladores desde los artefactos del flujo. Con una etiqueta `v*` también se publican en **Releases**:
   `.AppImage` y `.deb` (Linux), `.exe` (Windows) y `.dmg` (macOS).

Para usar un icono propio, añade `build/icon.png` (512×512 o mayor).

## Permisos

- **macOS:** concede *Grabación de pantalla* a AstroScreen en Ajustes del Sistema > Privacidad y seguridad. Al ser una app sin firmar, la primera vez ábrela con clic derecho > Abrir.
- **Linux (Wayland):** el sistema mostrará su propio selector de pantalla.
- **Windows:** la primera vez puede aparecer el aviso de SmartScreen; elige *Más información > Ejecutar de todas formas*.

## Licencia

MIT
