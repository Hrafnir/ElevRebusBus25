# Android Play Store-plan

Målet for første mobilversjon er en egen elevapp. Admin skal fortsatt brukes i nettleser.

## Teknisk oppsett

- Appnavn: `Rebus Elev`
- Android application id: `com.hrafnir.rebuselev`
- Web-kilde: `public/student`
- Pakket webmappe: `android-web`
- Native wrapper: Capacitor Android

## Kommandoer

```bash
npm install
npm run check
npm run android:sync
```

For å åpne i Android Studio:

```bash
npm run android:open
```

## Før Play Store

- Bytt standard appikon og splash til ferdig visuelt uttrykk.
- Test innlogging, GPS, kart, chat og filinnlevering på minst én fysisk Android-telefon.
- Lag signert release/AAB i Android Studio.
- Fyll ut Play Console Data safety: posisjon brukes for rebusprogresjon, og media kan lastes opp av elever.
- Legg inn personvernstekst før produksjonslansering, siden appen kan behandle elevdata, posisjon og media.
