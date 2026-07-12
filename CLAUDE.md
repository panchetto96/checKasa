# CheckCasa

App Expo/React Native (solo Android) per documentare fotograficamente lo stato di un immobile in affitto al check-in/check-out. Nessun server, nessun account: dati locali su SQLite + file system, stesso principio del progetto sorella `../quiete-app`. Codice in `app/`.

## Design Context

Contesto strategico completo in [PRODUCT.md](PRODUCT.md) (registro, utenti, principi di design). Riassunto:

- **Registro:** prodotto (non brand/marketing) — il design serve il compito, non è una vetrina.
- **Piattaforma:** solo Android — segue Material 3.
- **Personalità:** rassicurante e metodica. Evitare stile "software aziendale freddo".
- **Principi guida:** flusso guidato non a menu libero, ogni azione conferma cosa è stato salvato, mai cancellazioni silenziose, label sempre visibili accanto alle icone, serio ma non freddo.

`DESIGN.md` non ancora generato — la palette attuale in `app/src/theme/colors.ts` è dichiarata placeholder nel codice, da rivedere con una passata di design dedicata (candidato: `/impeccable colorize`) prima del lancio pubblico.

## Piani di implementazione

- Piano 1/3 (Fondamenta): `docs/superpowers/plans/2026-07-12-checkcasa-fondamenta.md` — completo.
- Piano 2/3 (Sessione di documentazione): `docs/superpowers/plans/2026-07-12-checkcasa-sessione.md` — completo.
- Piano 3/3 (PDF + firma): non ancora scritto.

Spec di design MVP: `docs/superpowers/specs/2026-07-12-checkcasa-mvp-design.md`. Ricerca di mercato: `ricerca-di-mercato.md`.
