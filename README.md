# Rebusgenerator

En tidlig, kjørbar prototype for å lage lærerstyrte rebuser med adminside, elevside, kart, gruppeinnlogging, oppgaver, progresjon og live-status.

## Rask Demo

Dette er den enkleste måten for kolleger å teste uten Supabase, Google-login eller API-nøkler.

```bash
git clone https://github.com/Hrafnir/Rebusgenerator.git
cd Rebusgenerator
npm install
npm run dev
```

Åpne:

- Admin: http://localhost:3000/admin
- Elev: http://localhost:3000/student

I lokal demo-modus kan du bruke:

- Admin dev-login: `teacher@example.com`
- Elev demo-login: brukernavn `demo`, passord `demo`

Appen lager automatisk lokal testdata i `data/rebus-platform.json`. Den fila er ignorert av Git.

## Kjør I GitHub Codespaces

1. Gå til repoet på GitHub.
2. Trykk `Code`.
3. Velg `Codespaces`.
4. Trykk `Create codespace on main`.
5. Når terminalen er klar:

```bash
npm install
npm run dev
```

Codespaces vil foreslå å åpne port `3000`. Bruk den lenken for å teste admin og elevside.

## Supabase-Modus

Lokal demo fungerer uten `.env`. For å teste med ekte backend:

```bash
cp .env.example .env
```

Fyll inn:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_MAPS_API_KEY=
```

Viktig:

- `SUPABASE_SERVICE_ROLE_KEY` skal aldri pushes til GitHub.
- `.env` er ignorert av Git.
- Google-login må også settes opp i Supabase Auth og Google Cloud for prosjektet.

Supabase-tabeller ligger i:

```text
supabase/migrations/
```

## Hva Kan Testes Nå?

- Logge inn på admin i lokal dev-modus.
- Lage organisasjon/rebus i Supabase-modus.
- Lage oppgaver med tekst, tall, multiple choice, media-lenker og hint.
- Lage grupper med automatisk brukernavn og kode.
- Endre kode for en gruppe etterpå.
- Logge inn på elevsiden.
- Levere svar og se progresjon.
- Sende posisjon fra elevens nettleser når geolokasjon tillates.

## Kjente Begrensninger

- Dette er en prototype, ikke produksjonsklar app.
- Gruppepassord lagres foreløpig enkelt i demo/backend-flyt.
- Filopplasting bør flyttes helt til Supabase Storage før ekte bruk.
- Elevkart og live-kart trenger mer polering.
- Invitasjon av kolleger til samme organisasjon mangler egen UI.

## Demo-Tips

Start med admin-siden. Lag en ny rebus, legg til et par oppgaver, opprett en gruppe, og åpne elevsiden i en annen fane. Bruk gruppens brukernavn og kode for å teste elevflyten.
