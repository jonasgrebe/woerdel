# WÖRDEL

Ein eigenständiges deutsches Wortspiel mit drei Spielmodi, täglichen Rätseln und teilbaren Herausforderungen. Ohne Framework, Konto oder Backend. Die Wörterbuchprüfung läuft als lokal eingebundene WebAssembly-Komponente. Alle Schriften und Wörter liegen lokal.

## Lokal starten

Voraussetzung: Node.js 20 oder neuer. Im Projektordner:

```sh
npm run dev
```

Dann **http://127.0.0.1:4173** öffnen. Eine Paketinstallation ist nicht erforderlich. Mit `PORT=4180 npm run dev` lässt sich der Port ändern. Der Server bindet ausschließlich an die lokale Loopback-Adresse. Zum Beenden im Terminal `Ctrl+C` drücken.

Alternativ kann jeder statische HTTP-Server den Ordner `dist/` ausliefern. Die HTML-Datei wegen der JavaScript-Module bitte nicht per `file://` öffnen.

## Was drinsteckt

- **Tageswort:** standardmäßig sechs Buchstaben. Wechsel um Mitternacht in `Europe/Berlin`, inklusive Sommerzeit. Ein begonnenes Rätsel bleibt beim Tageswechsel erhalten.
- **Klassik:** ein Wort mit vier bis acht Buchstaben und einem bis 15 Versuchen.
- **Doppelpack:** zwei verschiedene Wörter mit gemeinsamen Eingaben, zwei bis 15 Versuchen, getrennten Hinweisen und geteilter Tastatur: links Wort 1, rechts Wort 2. Ein gelöstes Feld bleibt stehen.
- **Sprint:** ein Wort in 120 Sekunden. Start beim ersten Buchstaben. Neuladen, Dialoge oder Hintergrund-Tabs pausieren die Uhr nicht.
- **Knobelmodus:** Jeder neue Versuch muss zu sämtlichen bisherigen Hinweisen passen, einschließlich ausgeschlossener Buchstaben und mehrfacher Vorkommen. Nicht mit Doppelpack kombinierbar.
- **Eigene Wörter:** ein selbst gewähltes Wort oder zwei verschiedene, gleich lange Wörter im Doppelpack (4–8 Buchstaben). Auch Namen sind erlaubt. Die Zielwörter bleiben beim Öffnen der Einstellungen leer und werden nicht im Ergebnistext ausgeschrieben.
- **Seeds:** frei wählbar oder zufällig; Spiel-Links enthalten Version, Modus, Länge, Versuche, Knobelmodus und Seed.
- **Lösungsanzeige:** Das Zielwort wird ausschließlich nach einem gewonnenen Spiel eingeblendet, niemals nach Zeitablauf oder aufgebrauchten Versuchen.
- **Teilen:** spoilerfreie Emoji-Ergebnisse, WhatsApp-Link mit formatierten Rasterzeilen, Kopierfunktion mit manuellem Fallback und ein spoilerfreies PNG-Raster zum Teilen oder Speichern.
- **Anpassung:** Hell und Dunkel; optionale Spielklänge, Statussymbole und reduzierte Bewegung. Ausgeschlossene Tastaturbuchstaben erscheinen rot mit Durchstreichung und ×.
- **Fokus:** Das Grid steht im Mittelpunkt; die Konfiguration öffnet sich rechts und schließt nach dem Start automatisch.
- **Komfort:** physische und Bildschirmtastatur, mobile Ansicht, lokale Spielstände, Dialoge mit Fokusführung und deutsche Beschriftung.
- **Wörter:** 2.450 kuratierte Zielwörter; zusätzlich vollständige Rechtschreibprüfung mit Hunspell und 258.200 Wörterbucheinträgen sowie Beugungs- und Zusammensetzungsregeln. Ä, Ö, Ü und ẞ zählen jeweils als ein Buchstabe. Auch kleines ß wird korrekt behandelt.

Die klassische Tageswort-Reihe mit sechs Buchstaben hat 701 Wörter, die innerhalb eines Zyklus nicht wiederholt werden. Für andere Wortlängen und Modi gibt es eigene tägliche Reihen. Einstellungen für Versuche und Knobelmodus ändern die Regeln, nicht das gewählte Wort.

## Seeds bleiben stabil

Das Format lautet beispielsweise:

```text
1~classic~6~6~0~f~KAFFEEPAUSE
```

Die Reihenfolge ist fest: Version, Modus, Buchstaben, Versuche, Knobelmodus (0/1), Tageswort/frei (d/f), Seed. Der Link transportiert diesen Code URL-kodiert im Fragment `#spiel=...`.

**Wichtig für spätere Änderungen:** Veröffentlichte Zielwortlisten, ihre Reihenfolge, Mischverfahren und Hashfunktion für Version 1 unverändert erhalten. Bei Änderungen eine neue Version ergänzen und alte Links weiterhin mit ihrem bisherigen Algorithmus auswerten. Die zusätzliche Liste gültiger Versuche und die wählbare Versuchsanzahl können erweitert werden, ohne Ziele zu verschieben. Eigene Wörter verwenden Version 2 mit einem zusätzlichen Base64url-kodierten Zielwortfeld; diese Kodierung ist keine Verschlüsselung. Wortdaten und Methodik stehen in `WOERTER.md`.

## GitHub Pages

Website: **https://jonasgrebe.github.io/woerdel/** · Repository: **https://github.com/jonasgrebe/woerdel**

Der Ordner `dist/` ist die vollständige veröffentlichbare Website. Relative Dateipfade und Fragment-Links funktionieren unter der Repository-Unteradresse.

1. Den Inhalt dieses Projektordners einschließlich `.github/` in ein GitHub-Repository übernehmen.
2. Unter **Settings → Pages → Build and deployment** die Quelle **GitHub Actions** auswählen.
3. Auf `main` pushen oder den mitgelieferten Workflow manuell ausführen.

Der Workflow prüft die Spielregeln, lädt ausschließlich `dist/` hoch und veröffentlicht anschließend. Jeder Push auf `main` aktualisiert die Website automatisch. Grundlage: [offizielle GitHub-Pages-Dokumentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

**Lokale Links sind nur auf dem eigenen Rechner erreichbar.** Sobald die Website online ist, enthalten neu kopierte Spiel- und Ergebnislinks automatisch ihre öffentliche Adresse. Ältere lokale Links behalten die lokale Adresse; der Seed-Code ist dennoch identisch.

## Prüfen

```sh
npm test
npm run check
```

Zum erneuten Erstellen des Wörterbuch-Bundles: `npm ci` und `npm run build:lexicon`. Zum Spielen sind Installation und Build nicht erforderlich. Der vorgefertigte Stand liegt in `dist/`. Drittanbieter-Quellen und Lizenzen: `dist/licenses/NOTICE.txt`.

Die Tests prüfen deutsche Normalisierung, alle Wortlisten, Mehrfachbuchstaben, Sommerzeit/Tageswechsel, wiederholungsfreie Tagesreihen, Seed-Validierung, eindeutige Doppelpack-Ziele, Knobelmodus, Zeitgrenzen, Wiederherstellung und spoilerfreies Teilen unter Repository-Pfaden.

Zusätzlich wurden die Browser-Flows für Klassik, Doppelpack und Sprint, Ergebnisdialoge, Wordprüfung, lokale Wiederherstellung und mobile Darstellung überprüft. Der tatsächliche Versand in WhatsApp wurde nicht ausgelöst. Optionale WebMCP-Werkzeuge nutzen dieselben Spielaktionen und wurden im unterstützten Browser überprüft.

## Dateien

- `dist/index.html`: deutsche Oberfläche und Dialoge.
- `dist/style.css`: Themes, Layout und Animationen.
- `dist/app.js`: Bedienung, Ansichten, Speichern, Uhr und Teilen.
- `dist/engine.js`: reine Spiellogik, Seeds und Auswertung.
- `dist/words.js`: versionierte, eingefrorene Lösungswortlisten.
- `dist/sharing.js`: WhatsApp-Formatierung und PNG-Ergebniskarten.
- `dist/lexicon.js`, `dist/vendor/`, `dist/dictionary/`: lokale Hunspell-Wortprüfung.
- `dist/favicon.svg`: eigenes W-Symbol für den Browser-Tab.
- `dist/assets/fonts/`: lokale variable Schriften mit SIL-OFL-Lizenzen.
- `server.mjs`: kleiner lokaler Server ohne externe Pakete.
- `tests/engine.test.mjs`: automatisierte Regeln- und Zustandsprüfungen.
- `.github/workflows/pages.yml`: vorbereiteter Pages-Workflow.

## Daten und Grenzen

Einstellungen und Spielstände werden ausschließlich im Browser gespeichert. Es gibt keine Analyse, Werbedienste oder Konten. Geräte teilen keine Spielstände. Beim Öffnen des WhatsApp-Links werden Ergebnistext und Spiel-Link an WhatsApp übergeben; der Nutzer wählt dort den Empfänger.

Die Lösungen sind bewusst kuratiert. Die Ratewörter werden mit dem deutschen LibreOffice-Wörterbuch de_DE_frami geprüft. Auch dieses umfangreiche Wörterbuch ist nicht lückenlos und nicht Duden-zertifiziert. Ein abgelehntes Wort kann trotzdem korrektes Deutsch sein. Die statische App schützt die Lösung nicht gegen Einsicht in den Quellcode; gespielt wird auf Vertrauensbasis. Ein Wechsel der Geräteuhr kann den Sprint beeinflussen. Für manipulationssichere Ranglisten wäre später ein Server erforderlich.
