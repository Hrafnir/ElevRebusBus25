# Demo-checklist

## Før Demo

```bash
npm run check
npm run dev
```

Åpne:

- http://localhost:3000/admin
- http://localhost:3000/student

## Lokal Demo Uten Supabase

1. Gå til admin.
2. Bruk dev-login.
3. Åpne demo-rebusen.
4. Lag en ny oppgave.
5. Opprett en gruppe.
6. Gå til elevsiden.
7. Logg inn med gruppens brukernavn og kode.
8. Lever et svar.

## Supabase-Demo

1. Sjekk at `.env` er satt lokalt.
2. Logg inn med Google på admin.
3. Velg eller opprett organisasjon.
4. Lag rebus.
5. Lag stopp/lokasjon.
6. Lag oppgaver.
7. Lag gruppe.
8. Test elevinnlogging.
9. Se live-status.

## Hvis Noe Ikke Virker

- Hard refresh i nettleseren.
- Sjekk at serveren kjører på port `3000`.
- Sjekk at `.env` ikke mangler Supabase-verdier hvis du tester Supabase-modus.
- For lokal demo: tøm eller slett `data/rebus-platform.json` for å starte på nytt.
