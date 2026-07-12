# Preview móvil en tiempo real

Ver la app en el teléfono mientras se edita, con recarga automática al guardar.

## Arrancar

```bash
cd ~/AIOS-code/cera
npx live-server --host=0.0.0.0 --port=5500 --no-browser
```

En el móvil (misma wifi): `http://<IP-del-Mac>:5500/` — la IP se obtiene con
`ipconfig getifaddr en0`. Cada guardado de fichero recarga la página sola
(live-server inyecta un websocket; no toca el repo).

QR rápido para no teclear la URL:

```bash
npx qrcode -o /tmp/cera-qr.png "http://$(ipconfig getifaddr en0):5500/" && open /tmp/cera-qr.png
```

## Notas

- Solo red local; nada expuesto a internet.
- `movil.html` sigue siendo el marco de teléfono para verlo desde el escritorio.
- El service worker cachea: si el móvil muestra versión vieja, recarga dos
  veces o borra datos del sitio. El CSS va versionado (`styles.css?v=N`) —
  subir N al cambiar estilos.
