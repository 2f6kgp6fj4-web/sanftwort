# Sanftwort – Store-Einträge und Einrichtung

## App Store / Google Play – Texte (Deutsch)

**Name:** Sanftwort
**Untertitel (iOS, max. 30):** Sag es, ohne zu verletzen
**Kurzbeschreibung (Google, max. 80):** Wut rein, faire Worte raus: Nachrichten an Partner & Familie sanft formulieren.
**Werbetext (iOS, max. 170):** Sprich ungefiltert aus, was dich ärgert – Sanftwort macht daraus eine Nachricht, die ankommt. Oder lass dir erklären, was hinter einer verletzenden Nachricht steckt.
**Schlüsselwörter (iOS, max. 100):** Beziehung,Paar,Streit,Kommunikation,Nachricht,gewaltfreie,Partner,Ehe,Konflikt,WhatsApp,Antwort

**Beschreibung:**

Kennst du das? Du willst etwas ansprechen, aber in deinem Kopf klingt es nach Vorwurf. Oder eine Nachricht deines Partners trifft dich, und du willst sofort zurückschießen.

Sanftwort ist dein Alltagshelfer für Nachrichten, die ankommen statt verletzen.

ICH WILL WAS SAGEN
Sprich oder tipp ungefiltert, was dich beschäftigt. Sanftwort zeigt dir, was du fühlst, was du brauchst und worum du eigentlich bittest – und macht daraus drei sendefertige Versionen. Die Hitzeanzeige zeigt, wie deine Nachricht vorher und nachher ankommt.

ICH HAB WAS BEKOMMEN
Füg eine Nachricht ein oder teile sie direkt aus WhatsApp. Du siehst, worum es sachlich geht, was dahinterstecken könnte und was du nicht auf die Goldwaage legen musst – plus eine ruhige Antwort.

NACH BEWÄHRTEN MODELLEN
Sanftwort nutzt Gewaltfreie Kommunikation nach Marshall Rosenberg, die Paarforschung von John Gottman und die BIFF-Methode für schwierige Kontakte. Ohne Therapie-Sprech, in deinen Worten.

KLINGT NACH DIR
Füg ein paar eigene Nachrichten als Stilprobe ein. Und frag deinen Partner, wie er Kritik am liebsten hört – Sanftwort berücksichtigt es.

PRIVAT
Kein Konto. Deine Texte werden nicht gespeichert. Keine Werbung.

SANFTWORT PLUS
5 Nachrichten pro Woche sind gratis. Mit Plus formulierst du unbegrenzt – und mit der Familienfreigabe nutzt ihr ein Abo zu zweit.

Sanftwort ersetzt keine Paarberatung oder Therapie.

**Kategorie:** Lifestyle (Zweitkategorie: Produktivität)
**Altersfreigabe:** 12+ (gelegentlich Themen wie Streit; keine Inhalte für Erwachsene)
**Support-URL:** https://sanftwort.netlify.app
**Datenschutz-URL:** https://sanftwort.netlify.app/datenschutz.html

## App-Datenschutz (App Store Connect → App-Datenschutz)

- Nutzerinhalte → „Andere Nutzerinhalte“ (die eingegebenen Texte): erfasst, App-Funktionalität, nicht mit Identität verknüpft, kein Tracking.
- Kennungen → „Geräte-ID“ (zufällige Installations-ID): App-Funktionalität, nicht mit Identität verknüpft, kein Tracking.
- Käufe → „Kaufverlauf“ (über RevenueCat): App-Funktionalität, nicht mit Identität verknüpft, kein Tracking.
- Audio: nicht erfasst (Spracherkennung des Systems, wir erhalten nur Text).

## In-App-Käufe (App Store Connect → Abonnements)

Abo-Gruppe: **Sanftwort Plus**

| Produkt-ID | Dauer | Preis | Einführungsangebot | Familienfreigabe |
| --- | --- | --- | --- | --- |
| de.sanftwort.plus.yearly | 1 Jahr | 29,99 € | 1 Woche gratis | an |
| de.sanftwort.plus.monthly | 1 Monat | 4,99 € | – | an |

RevenueCat: Entitlement `plus`, Offering `default` mit Paketen `$rc_annual` und `$rc_monthly`.

## Umgebungsvariablen

App (EAS → Project → Environment variables, Umgebung „production“, Sichtbarkeit „Plain text“):
- `EXPO_PUBLIC_RC_IOS_KEY` = öffentlicher RevenueCat-Schlüssel für iOS (`appl_…`)
- `EXPO_PUBLIC_RC_ANDROID_KEY` = öffentlicher RevenueCat-Schlüssel für Android (`goog_…`)

Server (Netlify → Project configuration → Environment variables):
- `REVENUECAT_SECRET` = geheimer RevenueCat-Schlüssel (`sk_…`), Scope „Functions“

## Builds

- Jeder Push auf `main` mit Änderungen in `mobile/` prüft die App und baut eine Android-Testversion (GitHub → Actions → Artefakt `sanftwort-android-test`).
- iPhone: einmalig lokal `cd mobile && npx eas-cli@latest build -p ios --profile production` (richtet Zertifikate ein), danach per GitHub → Actions → „iPhone-Build …“ → Run workflow.
