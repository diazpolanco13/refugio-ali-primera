# Vigilante Nexus (alertas Telegram)

En el VPS corre un timer systemd que consulta
`https://nexus.m0n1t0r-d3-3v3nt0s.net/health/nexus` cada **3 minutos**
y avisa por Telegram **solo cuando cambia el estado** (caída o reactivación).

Reutiliza el mismo bot que el vigilante SSH (`/opt/vigilante-ssh/config.env`).

| Pieza | Ruta |
|---|---|
| Script | `/opt/vigilante-nexus/vigilante-nexus.sh` |
| Estado | `/var/lib/vigilante-nexus/estado` |
| Timer | `vigilante-nexus.timer` (cada 3 min) |

```bash
# Estado / próxima ejecución
systemctl list-timers vigilante-nexus.timer
cat /var/lib/vigilante-nexus/estado

# Forzar comprobación (solo avisa si cambió)
sudo systemctl start vigilante-nexus.service

# Reenviar estado actual
sudo /opt/vigilante-nexus/vigilante-nexus.sh --init
```

No es un poll agresivo al API institucional: el gateway cachea `/health/nexus`
~120 s; el timer solo golpea nuestro dominio.
