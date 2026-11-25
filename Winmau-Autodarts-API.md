# Winmau Autodarts – API-Dokumentation (inoffiziell, mit Quellen)

> **Stand:** 25.11.2026 · **Erstellt aus:** dem öffentlich ausgelieferten Code der offiziellen Web-App `play.autodarts.com`, dem offiziellen OIDC-Discovery-Dokument, eigenen Tests ohne Login (nur Statuscodes), echten Aufzeichnungen eines Board Managers 2.1.0 und quelloffenem Community-Code.
> **Wichtig:** Es gibt **keine offizielle, öffentliche API-Dokumentation** und **keinen offiziellen Support** für Drittanbieter. Alles hier ist beobachtet und belegt, aber nicht vertraglich garantiert. Siehe [Kapitel 0](#0-status-rechtliches-und-wie-diese-doku-entstanden-ist).

---

## Inhaltsverzeichnis

0. [Status, Rechtliches und wie diese Doku entstanden ist](#0-status-rechtliches-und-wie-diese-doku-entstanden-ist)
1. [Überblick: Winmau, Autodarts und die Architektur](#1-überblick-winmau-autodarts-und-die-architektur)
2. [Hosts und Basis-URLs](#2-hosts-und-basis-urls)
3. [Allgemeine Konventionen (Header, Fehler, Retry)](#3-allgemeine-konventionen-header-fehler-retry)
4. [Authentifizierung – Auth-Service `/auth/v1`](#4-authentifizierung--auth-service-authv1)
5. [Game Service `gs/v0` – Lobbys, Matches, Matchmaking](#5-game-service-gsv0--lobbys-matches-matchmaking)
6. [Board Service `bs/v0` – Boards (Cloud)](#6-board-service-bsv0--boards-cloud)
7. [Account/Stats Service `as/v0`](#7-accountstats-service-asv0)
8. [User Services `us/v0` und `user/v1`](#8-user-services-usv0-und-userv1)
9. [Tournament Service `ts/v0`](#9-tournament-service-tsv0)
10. [Messaging `ms/v0` – Tickets, Chat und WebSocket](#10-messaging-msv0--tickets-chat-und-websocket)
11. [Weitere Services (ds, subscriptions, consent, status, faq, streams, admin, auth/v0)](#11-weitere-services)
12. [Externe Hilfsdienste (discover, releases, boards.ws, autodarts.direct)](#12-externe-hilfsdienste)
13. [Lokale Board-Manager-API (Port 3180)](#13-lokale-board-manager-api-port-3180)
14. [Datenmodelle und Enums](#14-datenmodelle-und-enums)
15. [Beispiele (curl, Python, JavaScript)](#15-beispiele)
16. [Historie und Breaking Changes](#16-historie-und-breaking-changes)
17. [Offene Punkte und Unsicherheiten](#17-offene-punkte-und-unsicherheiten)
18. [Quellenverzeichnis](#18-quellenverzeichnis)

---

## 0. Status, Rechtliches und wie diese Doku entstanden ist

### 0.1 Offizieller Status

| Aussage | Beleg |
|---|---|
| Für `api.autodarts.com` gibt es keine öffentliche OpenAPI/Swagger-Spezifikation. | [Q15], [Q22] |
| Die Nutzer-Doku `docs.autodarts.com` richtet sich an Spieler und enthält keinen API-/Entwicklerteil. | [Q22] |
| Autodarts hat am 21.10.2026 einem Entwickler geantwortet: **keine `client_id`s für externe Auth-Flows oder Cloud-Schnittstellen**, **kein Support für irgendeine seiner Schnittstellen**. Der frühere Migrations-Leitfaden für Dritte galt nur für bestehende Projekte, die vom alten Keycloak-Login weg mussten. Für eigene Integrationen sei **lokaler Betrieb** (Board Manager) der richtige Weg. | [Q16-d] (Entscheidung 0025 von *Autodarts for Home Assistant*) |
| Der Leitfaden für die Keycloak-Migration stammte von einem Autodarts-Mitarbeiter und wurde über den Autodarts-Discord verteilt (nicht öffentlich verlinkbar). | [Q16-c] |

**Konsequenz für dich:**
- Die **lokale Board-Manager-API** (Kapitel 13) ist der von Autodarts selbst empfohlene, robusteste Weg (kein Login, kein Token).
- Die **Cloud-API** (Kapitel 4–12) funktioniert technisch mit deinem eigenen Account, ist aber inoffiziell, kann sich jederzeit ändern und wird nicht unterstützt. Nutze nur deinen eigenen Account, sende moderat viele Requests und speichere Tokens sicher.

### 0.2 Beleg-Kennzeichnung

Jeder Endpunkt hat eine Spalte **Beleg**:

| Kürzel | Bedeutung |
|---|---|
| **B** | Im Code der **offiziellen Web-App** `play.autodarts.com` gefunden (Client-Bibliothek `clients-wU0NewE_.js`, Auth-Modul `src-BXZV2BBH.js`, Stand 25.11.2026) [Q7]. Stärkster Beleg für Cloud-Routen. |
| **A** | Im Code der **offiziellen Auth-Oberfläche** `auth.autodarts.io` gefunden [Q8]. |
| **O** | Offizielle Quelle (Discovery-Dokument, Autodarts-Doku, Winmau-Seiten). |
| **L** | **Live geprüft** am 25.11.2026: Anfrage **ohne Login** gesendet, die Route antwortet mit 401/400/200 statt 404 → Route existiert [Q9]. Es wurden keine Daten verändert. |
| **R** | **Echte Aufzeichnung** eines realen Geräts (Board Manager 2.1.0) [Q16-f]. |
| **C** | Nur in **Community-Code** gesehen (GitHub-Projekte) [Q11–Q20]. |

Die Quellen `[Q…]` stehen in [Kapitel 18](#18-quellenverzeichnis).

---

## 1. Überblick: Winmau, Autodarts und die Architektur

### 1.1 Wer steckt dahinter?

- **Autodarts** war ursprünglich ein eigenständiges Projekt (kamerabasiertes Auto-Scoring für Steeldarts). Winmau hat Autodarts laut Winmau-CEO etwa ein Jahr vor der IFA 2026 von den Entwicklern **gekauft** und weiterentwickelt [Q2]. Winmau gehört zur Nodor-Gruppe [Q5].
- Auf der **IFA Berlin 2026** (Artikel vom 04.09.2026) hat Winmau das **„Autodarts-Ökosystem“** vorgestellt [Q1]:
  - **Winmau Autodarts App** (kostenlos; Web, iOS, Android) – manuelles Scoring, Statistiken, Online-Spiel [Q1][Q4]
  - **LENS** – Auto-Scoring mit der Handykamera [Q1][Q4]
  - **Autodarts X** – Kamera-Rig mit 4 HD-Kameras, das auf jedes Board geklemmt wird [Q1][Q2][Q3]
  - **Autodarts Plus** – Abo (laut Launch-Artikel £5,99/Monat) mit u. a. unbegrenztem LENS und **AI Referee** [Q1][Q3]
  - Kompatible Hardware: **Vantage**, **Autodarts X** und **DIY-Setups** [Q1]
- Die Winmau-Produktseiten erwähnen **keine API** und keine Entwicklerschnittstellen [Q1][Q4].

### 1.2 Architektur auf einen Blick

```
┌──────────────────────────┐        HTTPS/REST + WSS           ┌───────────────────────────────┐
│  Clients                 │ ───────────────────────────────▶ │  Autodarts Cloud              │
│  - play.autodarts.com    │                                   │  api.autodarts.com            │
│  - iOS/Android-App       │                                   │   /auth/v1  (Login, OAuth)    │
│  - Autodarts Desktop     │                                   │   /gs/v0    (Game)            │
│  - eigene Skripte        │                                   │   /bs/v0    (Boards)          │
└──────────┬───────────────┘                                   │   /as/v0, /us/v0, /user/v1 …  │
           │                                                   │  play.ws.autodarts.com/ms/v0  │
           │ HTTP + WS (LAN, ohne Login)                       │   (WebSocket-Broker)          │
           ▼                                                   └───────────────▲───────────────┘
┌──────────────────────────┐   Board-ID + Board-API-Key (ausgehend)            │
│  Board-PC                │ ──────────────────────────────────────────────────┘
│  Board Manager / Desktop │
│  / Headless  :3180       │  ◀── Kameras (Vantage, DIY, Autodarts X?)
└──────────────────────────┘
```

- Der **Board-PC** (Board Manager 1.x, Autodarts Desktop 2.x oder Headless 2.x) erkennt die Darts und meldet sich mit **Board-ID** und **Board-API-Key** bei der Cloud an [Q21-a][Q21-c].
- Er bietet zusätzlich eine **lokale HTTP/WebSocket-API auf Port 3180** ohne Login [Q21-a][Q16-a].
- Die Web-App spricht mit der Cloud; wenn sie im selben Netz ist, spricht sie für einige Board-Befehle **direkt per TLS** mit dem Board (`*.autodarts.direct`, Kapitel 12.4) [Q7].

---

## 2. Hosts und Basis-URLs

Alle Werte stammen aus den Konstanten der offiziellen Web-App [Q7] und wurden, wo angegeben, live geprüft [Q9].

| Basis-URL | Dienst | Beleg |
|---|---|---|
| `https://api.autodarts.com/auth/v1` | Auth-Service (Login, Token, OAuth, Account) | B, A, O, L |
| `https://api.autodarts.com/auth/v0` | Feature-Flags/Permissions | B, L |
| `https://api.autodarts.com/gs/v0` | **Game Service** (Lobbys, Matches, Matchmaking) | B, L |
| `https://api.autodarts.com/bs/v0` | **Board Service** | B, L |
| `https://api.autodarts.com/as/v0` | Account/Stats (Matchhistorie, Freunde, Notifications, Seasons) | B, L |
| `https://api.autodarts.com/us/v0` | User Service (Profil, Settings, Stats) | B, L |
| `https://api.autodarts.com/user/v1` | Neuer User Service (Profil, Avatar, Blockieren) | B, L |
| `https://api.autodarts.com/ts/v0` | Tournament Service | B, L |
| `https://play.ws.autodarts.com/ms/v0` | **Message Broker** (Tickets, Chat, WebSocket `/subscribe`) | B, L |
| `https://api.autodarts.com/ms/v0` | Älterer Host des Message Brokers (antwortet noch) | C, L |
| `https://api.autodarts.com/ds/v0` | Detection-Daten zu einzelnen Würfen | B |
| `https://api.autodarts.com/subscriptions/v0` | Abos (Stripe, Paddle, Apple, Google) | B |
| `https://api.autodarts.com/consent/v0` | AGB/Datenschutz-Zustimmung | B, L |
| `https://api.autodarts.com/status/v0` | Wartungsstatus | B, L |
| `https://api.autodarts.com/faq/v0` | FAQ-Inhalte | B, L |
| `https://api.autodarts.com/streams/v0` | WebRTC-Signalisierung (SDP) | B |
| `https://api.autodarts.com/admin/v0` | Admin (Wartungsmodus setzen) | B, L |
| `https://discover.autodarts.com` | Board-Suche im eigenen Netz (öffentliche IP) | B, C, L |
| `https://boards.ws.autodarts.com` | Auslieferung von Kamerabildern | B, C |
| `https://releases.autodarts.com` | Release-Manifeste (Desktop/Headless) | B, L |
| `https://auth.autodarts.io` | Login-/Device-Link-Oberfläche (`/link`) | A, C, L |
| `https://login.autodarts.io` | **Alt:** Keycloak (Realm `autodarts`), am 28.06.2026 abgeschaltet; am 25.11.2026 Timeout | C, L |
| `https://api.autodarts.io` | **Alt:** frühere API-Domain; antwortet weiterhin (z. B. 401 auf `/gs/v0/lobbies`) | C, L |
| `https://play.autodarts.io` | **Alt:** leitet per 301 auf `https://play.autodarts.com/` um | L |

> **Domainwechsel:** Die Community-Tools sind von `*.autodarts.io` auf `*.autodarts.com` umgezogen (z. B. Tools for Autodarts: alle API-Calls jetzt an `api.autodarts.com`, Bilder an `boards.ws.autodarts.com`) [Q11-g]. Nutze **`.com`**.

---

## 3. Allgemeine Konventionen (Header, Fehler, Retry)

### 3.1 Authentifizierung pro Request
- Header: `Authorization: Bearer <access_token>` [Q7 (Interceptor im Auth-Modul)][Q11-a][Q12].
- Die Web-App holt vor **jedem** Request bei Bedarf ein neues Token (Refresh, wenn weniger als 30 s Restlaufzeit) [Q7].
- Bei **401** versucht die Web-App genau **einen** Refresh und wiederholt den Request; schlägt das fehl, gilt die Sitzung als abgelaufen [Q7].
- Bei **403** mit Fehlercode `consent_required` lädt die Web-App neu (Nutzer muss neue Bedingungen akzeptieren) [Q7].

### 3.2 Fehlerformat
Die meisten Services antworten so (live gesehen [Q9], aufgezeichnet in [Q17-b]):
```json
{ "statusCode": 401, "error": { "status": 401, "code": "unauthorized", "message": "unauthorized" } }
```
Manchmal kommt zusätzlich eine `traceId` mit [Q9][Q17-b].

Die **Device-Endpunkte** des Auth-Service nutzen dagegen das flache OAuth-Format (RFC 6749/8628) [Q9]:
```json
{ "error": "invalid_request", "error_description": "client_id is required" }
```

### 3.3 Bekannte Fehlercodes

| Code | Wo | Bedeutung | Beleg |
|---|---|---|---|
| `unauthorized` | alle | kein/ungültiges Token | L |
| `invalid_request` | auth | Feld fehlt / Body kein JSON | L, [Q17-b] |
| `invalid_token` | `/auth/v1/refresh` | Refresh-Token unbekannt, verbraucht oder abgelaufen (401) | [Q17-b] |
| `invalid_credentials` | `/auth/v1/login` | falscher Nutzername/Passwort (401) | [Q17-b] |
| `unsupported_grant_type` | `/auth/v1/token`, `/auth/v1/device/token` | falscher `grant_type` | L |
| `authorization_pending`, `slow_down`, `access_denied`, `expired_token` | `/auth/v1/device/token` | Standard-Device-Flow-Antworten (RFC 8628) | [Q16-e] |
| `consent_required` | alle (403) | neue AGB müssen akzeptiert werden | B |
| `stats_unavailable`, `stats_pending` | Stats-Endpunkte | Statistik (noch) nicht verfügbar → erneut versuchen | B |

### 3.4 Retry-Verhalten der Web-App
- Als vorübergehend gelten **502, 503, 504** sowie die Codes `stats_unavailable`/`stats_pending` [Q7].
- Der Header **`Retry-After`** (Sekunden) wird ausgewertet [Q7].
- Netzwerkfehler (`ERR_NETWORK`, `ECONNABORTED`, `ETIMEDOUT`) werden als Offline-Zustand behandelt [Q7].
- Offizielle Rate-Limits sind **nicht dokumentiert**. Community-Code behandelt **429** als „Dienst nicht verfügbar“ [Q16-e].

---

## 4. Authentifizierung – Auth-Service `/auth/v1`

### 4.1 OIDC-Discovery (offiziell, live abgerufen)

`GET https://api.autodarts.com/.well-known/openid-configuration` → (Antwort am 25.11.2026, unverändert) [Q6]

```json
{
  "issuer": "https://api.autodarts.com/auth",
  "authorization_endpoint": "https://api.autodarts.com/auth/v1/oauth/authorize",
  "token_endpoint": "https://api.autodarts.com/auth/v1/exchange",
  "device_authorization_endpoint": "https://api.autodarts.com/auth/v1/device/code",
  "scopes_supported": ["openid", "profile", "email"],
  "providers_supported": ["google", "apple"],
  "jwks_uri": "https://api.autodarts.com/auth/.well-known/jwks.json",
  "userinfo_endpoint": "https://api.autodarts.com/auth/v1/userinfo",
  "revocation_endpoint": "https://api.autodarts.com/auth/v1/logout",
  "grant_types_supported": ["authorization_code", "client_credentials",
    "urn:ietf:params:oauth:grant-type:device_code", "password", "otp", "refresh_token"],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "token_endpoint_auth_methods_supported": ["none", "client_secret_post"],
  "code_challenge_methods_supported": ["S256"]
}
```
Hinweis: Die gleiche Antwort kommt auch unter `api.autodarts.io` (Issuer zeigt auf `.com`) [Q6]. Der angegebene `jwks_uri` lieferte am 25.11.2026 **404** [Q9].

### 4.2 Bekannte `client_id`s

| client_id | Wer nutzt sie | Beleg |
|---|---|---|
| `autodarts-play` | offizielle Web-App `play.autodarts.com` (Login, Refresh, Exchange, OTP, Apple) | B, [Q17-a] |
| `auth-ui` | offizielle Login-Oberfläche `auth.autodarts.io` | A |
| `autodarts-app` | **Alt (Keycloak):** ESP32-Client mit `grant_type=password` | [Q14-a] |
| eigene IDs | werden laut Autodarts **nicht an Dritte vergeben** | [Q16-d] |

### 4.3 Token-Eigenschaften
- **Access-Token:** JWT, **ca. 15 Minuten** gültig (`expires_in` ≈ 900) [Q11-a][Q16-c][Q16-e].
- **Refresh-Token:** ca. **30 Tage** gültig und **rotierend** – jeder Refresh liefert ein neues und macht das alte ungültig [Q16-c][Q17-a].
- Die Web-App speichert das Refresh-Token in `localStorage` unter dem Schlüssel **`autodarts_refresh_token`** [Q7][Q17-a].
- JWT-Claims, die die Web-App ausliest: `sub` (User-ID), `preferred_username`, `email` [Q7]; `name`, `picture` werden von Community-Code gelesen [Q17-a].
- Typische Token-Antwort (Felder): `access_token`, `refresh_token`, `expires_in` [Q7][Q16-e].

### 4.4 Alle Endpunkte des Auth-Service

Alle `POST`-Bodies sind JSON (`Content-Type: application/json`).

| Methode | Pfad | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| POST | `/auth/v1/login` | `{username, password, client_id}` (Auth-UI sendet zusätzlich `email`) | Login mit Passwort → Token | B, A, L |
| POST | `/auth/v1/login/otp` | `{email, client_id}` | Einmalcode per Mail anfordern | B |
| POST | `/auth/v1/login/otp/verify` | `{email, code, client_id}` | Einmalcode einlösen → Token | B |
| POST | `/auth/v1/register` | `{…Registrierungsdaten, client_id}` | Konto anlegen | B, A |
| POST | `/auth/v1/register/resend` | `{email, client_id}` | Bestätigungsmail erneut senden | B |
| POST | `/auth/v1/register/verify` | `{email, code}` | Registrierung bestätigen | B, A |
| POST | `/auth/v1/forgot-password` | `{email}` | Passwort-Reset anfordern | B, A |
| POST | `/auth/v1/forgot-password/verify` | `{email, code, newPassword}` | neues Passwort setzen | B, A |
| POST | `/auth/v1/exchange` | `{code, client_id, redirect_uri}` | Auth-Code → Token (offizieller `token_endpoint`) | B, A, O, L |
| POST | `/auth/v1/refresh` | `{refresh_token, client_id}` | Token erneuern (rotierend) | B, A, L |
| POST | `/auth/v1/logout` | `{refresh_token}` | Sitzung beenden (offizieller `revocation_endpoint`); unbekanntes Token → 200 `{"success":true}` | B, A, O, L, [Q17-b] |
| POST | `/auth/v1/token` | `grant_type=client_credentials` | **nur** Client-Credentials (Fehlermeldung live: „only grant_type=client_credentials is supported on this endpoint“) | C, L |
| POST | `/auth/v1/device/code` | `{client_id}` | Device-Flow starten → `device_code`, `user_code`, `verification_uri(_complete)`, `expires_in`, `interval` | O, L, [Q16-e] |
| POST | `/auth/v1/device/token` | `{grant_type:"urn:ietf:params:oauth:grant-type:device_code", device_code, client_id}` | Device-Flow pollen | C, L, [Q16-e] |
| GET | `/auth/v1/device/info?user_code=…` | – (Login nötig) | Auth-UI: zeigt Client-Name und Scopes zum Code | A |
| POST | `/auth/v1/device/approve` | `{user_code, approved}` | Auth-UI: Gerät bestätigen/ablehnen | A |
| GET | `/auth/v1/oauth/authorize` | OAuth-Parameter (Code + PKCE S256) | Authorization-Endpunkt | O |
| GET | `/auth/v1/oauth/authorize/info?request_id=…` | – | Auth-UI: Infos zur Zustimmungsanfrage | A |
| POST | `/auth/v1/oauth/authorize/consent` | `{request_id, approved}` | Auth-UI: Zustimmung erteilen | A |
| GET | `/auth/v1/providers/{google\|apple}/authorize?client_id=…&redirect_uri=…` | – | Social Login starten; Redirect-Standard: `{origin}/auth/{provider}/callback` | B |
| POST | `/auth/v1/providers/apple/native` | `{authorization_code, bundle_id, given_name?, family_name?, client_id}` | Apple-Login in nativen Apps | B |
| GET | `/auth/v1/userinfo` | – | OIDC-Userinfo | O, L |
| GET | `/auth/v1/account/me` | – | eigenes Konto | B |
| PUT | `/auth/v1/account/profile` | Profilobjekt | Konto-Profil ändern | B |
| PUT | `/auth/v1/account/password` | `{currentPassword, newPassword}` | Passwort ändern | B |
| POST | `/auth/v1/account/email` | `{newEmail, password}` | E-Mail-Änderung anfordern | B |
| POST | `/auth/v1/account/email/verify` | `{code}` | E-Mail-Änderung bestätigen | B |
| GET | `/auth/v1/account/identities` | – | verknüpfte Identitäten (Google/Apple) | B |
| GET | `/auth/v1/account/sessions` | – | aktive Sitzungen (inkl. `client_id`, User-Agent) | B, A |
| DELETE | `/auth/v1/account/sessions/{sessionId}` | – | eine Sitzung beenden | B |
| DELETE | `/auth/v1/account/sessions` | – | alle Sitzungen beenden | B |

**Scopes** (wie die Auth-UI sie beschreibt): `openid` (Identität bestätigen), `profile` (Benutzername und Avatar), `email` (E-Mail nur lesend) [Q8].

### 4.5 Flows

#### a) Device Authorization Grant (RFC 8628) – für Geräte ohne Browser
1. `POST /auth/v1/device/code` mit `{"client_id": "<id>"}` → `device_code`, `user_code`, `verification_uri`, `verification_uri_complete`, `expires_in`, `interval` (Community-Code nimmt 600 s bzw. 5 s an, falls die Felder fehlen) [Q16-e].
2. Nutzer öffnet **`https://auth.autodarts.io/link`**, loggt sich ein und gibt den **8-stelligen Code** ein [Q13][Q8].
3. Client pollt `POST /auth/v1/device/token` im Abstand `interval`; bei `slow_down` +5 s; bei `authorization_pending` weiter warten [Q16-e].
4. Erfolg → `access_token`, `refresh_token`, `expires_in`.
> ⚠️ Erfordert eine `client_id`, für die Autodarts den Device-Grant freigeschaltet hat – **wird an Dritte nicht vergeben** [Q16-d]. darts-caller (lbormann) nutzt einen solchen „Device-Link“ als bestehendes Projekt [Q13].

#### b) Authorization Code + PKCE (S256) – Web-Apps
- Authorize: `/auth/v1/oauth/authorize`, Exchange: `POST /auth/v1/exchange` `{code, client_id, redirect_uri}` [Q6][Q7]. Benötigt registrierte Redirect-URI [Q16-c].

#### c) Passwort-Login (so macht es die Web-App)
- `POST /auth/v1/login` `{"username": "...", "password": "...", "client_id": "autodarts-play"}` [Q7].
- Funktioniert **nicht** für Konten, die sich nur mit Google/Apple anmelden (die haben kein Autodarts-Passwort) [Q17-c].
- Community-Tools (z. B. *Player Switch for Autodarts*) nutzen genau diese Endpunkte mit `autodarts-play` [Q17-a] – inoffiziell und ohne Support.

#### d) Refresh
- `POST /auth/v1/refresh` `{"refresh_token": "...", "client_id": "autodarts-play"}` → neues Token-Paar. **Neues Refresh-Token sofort speichern**, das alte ist danach ungültig [Q16-c][Q17-a].
- Empfehlung aus dem Autodarts-Leitfaden (zitiert von [Q16-c]): Access-Token ca. **60 s vor Ablauf** erneuern.

### 4.6 Alt: Keycloak (bis 28.06.2026)
- Token-Endpunkt: `https://login.autodarts.io/realms/autodarts/protocol/openid-connect/token` [Q11-a][Q12-b]
- Body (form-encoded): `client_id=autodarts-app&scope=openid&grant_type=password&username=…&password=…` [Q14-a]
- Autodarts hat Keycloak zum **28.06.2026** abgeschaltet; `grant_type=password` über Keycloak geht nicht mehr [Q11-a]. Am 25.11.2026 antwortete `login.autodarts.io` nicht mehr (Timeout) [Q9].

---

## 5. Game Service `gs/v0` – Lobbys, Matches, Matchmaking

Basis: `https://api.autodarts.com/gs/v0` · Auth: Bearer · Quelle: Web-App-Client `GameServerClient`, Klassen `Lobby` und `Match` [Q7].

### 5.1 Übersicht / Sammelrouten

| Methode | Pfad | Body | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/matches` | – | laufende Matches (Liste) | B, L |
| GET | `/matches/count` | – | Anzahl laufender Matches → `{count}` | B |
| GET | `/lobbies` | – | offene Lobbys (Liste) | B, L |
| POST | `/lobbies` | Lobby-Einstellungen (s. 5.2) | Lobby anlegen | B, C |
| POST | `/lobbies/from-match/{matchId}` | – | Rematch: Lobby aus Match erzeugen | B |
| GET | `/lobbies/{lobbyId}` | – | Lobby lesen (404 → existiert nicht) | B, C |
| PUT | `/lobbies/{lobbyId}/settings` | `{variant, settings, sets, legs, bullOffMode, hasReferee, …}` | Lobby-Einstellungen ändern (z. B. öffentlich machen) | B |
| GET | `/users/me/lens-quota` | – | verbleibendes LENS-Kontingent | B |
| GET | `/users/me/lens-usage` | – | LENS-Nutzung (Liste) | B |
| GET | `/matches/{matchId}/viewers` | – | Zuschauerzahl → `{count}` | B |
| GET | `/matches/{matchId}/players/{playerIndex}/image` | – | Bild des letzten Wurfs (JPEG, binär) | B |
| GET | `/matches/{matchId}/players/{playerIndex}/last-turn` | – | letzte Aufnahme eines Spielers | B |
| POST | `/matches/{matchId}/corrections` | s. 5.4 | Korrektur-Modus/Korrektur senden | B, C |
| POST | `/matches/{matchId}/live-streaming/token` | `{role}` (Standard `"consumer"`) | Token für Video-Livestream | B |

### 5.2 Lobby anlegen – Payload
Beispiel aus der Praxis (Turnier-Tool ATA) [Q15]:
```json
{
  "variant": "X01",
  "isPrivate": true,
  "bullOffMode": "Normal",
  "legs": 3,
  "settings": { "baseScore": 501, "inMode": "Straight", "outMode": "Double", "maxRounds": 50, "bullMode": "25/50" }
}
```
- Ohne `legs`/`sets` → Matchmodus „Off“ (freie Legs) [Q15].
- Gültige Werte siehe Enums in [Kapitel 14](#14-datenmodelle-und-enums).

### 5.3 Lobby-Objekt (`/gs/v0/lobbies/{lobbyId}/…`)

| Methode | Pfad (relativ zur Lobby) | Body | Zweck | Beleg |
|---|---|---|---|---|
| GET | `` (leer) | – | Lobby-Daten | B, C |
| DELETE | `` (leer) | – | Lobby löschen | B, C |
| POST | `/start` | – | Lobby starten → Match entsteht | B, C |
| POST | `/start/tournament` | – | Turnier-Match starten | B |
| POST | `/players` | s. u. | Spieler hinzufügen | B, C |
| POST | `/players/with-host/{hostId}` | Spielerobjekt | Spieler mit bestimmtem Host hinzufügen | B |
| POST | `/players/move` | `{direction, index}` | Spieler hoch/runter | B |
| POST | `/players/move/to-index` | `{index, toIndex}` | Spieler verschieben | B, C |
| POST | `/players/shuffle` | – | Reihenfolge mischen | B |
| DELETE | `/players/by-index/{index}` | – | Spieler per Position entfernen | B, C |
| DELETE | `/players/by-userid/{userId}` | – | Spieler per User-ID entfernen | B |
| PUT | `/players/by-userid/{userId}/board` | `{boardId}` | Board eines Spielers setzen | B |
| PUT | `/players/by-index/{index}/host` | `{boardId}` | Host/Board für Position setzen | B |
| DELETE | `/players/by-index/{index}/host` | – | Host für Position entfernen | B |
| PUT | `/players/by-index/{index}/handicap` | Handicap-Objekt | Handicap setzen (X01-Handicap) | B |
| DELETE | `/players/by-index/{index}/handicap` | – | Handicap entfernen | B |
| POST | `/invitations/{userId}` | – | Freund einladen | B |
| DELETE | `/invitations/{userId}` | – | Einladung zurückziehen | B |

**Spieler-Bodies** für `POST /players`:

| Fall | Body | Beleg |
|---|---|---|
| Eigener Account (wie Seite `/join/<lobby>`) | `{"name": "...", "userId": "<sub>", "boardId": "<board>"}` | B, [Q11-c][Q17-a] |
| Gast/lokaler Spieler | `{"name": "...", "hostId": "<eigene sub>", "boardId": "<board>"}` | [Q11-c] |
| Minimal (ATA) | `{"name": "...", "boardId": "<board>"}` | [Q15] |
| Bot | `{"name": "...", "userId": null, "cpuPPR": <Level>, "cpuSpeed": "realistic"\|"fast"}` | [Q11-c], B (Enum) |

### 5.4 Match-Objekt (`/gs/v0/matches/{matchId}/…`)

| Methode | Pfad (relativ zum Match) | Body | Zweck | Beleg |
|---|---|---|---|---|
| GET | `` (leer) | – | Match-Metadaten | B, C |
| DELETE | `` (leer) | – | Match abbrechen/löschen | B, [Q15] |
| GET | `/state` | – | vollständiger Match-State (s. 14.4) | B, C |
| POST | `/throws` | Wurfobjekt | Wurf manuell eintragen | B |
| POST | `/turns` | `{score, …}` | ganze Aufnahme eintragen (manuelles Scoring) | B |
| PATCH | `/throws` | `{changes: {...}}` | Würfe korrigieren | B, C |
| POST | `/players/{playerIndex}/throws/autocorrect` | – | Auto-Korrektur | B |
| POST | `/players/next` | – | nächster Spieler (Aufnahme beenden) | B, C |
| POST | `/games/next` | – | nächstes Leg | B, C |
| POST | `/games/restart` | – | Leg neu starten | B |
| POST | `/allocation/reroll` | – | Zuteilung neu würfeln (z. B. Killer-Zahlen) | B |
| POST | `/undo` | – | letzten Wurf rückgängig | B, C |
| POST | `/finish` | – | Match beenden | B, [Q15] |
| POST | `/surrender` | – | aufgeben | B |
| GET | `/challenge` | – | Status einer Wurf-Anfechtung (oft 404) | B, [Q15] |
| POST | `/players/{playerIndex}/throws/challenge` | – | Wurf anfechten (AI Referee) | B |
| POST | `/challenge/corrections` | `{activated, changes}` | Korrekturen während Anfechtung | B |
| POST | `/challenge/request` | `{activated, changes}` | Bestätigung beim Gegner anfordern | B |
| DELETE | `/challenge` | – | Anfechtung abbrechen | B |
| POST | `/challenge/response` | `{approved}` | Anfechtung annehmen/ablehnen | B |

**Korrekturen (`POST /corrections`)** – so nutzt es Tools for Autodarts [Q11-d]:
```jsonc
// Wurf Nr. 1 (0-basiert) in den Korrekturmodus nehmen
{ "activated": 1 }
// Korrekturmodus verlassen
{ "activated": -1 }
// Wurf korrigieren (Segment + Koordinaten)
{ "activated": 1, "changes": { "1": {
    "coords": { "x": 0.12, "y": -0.34 },
    "segment": { "name": "T20", "number": 20, "bed": "Triple", "multiplier": 3 },
    "type": "normal" } } }
```

**Würfe patchen (`PATCH /throws`)** [Q11-d][Q15]:
```json
{ "changes": { "1": { "type": "bouncer" } } }
```
- Wurf-Typen laut Web-App: `normal`, `bouncer`, `referee_ai_confirmed` [Q7].
- Ältere Variante bei darts-caller: Schlüssel `point` statt `coords` [Q12-a] – vermutlich veraltet.

**Visit rückgängig machen** (Tools for Autodarts): pro Dart `POST /undo`, danach `POST /players/next`; `players/next` kann direkt danach kurz fehlschlagen und braucht einen Retry [Q11-e].

### 5.5 Matchmaking

| Methode | Pfad | Body | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/match-making/queues` | – | verfügbare Warteschlangen | B, L |
| POST | `/match-making/players` | v1: `{legs, hasReferee, boardId?}` · v2: `{boardId, queueId, hasReferee, opponentRange}` | Warteschlange betreten | B |
| DELETE | `/match-making/players` | – | Warteschlange verlassen | B |
| POST | `/match-making/players/ready/match/{matchId}` | – | bereit melden | B |
| POST | `/match-making/players/unready/match/{matchId}` | – | Bereitschaft zurückziehen | B |
| GET | `/match-making` | – | eigener Matchmaking-Status | B |
| GET | `/match-making/pairings/{pairingId}` | – | Paarung lesen | B |
| DELETE | `/match-making/pairings/{pairingId}` | – | Paarung ablehnen | B |
| GET | `/match-making/penalty` | – | aktuelle Strafe (z. B. nach Abbruch) | B |

---

## 6. Board Service `bs/v0` – Boards (Cloud)

Basis: `https://api.autodarts.com/bs/v0` · Auth: Bearer [Q7].

### 6.1 Board-Verwaltung

| Methode | Pfad | Body | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/boards` | – | eigene und geteilte Boards (Liste, s. 14.2) | B, C, L |
| POST | `/boards` | `{name, owners: [userId], type}` (`type` z. B. `lens`, `link`) | Board registrieren | B |
| POST | `/boards/{boardId}/claim` | – | Board übernehmen/beanspruchen | B |
| POST | `/boards/{boardId}/api-key` | – | **neuen Board-API-Key** erzeugen | B |
| DELETE | `/boards/{boardId}` | – | Board löschen | B |
| PUT | `/boards/{boardId}/name` | `{name}` | umbenennen | B |
| PUT | `/boards/{boardId}/config` | `{name, virtualNumberRing}` | Board-Einstellungen | B |
| GET | `/boards/{boardId}/stream` | – | streamt das Board gerade? | B, [Q15] |
| GET | `/boards/{boardId}/num-cams` | – | Anzahl Kameras | B |
| POST | `/boards/{boardId}/live-streaming/token` | – | Token für Board-Livestream | B |
| GET | `/board-client/releases/latest` | – | neueste **Board-Client-1.x**-Version als Text (am 25.11.2026: `1.0.7`, ohne Login) | B, L |

### 6.2 Board-Objekt (Cloud-Proxy zum Board)
Die Web-App spricht ein Board über `https://api.autodarts.com/bs/v0/boards/{boardId}` an. Ist das Board im selben Netz erreichbar, nutzt sie für einige Befehle stattdessen die **lokale TLS-Adresse** (Kapitel 12.4) [Q7].

| Methode | Pfad (relativ zum Board) | Body | Zweck | Lokal statt Cloud? | Beleg |
|---|---|---|---|---|---|
| GET | `` (leer) | – | Board-Info (s. 14.2) | nein | B, C |
| GET | `/state` | – | Board-Status `{connected, status, event, …}` | ja | B, [Q15] |
| PUT | `/start` | – | Erkennung starten | ja | B |
| PUT | `/stop` | – | Erkennung stoppen | ja | B |
| POST | `/reset` | – | Darts zurücksetzen (manueller Reset) | ja | B |
| PUT | `/streams/start` | – | Kamera-Streams starten | ja | B |
| PUT | `/streams/stop` | – | Kamera-Streams stoppen | ja | B |
| POST | `/calibrate` | – | Kalibrierung (lokal: `POST /api/config/calibration/auto`) | ja | B |
| GET | `/img/live?cam=&warp=&throw=&width=&height=` | – | liefert `{url}` → Bild unter `https://boards.ws.autodarts.com{url}` | nein | B |
| GET | `/cams/stats` | – | Kamera-FPS/Auflösung | nein | B |
| GET | `/config/calibration/ellipses` | – | Kalibrier-Ellipsen | nein | B |
| POST | `/users` | `{name}` | Board mit Nutzer teilen | nein | B |
| DELETE | `/users/{userId}` | – | Freigabe entziehen | nein | B |
| DELETE | `/users/me` | – | eigene Freigabe entfernen | nein | B |

---

## 7. Account/Stats Service `as/v0`

Basis: `https://api.autodarts.com/as/v0` · Auth: Bearer [Q7].

| Methode | Pfad | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/matches` | `?size=&page=&sort=` | Match-Historie | B |
| GET | `/matches/filter-options` | – | Filterwerte der Historie | B |
| GET | `/matches/filter` | `?variant=&opponentId=&begin=&end=&types=&size=&page=&sort=` | gefilterte Historie | B |
| GET | `/matches/{matchId}/stats` | – | Match-Statistik (404/`stats_pending`, solange nicht fertig) | B, [Q15] |
| GET | `/matches/{matchId}/variant` | – | Variante eines Matches | B |
| GET | `/matches/{matchId}/xp` | – | XP aus einem Match | B |
| GET | `/head-to-head/users/{userId}` | – | Head-to-Head gegen Nutzer (404 → keine Daten) | B |
| GET | `/notifications` | – | ungelesene Benachrichtigungen | B, L |
| DELETE | `/notifications/{id}` | – | eine Benachrichtigung löschen | B |
| DELETE | `/notifications` | – | alle löschen | B |
| GET | `/friends` | – | Freundesliste (ohne Slash → 301 auf `/friends/`) | B, L |
| GET | `/friends/{userId}` | – | Freund lesen | B |
| POST | `/friends/{userId}` | – | Freundschaftsanfrage | B |
| POST | `/friends/by-username/{username}` | – | Anfrage per Benutzername | B |
| DELETE | `/friends/{userId}` | – | Freund entfernen | B |
| PUT | `/friends/online-status` | `{status}` (`Online`/`Offline`/`Incognito`) | Sichtbarkeit setzen | B |
| GET | `/friends/online-status` | – | Sichtbarkeit lesen | B |
| GET | `/friends/recent-opponents` | – | letzte Gegner | B |
| GET | `/seasons/current` | – | aktuelle Season | B, L |
| GET | `/friends/seasons/{seasonId}/xp/leaderboard` | – | XP-Rangliste der Freunde | B |
| GET | `/users/{userId}/stats/{variant}?limit={n}` | – | Nutzerstatistik pro Variante (älter) | C [Q12-a] |

---

## 8. User Services `us/v0` und `user/v1`

### 8.1 `us/v0` (Basis `https://api.autodarts.com/us/v0`) [Q7]

| Methode | Pfad | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/discovery-id` | – | ID für Board-Discovery | B |
| GET | `/profile/settings` | – | Nutzereinstellungen (Caller, Animationen, …) | B, L |
| PUT | `/profile/settings` | Settings-Objekt | Einstellungen speichern | B |
| GET | `/users/{userId}` | – | Nutzerprofil | B |
| GET | `/profile/countries` | – | Länderliste (**ohne Login**, live 200) | B, L |
| PUT | `/profile/country` | `{code}` | Land setzen | B |
| GET | `/users/online` | – | Online-Nutzer | B, L |
| GET/PUT/DELETE | `/profile/dart` | Dart-Objekt (PUT) | eigenes Dart-Setup | B |
| GET | `/users/{userId}/dart` | – | Dart-Setup eines Nutzers | B, [Q15] |
| GET | `/link/discord/` | – | Discord-Verknüpfungs-URL | B |
| POST | `/link/discord/` | `{code, state}` | Discord verknüpfen | B |
| DELETE | `/link/discord/` | – | Discord trennen | B |
| GET | `/link/discord/status` | – | verknüpft? | B |
| GET | `/users/{userId}/discord` | – | Discord-Name eines Nutzers | B |
| GET | `/profile/stats/x01?limit=` | – | X01-Statistik | B |
| GET | `/profile/stats/x01/advanced?start=&end=&interval=` | – | erweiterte X01-Statistik (Intervalle: `daily`, `weekly`, `monthly`, `quarterly`, `yearly`) | B |
| GET | `/profile/stats/cricket?limit=` | – | Cricket | B |
| GET | `/profile/stats/countup?limit=` | – | Count Up | B |
| GET | `/profile/stats/random-checkout?limit=` | – | Random Checkout | B |
| GET | `/profile/stats/killer?limit=` | – | Killer | B |
| GET | `/profile/stats/bobs27?limit=` | – | Bob's 27 | B |
| GET | `/users/me/season` | – | eigene Season-Daten | B |
| GET | `/users/me/season/activity?season=` | – | Season-Aktivität | B |
| GET | `/users/{userId}/stream` | – | streamt Nutzer gerade? | B |
| GET | `/match-id` | – | ID des aktiven Matches des Nutzers | B, [Q15] |

### 8.2 `user/v1` (Basis `https://api.autodarts.com/user/v1`) [Q7]

| Methode | Pfad | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/countries` | – | Länderliste (ohne Login, live 200) | B, L |
| POST | `/profile/onboard` | – | Onboarding abschließen | B |
| GET | `/profile` | – | Profil | B |
| PUT | `/profile` | z. B. `{username, firstName, lastName}`, `{country}`, `{skillLevel}` | Profil ändern | B |
| DELETE | `/profile` | – | Profil löschen | B |
| POST | `/profile/restore` | – | gelöschtes Profil wiederherstellen | B |
| GET/PUT | `/profile/settings` | Settings-Objekt | Einstellungen | B |
| GET/PUT/DELETE | `/profile/dart` | Dart-Objekt | Dart-Setup | B |
| GET | `/profile/avatar` | – | Avatar (Binär) | B |
| PUT | `/profile/avatar` | Bilddaten | Avatar hochladen | B |
| GET | `/profile/avatar/presets` | – | Avatar-Vorlagen | B |
| PUT | `/profile/avatar/presets/{presetId}` | – | Vorlage wählen | B |
| GET | `/users/{userId}` | – | Nutzer | B |
| GET | `/users/blocked-users?size=&page=&search=` | – | blockierte Nutzer | B |
| GET | `/users/blocked-users/{userId}` | – | ist blockiert? | B |
| POST | `/users/blocked-users/{userId}` | – | blockieren | B |
| DELETE | `/users/blocked-users/{userId}` | – | entblockieren | B |
| POST | `/reports` | Meldungsobjekt | Nutzer melden | B |

---

## 9. Tournament Service `ts/v0`

Basis: `https://api.autodarts.com/ts/v0` · Auth: Bearer · Route `/tournaments` live bestätigt (401) [Q7][Q9].

### 9.1 Öffentliche Turniere

| Methode | Pfad | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| GET | `/tournaments` | – | Turnierliste | B, L |
| GET | `/tournaments/{id}` | – | Turnier | B |
| GET | `/tournaments/{id}/ranking` | – | Rangliste | B |
| GET | `/tournaments/{id}/tree/matches` | – | Turnierbaum | B |
| POST | `/tournaments/{id}/players` | – | anmelden | B |
| DELETE | `/tournaments/{id}/players` | – | abmelden | B |
| GET | `/tournaments/{id}/requirements` | – | erfüllt Nutzer die Voraussetzungen? | B |
| GET | `/tournaments/{id}/match/ready` | – | aktives, bereites Match | B |
| POST | `/tournaments/{id}/players/ready/match/{matchId}/board/{boardId}` | – | bereit melden (mit Board) | B |
| POST | `/tournaments/{id}/players/unready/match/{matchId}` | – | Bereitschaft zurückziehen | B |
| GET | `/history/tournaments/user?size=&page=&sort=&view=` | – | eigene Turnierhistorie (`view`: `all`, `participated`, `public`, `private`) | B |
| GET | `/history/tournaments?size=&page=&sort=` | – | Turnierhistorie allgemein | B |
| GET | `/matches/{matchId}/stream/stats` | – | Stream-Statistik eines Turniermatches | B |

### 9.2 Private Turniere

| Methode | Pfad | Body | Zweck | Beleg |
|---|---|---|---|---|
| POST | `/tournaments/private/new` | Turnierobjekt | privates Turnier anlegen | B |
| POST | `/tournaments/private/{id}/start` | – | starten | B |
| DELETE | `/tournaments/private/{id}` | – | abbrechen | B |
| POST | `/tournaments/private/{id}/invitations/{userId}` | – | Freund einladen | B |
| DELETE | `/tournaments/private/{id}/invitations/{userId}` | – | Einladung zurückziehen | B |
| POST | `/tournaments/private/{id}/players` | `{name}` | lokalen Spieler hinzufügen | B |
| DELETE | `/tournaments/private/{id}/players/{playerId}` | – | Spieler entfernen | B |
| POST | `/tournaments/private/{id}/boards` | `{name, id}` | Board hinzufügen | B |
| DELETE | `/tournaments/private/{id}/boards/{boardId}` | – | Board entfernen | B |
| POST | `/tournaments/private/{id}/match/{matchId}/start` | – | Match starten | B |
| POST | `/tournaments/private/{id}/match/{matchId}/finish-with-default-winner/{playerIndex}` | – | Sieger festlegen (Walkover) | B |
| POST | `/tournaments/private/{id}/match/{matchId}/board/{boardId}` | – | Board zuweisen | B |
| DELETE | `/tournaments/private/{id}/match/{matchId}/board` | – | Board-Zuweisung entfernen | B |

### 9.3 Admin (nur mit Admin-Rechten, im Client vorhanden)

| Methode | Pfad | Zweck | Beleg |
|---|---|---|---|
| POST | `/tournaments/admin/new` | Turnier anlegen | B |
| PUT | `/tournaments/admin/{id}/` | ändern | B |
| DELETE | `/tournaments/admin/{id}/` | löschen | B |
| GET | `/tournaments/admin/{id}` | Turnier ohne Generierung | B |
| POST/GET | `/tournaments/admin/schedule` | Zeitpläne anlegen/lesen | B |
| GET/PUT/DELETE | `/tournaments/admin/schedule/{id}` | Zeitplan lesen/ändern/löschen | B |
| POST | `/tournaments/admin/schedule/{id}/disable` · `/enable` · `/run` · `/clean` | Zeitplan steuern | B |

---

## 10. Messaging `ms/v0` – Tickets, Chat und WebSocket

### 10.1 REST

| Methode | URL | Body | Zweck | Beleg |
|---|---|---|---|---|
| POST | `https://play.ws.autodarts.com/ms/v0/tickets` | – (Bearer) | **WebSocket-Ticket** holen → `{code}` | B, L |
| POST | `https://play.ws.autodarts.com/ms/v0/chat/messages` | `{topic, message}`; `topic` muss mit `lobby.` oder `match.` beginnen | Chatnachricht senden | B |
| POST | `https://api.autodarts.io/ms/v0/ticket` | – | **Alt** (ESP32-Client 2023); am 25.11.2026 **404** | C, L |

### 10.2 Verbindungsaufbau (aktuell, wie die Web-App) [Q7]
1. Token frisch halten (Refresh).
2. `POST https://play.ws.autodarts.com/ms/v0/tickets` mit `Authorization: Bearer …` → `{"code": "…"}`.
3. WebSocket öffnen: **`wss://play.ws.autodarts.com/ms/v0/subscribe?code=<code>`**
4. Nach `onopen` alle gewünschten Kanäle abonnieren.
5. Reconnect mit exponentiellem Backoff: Wartezeit ≈ `(2^(Versuch/5) − 1 + Zufall) · 1000 ms`; nach Reconnect alle Abos erneut senden.

**Alternative (Community, älter):** `wss://api.autodarts.io/ms/v0/subscribe` mit Header `Authorization: Bearer <token>` [Q12-a]. Live antwortet `…/ms/v0/subscribe` ohne Login mit 401 auf beiden Hosts [Q9].

### 10.3 Nachrichtenformat

**Client → Server:**
```json
{ "type": "subscribe",   "channel": "autodarts.matches", "topic": "<matchId>.state" }
{ "type": "unsubscribe", "channel": "autodarts.matches", "topic": "<matchId>.state" }
```
**Server → Client:**
```json
{ "channel": "autodarts.boards", "topic": "<boardId>.matches", "data": { "event": "start", "id": "<matchId>" } }
```
- Nachrichten mit `"type": "error"` werden von der Web-App verworfen [Q7].
- Beispiel oben aus darts-caller [Q12-a].

### 10.4 Alle Kanäle und Topics

Kanalnamen und Topic-Muster aus der Web-App-Klasse `MessageBroker` [Q7]:

| Kanal | Topic | Inhalt | Beleg |
|---|---|---|---|
| `autodarts.boards` | `{boardId}.state` | Board-Status | B |
| `autodarts.boards` | `{boardId}.events` | Board-Events (Würfe, Takeout, …) | B, C |
| `autodarts.boards` | `{boardId}.matches` | Match startet/endet am Board (`{event:"start"\|"delete", id}`) | B, C |
| `autodarts.boards` | `discovery.{discoveryId}` | Board-Discovery | B |
| `autodarts.boards` | `{boardId}.stream` | Kamera-Stream-Status | B |
| `autodarts.boards.images` | `{boardId}.{cam}` | Bild-URL (relativ zu `boards.ws.autodarts.com`) | B, C |
| `autodarts.lobbies` | `{lobbyId}.state` | Lobby-Zustand | B, C |
| `autodarts.lobbies` | `{lobbyId}.events` | Lobby-Events (`start`, `finish`, `delete`) | B, C |
| `autodarts.lobbies` | `lobbies` | alle Lobby-Events (Lobby-Liste) | B |
| `autodarts.matches` | `{matchId}.state` | **kompletter Match-State** bei jeder Änderung | B, C |
| `autodarts.matches` | `{matchId}.events` | Match-Events | B |
| `autodarts.matches` | `matches` | alle Match-Events | B |
| `autodarts.matches` | `{matchId}.game-events` | Spiel-Events (`game_on`, `game_shot`, `turn_start`, `turn_end`, `throw`, …) | B, C |
| `autodarts.matches` | `{matchId}.corrections` | Korrekturen | B |
| `autodarts.matches` | `{matchId}.viewers` | Zuschauerzahl | B |
| `autodarts.matches` | `{matchId}.referee` | AI-Referee-Status | B |
| `autodarts.matches` | `{matchId}.challenge` | Anfechtungs-Status | B |
| `autodarts.matchmaking` | `{topic}` | Matchmaking-Events | B |
| `autodarts.users` | `online-users` | Online-Nutzer | B |
| `autodarts.users` | `{userId}.stream` | Kamera-Status eines Nutzers | B |
| `autodarts.users` | `{userId}.events` | Nutzer-Events (`lobby-enter`, `lobby-leave`, `lens-used`) | B, C |
| `autodarts.chat` | `lobby.{lobbyId}` / `match.{matchId}` | Chat | B |
| `autodarts.tournaments` | `{id}.status` · `{id}.ranking` · `{id}.bracket` · `{id}.users.{userId}` · `tournaments` | Turnier-Events | B |
| `autodarts.maintenance` | `status` | Wartungsmodus | B |
| `autodarts.friends` | `{userId}.requests` · `{userId}.status` | Freundesanfragen/-status | B |
| `autodarts.notifications` | `{topic}` | Benachrichtigungen | B |
| `autodarts.permissions` | `{topic}` | Rechte neu laden | B |
| `autodarts.controls` | `{topic}` | Aufforderung zum Neuladen | B |

### 10.5 Event-Werte

| Kanal | Feld | Werte | Beleg |
|---|---|---|---|
| `autodarts.boards` (`.events`) | `event` | `Started`, `Stopped`, `Throw detected`, `Takeout started`, `Takeout finished`, `Manual reset`, `Calibration started`, `Calibration finished` | C [Q12-a][Q11-b] |
| `autodarts.boards` (`.matches`) | `event` | `start`, `delete` (+ `id` des Matches) | C [Q12-a][Q11-b] |
| `autodarts.lobbies` (`.events`) | `event` | `start`, `finish`, `delete` | C [Q12-a] |
| `autodarts.users` (`.events`) | `event` | `lobby-enter`, `lobby-leave` (mit `body.id`), `lens-used` (mit `body`) | C [Q12-a], B |
| Match-Game-Events | Typ | `game_on`, `game_shot`, `turn_start`, `turn_end`, `throw`, `killer_became_killer`, `killer_killed` | B |
| Turnier-Events | Typ | `player`, `create`, `start`, `finish`, `cancel`, `delete`, `match-ready`, `match-ready-update`, `match-start`, `match-cancelled`, `board-pool-update`, `board-assignment-update`, `match-update`, `matches-update`, `ranking-update`, `player-joined`, `player-left`, `players-update` | B |
| Notifications | Typ | `friend-list:request`, `lobby:invite`, `tournament:match-ready`, `tournament:private-invite` | B |
| Freunde | Status/Aktivität | `Online`/`Offline`/`Incognito`; `playing-match`, `playing-tournament`, `playing-tournament-match`, `in-lobby`; Anfragen `request-new`/`request-accepted`/`request-deleted` | B |

**Board-Status-Werte** (Feld `status`, Cloud): `Starting`, `Stopping`, `Offline`, `Stopped`, `Throw`, `Takeout`, `Takeout in progress`, `Calibrating`, `Setup`, `Error` [Q7].

---

## 11. Weitere Services

| Methode | URL | Body / Query | Zweck | Beleg |
|---|---|---|---|---|
| GET | `https://api.autodarts.com/auth/v0/permissions` | – | **Feature-Flags** pro App (`autodarts-play`, `autodarts-desktop`, `autodarts-headless`), **ohne Login**, live 200 | B, L |
| GET | `https://api.autodarts.com/ds/v0/throws/{throwId}?{query}` | – | Detection-Daten eines Wurfs | B |
| GET | `…/ds/v0/throws/{throwId}/detection?{query}` | – | Erkennungsdetails | B |
| GET | `…/ds/v0/throws/{throwId}/config?version={client\|default\|…}` | – | Erkennungs-Konfiguration | B |
| GET | `…/ds/v0/throws/{throwId}/calibration` | – | Kalibrierung zum Wurf | B |
| GET | `https://api.autodarts.com/subscriptions/v0/subscriptions` | – | eigene Abos | B |
| POST | `…/subscriptions/v0/paddle/portal-sessions` | – | Paddle-Kundenportal | B |
| POST | `…/subscriptions/v0/coupons/validate` | `{code}` | Gutschein prüfen | B |
| POST | `…/subscriptions/v0/stripe/coupon-checkout-sessions` | `{code, successUrl, cancelUrl}` | Checkout mit Gutschein | B |
| POST | `…/subscriptions/v0/stripe/portal-sessions` | `{returnUrl}` | Stripe-Kundenportal | B |
| POST | `…/subscriptions/v0/stripe/checkout-sessions` | `{period, successUrl, cancelUrl}` | Abo abschließen | B |
| POST | `…/subscriptions/v0/stripe/cancellations` | `{reason, feedback}` | Kündigung starten | B |
| POST | `…/subscriptions/v0/stripe/cancellations/{id}/retention` | – | Halteangebot annehmen | B |
| GET | `…/subscriptions/v0/stripe/cancellations/{id}/details` | – | Kündigungsdetails | B |
| POST | `…/subscriptions/v0/stripe/cancellations/{id}/confirm` | – | Kündigung bestätigen | B |
| POST | `…/subscriptions/v0/apple/transactions` | Transaktionsdaten | Apple-Kauf prüfen | B |
| POST | `…/subscriptions/v0/google/transactions` | `{token, transactionId, productId}` | Google-Kauf prüfen | B |
| POST | `…/subscriptions/v0/apple/restore` | Transaktionsdaten | Apple-Käufe wiederherstellen | B |
| GET | `https://api.autodarts.com/consent/v0/current` | – | aktuelle AGB/Datenschutz-Versionen (**ohne Login**, live 200) | B, L |
| GET | `https://api.autodarts.com/consent/v0` | – | eigener Zustimmungsstatus | B, L |
| PUT | `https://api.autodarts.com/consent/v0` | Zustimmungen | Bedingungen akzeptieren | B |
| GET | `https://api.autodarts.com/status/v0` | – | Wartungsstatus | B, L |
| GET | `https://api.autodarts.com/faq/v0?language=` | – | FAQ | B, L |
| POST | `https://api.autodarts.com/streams/v0{pfad}` | SDP-Objekt | WebRTC-SDP-Austausch (Livestream) | B |
| GET | `https://api.autodarts.com/admin/v0/maintenance` | – | Wartungsstatus (Admin) | B, L |
| PUT | `https://api.autodarts.com/admin/v0/maintenance` | Status | Wartung setzen (Admin) | B |

---

## 12. Externe Hilfsdienste

### 12.1 `discover.autodarts.com`
- `GET https://discover.autodarts.com` – **ohne Login**. Listet Boards, die sich hinter **deiner öffentlichen IP** gemeldet haben [Q16-b][Q7].
- Antwort: Liste mit `boardId`, `ip`, `port`, `insecurePort`, `name`, `version` [Q16-b]. Live am 25.11.2026 (fremdes Netz): `[]` [Q9].
- Damit kann man die lokale Adresse des Boards finden (dann weiter mit Kapitel 13).

### 12.2 `releases.autodarts.com`
- `GET https://releases.autodarts.com/{app}/downloads/latest.stable.json` mit `app` = `desktop` oder `headless` (ohne Login) [Q7][Q23].
- Am 25.11.2026: **Desktop 2.1.1** (AppImage, dmg, Setup.exe) und **Headless 2.1.1** (tar.gz für linux-amd64/arm64/armv7l, osx) [Q23].

### 12.3 `boards.ws.autodarts.com`
- Liefert Kamerabilder aus. Pfad kommt aus `GET /bs/v0/boards/{id}/img/live…` (`{url}`) oder aus dem Kanal `autodarts.boards.images` [Q7][Q11-b].

### 12.4 Direkter TLS-Zugriff `*.autodarts.direct`
Aus der Web-App [Q7]:
- Das Board-Feld `ip` kann zwei Adressen enthalten, getrennt durch Komma, z. B. `http://…,https://192.168.1.50:3181`.
- Aus der zweiten Adresse baut die Web-App: **`https://192-168-1-50.{boardId}.autodarts.direct:{port}/api`** (Punkte der IP → Bindestriche).
- Erreichbarkeit prüft sie per `HEAD {directUrl}/api/ping`, aber nur, wenn das Board auch über `discover.autodarts.com` gefunden wurde.
- Danach gehen `start`, `stop`, `reset`, `streams/start|stop`, `state` und Kalibrierung **direkt** an das Board.
- Passend dazu hat Board Manager 2.1 in `config.host` die Felder `tlsPort`, `tlsCert`, `tlsKey`, `tlsSelfSigned` [Q16-f].

---

## 13. Lokale Board-Manager-API (Port 3180)

> **Empfohlener Weg** für eigene Projekte (laut Autodarts: lokaler Betrieb ist richtig) [Q16-d]. **Kein Login nötig** [Q16-a][Q20].

### 13.1 Grundlagen
- Adresse: **`http://<board-pc>:3180`** (lokal `http://localhost:3180`) [Q21-a].
- Generationen [Q16-f][Q21-b]:
  - **Board Manager 1.x** („klassische App“, Board Client 0.x/1.x) mit Web-Oberfläche.
  - **Board Manager 2.x** = **Autodarts Desktop** bzw. **Headless** (2.0.x, 2.1.x). Die Web-Oberfläche „Board Manager“ wird ab Version 2 **nicht mehr unterstützt** – die lokale API läuft aber weiter.
- Port-Werte stehen in `GET /api/config` unter `host.port` (z. B. `"3180"`) [Q16-f].
- Board-ID und Board-API-Key (aus „My Boards“ auf autodarts.com) verbinden das Board mit der Cloud [Q21-a][Q21-c].

### 13.2 Alle Endpunkte

| Methode | Pfad | Body | Antwort / Zweck | Version | Beleg |
|---|---|---|---|---|---|
| GET | `/api/state` | – | Board-Zustand mit Darts (s. 13.4) | 1.x, 2.x | R, C |
| GET | `/api/version` | – | Version als **Text**, z. B. `2.1.0` | 1.x, 2.x | R, C |
| GET | `/api/config` | – | komplette Konfiguration (enthält **API-Key** – nicht loggen!) | 1.x, 2.x | R, C |
| PATCH | `/api/config` | `{"<sektion>": {"<schlüssel>": wert}}`, z. B. `{"cam":{"fps":15}}` | Einstellungen ändern (Antwort kann Geheimnisse enthalten) | 1.x, 2.x | C [Q16-a][Q18] |
| GET | `/api/system` | – | Gesamtstatus (Version, Kameras, Kalibrierung, Motion, Config) | 2.x | R, C |
| GET | `/api/host` | – | Infos zum Board-PC (OS, CPU, Versionen, IP) | 2.x | R, C |
| GET | `/api/devices` | – | angeschlossene Kameras | 2.x | C [Q18] |
| GET | `/api/state/stats` | – | `{cpuPercent, fps, width, height, memoryBytes}` | 1.x, 2.x | R, C |
| GET | `/api/state/motion` | – | Motion-Flags | 1.x, 2.0 (**fehlt in 2.1 → 404**) | R, C |
| GET | `/api/cams/stats` | – | `{fps: [..], resolution: {width, height}}` | 1.x, 2.x | R, C |
| GET | `/api/cams/state` | – | `{isOpened, isRunning}` | 1.x, 2.x | R, C |
| PUT | `/api/start` | – | Erkennung starten | 1.x, 2.x | B, C |
| PUT | `/api/stop` | – | Erkennung stoppen | 1.x, 2.x | B, C |
| PUT | `/api/detection/start` · `/api/detection/stop` | – | Fallback, falls `/api/start`/`/api/stop` 404 liefern | ältere | C [Q16-a] |
| POST | `/api/reset` | – | Darts zurücksetzen („Manual reset“) | 1.x, 2.x | B, C |
| POST | `/api/restart` | – | Board-Software neu starten (Verbindung bricht dabei oft ab) | 1.x, 2.x | C |
| POST | `/api/config/calibration/auto` | – | Auto-Kalibrierung aller Kameras (Timeout ~60 s einplanen) | 1.x, 2.x | B, C |
| POST | `/api/config/calibration/auto/{camIndex}?distortion=true` | – | eine Kamera kalibrieren | 2.x | C [Q16-a] |
| GET | `/api/config/calibration/ellipses` | – | Kalibrier-Ellipsen je Kamera | 2.x | B, C |
| POST | `/api/update/apply` | – | anstehendes Update installieren | 2.x | C [Q18] |
| PUT | `/api/upstream/connect` · `/api/upstream/disconnect` | – | Cloud-Verbindung an/aus | 1.x | C [Q16-a] |
| PUT | `/api/streams/start` · `/api/streams/stop` | – | Kamera-Streams an/aus | ältere Versionen (2.1: **404**) | B, C [Q24] |
| GET | `/api/img/cams/{index}` | – | Einzelbild (JPEG) einer Kamera | 2.x | C |
| GET | `/api/img/detection` · `/api/img/live` | – | Erkennungsbild / Live-Bild (JPEG) | 2.x | C [Q18] |
| GET | `/api/streams/cams/{index}` | – | **MJPEG-Stream** (`multipart/…`) einer Kamera | 2.x | C |
| GET | `/api/streams/detection` · `/api/streams/live` | – | MJPEG-Stream Erkennung/Live (Live = Kamerastreifen) | 2.x | C [Q18][Q20] |
| HEAD | `/api/ping` | – | Erreichbarkeit (über `autodarts.direct`) | 2.x | B |
| WS | `/api/events` | – | Live-Events (s. 13.5) | 1.x, 2.x | R, C |
| WS | `/api/events/system` | – | zweiter Socket (alles von `/api/events` + Systemdaten, Motion 30×/s) | 2.1 | R, C |

**Hinweise zu Methoden:** Board Manager 2.x erwartet für manche Befehle `PUT` statt `POST` – Community-Code probiert bei 404/405 die andere Methode [Q18][Q16-a]. Die offizielle Web-App nutzt `PUT` für start/stop/streams und `POST` für reset/Kalibrierung [Q7].

**Widerspruch dokumentiert:** Der ioBroker-Adapter schreibt, dass v2 lokal **keine Wurfdaten** mehr liefert [Q19]. Echte Aufzeichnungen eines Board Managers **2.1.0** zeigen aber Würfe in `/api/state` und im Socket [Q16-f]. Stand dieser Doku: **2.1.0 liefert Würfe lokal** (im neuen Format, s. 13.4).

### 13.3 Status- und Event-Werte

| | Board Manager 1.x / 2.0 | Board Manager 2.1 (camelCase) |
|---|---|---|
| `status` | `Stopped`, `Starting`, `Throw`, `Takeout`, `Takeout in progress` [Q14-b] | `starting`, `throw`, `takeoutInProgress`, … [Q16-f] |
| `event` | `Stopped`, `Stopping`, `Starting`, `Started`, `Throw detected`, `Takeout started`, `Takeout finished`, `Manual reset` [Q14-b] | `started`, `starting`, `throwDetected`, `takeoutStarted`, `takeoutFinished`, … [Q16-f] |

### 13.4 `GET /api/state` – Format

**1.x / 2.0** (verschachtelt; Beispielform aus [Q16-f], Schlüssel bestätigt durch [Q14-b][Q20]):
```json
{
  "connected": true, "running": true, "status": "Throw", "event": "Throw detected", "numThrows": 1,
  "throws": [ { "segment": { "name": "T20", "number": 20, "bed": "Triple", "multiplier": 3 },
                "coords": { "x": 0.0021, "y": 0.6138 } } ]
}
```

**2.1** (flach, **echte Aufzeichnung**) [Q16-f]:
```json
{
  "connected": true, "event": "throwDetected", "running": true, "status": "throw",
  "throws": [ { "bed": "SingleInner", "bouncer": false, "coordsX": 0.1697, "coordsY": -0.4287,
                "failed": false, "method": "UnanimousCam", "multiplier": 1,
                "segmentName": "S17", "segmentNumber": 17 } ]
}
```
Unterschiede 2.1: kein `numThrows` (= Länge von `throws`), `segment`/`coords` flach, neue Felder `bouncer`, `failed`, `method`; Status/Event in camelCase [Q16-a][Q16-f]. Ein nicht platzierbarer Dart (z. B. Bouncer, `failed: true`) kommt mit Koordinaten (0, 0) [Q16-a].

**Koordinaten:** (0, 0) = Bullseye, `+y` oben, `+x` rechts; Radius **1,0 ≈ äußerer Doppeldraht**, Werte > 1 = außerhalb [Q20]. Plausibel zu den Aufzeichnungen (T20 bei y ≈ 0,61; S3 unten bei y ≈ −0,41) [Q16-f].

### 13.5 WebSocket `/api/events` (und `/api/events/system`)

Verbindung: `ws://<board-pc>:3180/api/events` – kein Abo nötig, der Board Manager sendet von selbst [Q16-a][Q14-c].

Jede Nachricht: `{ "type": "<art>", "data": { … } }`

| `type` | Socket | Inhalt | Beleg |
|---|---|---|---|
| `state` | beide | wie `GET /api/state` (sendet den **ganzen Zustand**, nicht einzelne Würfe → selbst diffen) | R, C [Q20] |
| `motion_state` | `/api/events` (1.x/2.0) | `{isWaiting, isStable, isDart, isHand, isTakeoutPartial, isTakeoutFull}` | C |
| `cam_state` | `/api/events` | `{isOpened, isRunning}` | C |
| `stats` | beide (Form verschieden) | FPS/CPU; auf dem System-Socket `{camStats:[…], stats:{…}}` | R, C |
| `cam_stats` | `/api/events` | Kamera-FPS | C |
| `vantage` | `/api/events/system` (2.1) | Motion-Daten ~30×/s: `{vantage:{motion:{isDart, isHand, isStable, isTakeoutFull, isTakeoutPartial, isWaiting, numDarts, motionClass, camStates:[…]}}}`; `{vantage:null}` wenn Erkennung stoppt | R, C |
| `board` | `/api/events/system` | Board-Status (wie `status` in `/api/system`) | R |
| `vantageConfig` | `/api/events/system` | Erkennungs-Konfiguration (z. B. `boardRois`) | R |
| `calibration` | `/api/events/system` | Kalibrierung je Kamera | R |
| `cams` | `/api/events/system` | `{camSlotInputs, camState}` | R |

Timing aus echten Aufzeichnungen (2.1.0): `takeoutStarted` kommt ca. 0,1 s nach `isHand` auf dem System-Socket, auf dem ersten Socket bis 0,3 s; Takeouts dauerten 1,1–2,5 s [Q16-f].

### 13.6 `GET /api/config` – Aufbau (2.1, echte Aufzeichnung, Geheimnisse ersetzt) [Q16-f]

| Sektion | Schlüssel (2.1, camelCase; 2.0 nutzt snake_case wie `board_id`) |
|---|---|
| `auth` | `boardId`, `apiKey` |
| `cam` | `autoCalibrateOnStart`, `autoDistortion`, `cams` (USB-IDs), `fps`, `fpsMax`, `width`, `height`, `syncControls` |
| `detection` | `kernel`, `threshold` |
| `motion` | `kernel`, `scale`, `stableNumFrames`, `standbyMinutes` (5/10/15/30/60), `threshold` |
| `host` | `port`, `tlsPort`, `tlsCert`, `tlsKey`, `tlsSelfSigned` |
| `linkServer` | `enabled`, `interfaces`, `name` |

Ältere Clients (<0.23) hatten zusätzlich Detektions-Parameter wie Diff-Image-Threshold, Gaussian Kernel, Dart-/Hand-Größen und Hough-Line-Werte [Q21-b].

### 13.7 `GET /api/system` (2.x) [Q16-f]
Top-Level-Schlüssel in 2.1: `calibration`, `camSlotInputs`, `camState`, `camStats`, `config`, `lens`, `stats`, `status`, `turn`, `vantage`.
- `status`: `version`, `updateAvailable`, `link` (z. B. `connected`), `calibrated`, `calibratingCams`, `blocker`, `clockSkewSeconds`, `setupPending`, `takenOver`, `linkServer{…}`
- `turn`: der Board-Zustand (wie `/api/state`)
- `vantage.motion`: Motion-Flags
- In 2.0 liegen Version/State/Motion direkt auf oberster Ebene [Q16-a].

### 13.8 `GET /api/host` (2.x) [Q16-f]
Felder u. a.: `clientVersion`, `desktopVersion`, `appVersion`, `visionVersion`, `openCVVersion`, `os`, `platform`, `platformVersion`, `kernelArch`, `kernelVersion`, `cpu{cores, mhz, model}`, `hostname`, `ip`, `port`, `tlsPort`, `insecurePort`, `protocol`, `cam1..cam3{name, pid, vid}`, `hasAutodartsVisionCam`.

---

## 14. Datenmodelle und Enums

### 14.1 Segment und Wurf
```ts
interface Segment { name: string; number: number; bed: string; multiplier: number; } // z. B. T20, 20, "Triple", 3
interface Coords  { x: number; y: number; }
interface Throw   { id: string; throw: number; createdAt: string; segment: Segment; coords?: Coords; entry: string; marks: any|null; }
interface Turn    { id: string; createdAt: string; finishedAt: string; round: number; turn: number; playerId: string;
                    score: number; points: number; marks: any|null; busted: boolean; throws: Throw[]; }
```
Quelle: Typdefinitionen von Tools for Autodarts [Q11-b]. Miss-Segment in der Web-App: `name: "Miss"`, `number: 0` [Q7].

**Bed-Werte:** Web-App: `Single`, `SingleInner`, `SingleOuter`, `Double`, `Triple`, `Outside` [Q7]; lokal 2.1 z. B. `SingleInner` [Q16-f]; Corrections nutzen `Single`, `Double`, `Triple`, `Bull` (für `BULL`, Multiplier 2) [Q11-d].

### 14.2 Board (Cloud, `GET /bs/v0/boards`)
Felder laut Web-App-Konstruktor [Q7] und Aufzeichnung (Werte erfunden) [Q17-b]:
`id`, `name`, `virtualNumberRing`, `ip` (ggf. zwei Adressen mit Komma), `version`, `os`, `arch`, `variant`, `type`, `permissions: [{ user: {id, name, avatarUrl, country}, isOwner }]`, `matchId`, `state: {status, event, connected}`, `detections`, `corrections`, `accuracy`.
`permissions[].user.id` = `sub` des Access-Tokens [Q17-b]. Board-Typen: `lens`, `vantage`, `link` [Q7].

### 14.3 Lobby
Felder [Q7][Q11-b]: `id`, `host`, `variant`, `players[]`, `settings`, `sets`, `legs`, `scores`, `isPrivate`, `bullOffMode`, `tournamentId`, `type`, `hasReferee`, `minPlayers`, `maxPlayers`, `createdAt`.
Spieler: `id`, `index`, `name`, `userId`, `hostId`, `boardId`, `boardName`, `avatarUrl`, `cpuPPR`, `host`, `user` [Q11-b].

### 14.4 Match-State (`GET /gs/v0/matches/{id}/state` bzw. Kanal `…state`)
Felder [Q11-b][Q15]: `id`, `createdAt`, `host`, `variant`, `settings`, `players[]`, `type`, `set`, `leg`, `sets`, `legs`, `scores: [{legs, sets}]`, `finished`, `winner`, `turns[]`, `round`, `player`, `turnScore`, `turnBusted`, `gameScores[]`, `gameFinished`, `gameWinner`, `stats[] ({matchStats, setStats, legStats})`, `state`, `chalkboards?`, `activated?` (−1…2).
- `scores[].legs` = gewonnene Legs; `gameScores[]` = **Restpunkte** in X01 [Q15].
- `finished` kann bei Matchmodus „Off“ schon nach einem Leg `true` sein [Q15].

### 14.5 Enums (aus der Web-App) [Q7]

| Enum | Werte |
|---|---|
| Variante | `X01`, `Cricket`, `Killer`, `121`, `ATC`, `RTW`, `CountUp`, `Bermuda`, `Shanghai`, `Gotcha`, `Random Checkout`, `Bull-off`, `Segment Training`, `Bob's 27` |
| Match-Typ | `Local`, `Online`, `Match Making`, `Tournament` |
| In/Out-Modus | `Straight`, `Double`, `Master` |
| Bull-Modus | `25/50`, `50/50` |
| Bull-off | `Off`, `Normal`, `Official` |
| Bot-Tempo | `realistic`, `fast` |
| Wurf-Typ | `normal`, `bouncer`, `referee_ai_confirmed` |
| Referee-Rechte | `can-call-referee`, `can-call-referee-when-active`, `can-challenge`, `can-challenge-when-active` |
| Anfechtungs-Status | `correcting`, `approving`, `approved`, `declined`, `declined-timeout`, `aborted`, `aborted-timeout` |
| Board-Typ | `lens`, `vantage`, `link` |
| Segment-Training-Bereiche | `Full`, `Single`, `Double`, `Triple`, `Inner Single`, `Outer Single` |
| ATC/RTW-Reihenfolge | `1-20-Bull`, `20-1-Bull`, `Random-Bull`, `Clockwise`, `Counter-Clockwise` |
| Turnierformat | `single-ko` |
| Stats-Intervall | `daily`, `weekly`, `monthly`, `quarterly`, `yearly` |

---

## 15. Beispiele

### 15.1 Lokal: Zustand lesen und Würfe live empfangen (empfohlen)
```bash
curl http://192.168.1.50:3180/api/version
curl http://192.168.1.50:3180/api/state
curl -X PUT  http://192.168.1.50:3180/api/start
curl -X POST http://192.168.1.50:3180/api/reset
```
```python
# pip install websockets
import asyncio, json, websockets

def darts(state):
    # 2.1: flach (segmentName); 1.x/2.0: verschachtelt (segment.name)
    return [t.get("segmentName") or t.get("segment", {}).get("name") for t in state.get("throws", [])]

async def main(host="192.168.1.50"):
    async with websockets.connect(f"ws://{host}:3180/api/events") as ws:
        async for raw in ws:
            msg = json.loads(raw)
            if msg.get("type") == "state":
                d = msg["data"]
                print(d.get("status"), d.get("event"), darts(d))

asyncio.run(main())
```

### 15.2 Cloud: Token holen (inoffiziell, nur eigener Account)
```bash
# Login wie die Web-App (client_id der offiziellen Web-App; ohne Support)
curl -s -X POST https://api.autodarts.com/auth/v1/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"ICH@example.com","password":"…","client_id":"autodarts-play"}'
# → {"access_token":"…","refresh_token":"…","expires_in":900, …}

# Erneuern (neues refresh_token SOFORT speichern – das alte ist danach ungültig)
curl -s -X POST https://api.autodarts.com/auth/v1/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refresh_token":"…","client_id":"autodarts-play"}'
```

### 15.3 Cloud: Boards lesen und Match verfolgen
```bash
TOKEN=…
curl -s https://api.autodarts.com/bs/v0/boards -H "Authorization: Bearer $TOKEN"
curl -s https://api.autodarts.com/bs/v0/boards/$BOARD_ID -H "Authorization: Bearer $TOKEN"   # enthält matchId
curl -s https://api.autodarts.com/gs/v0/matches/$MATCH_ID/state -H "Authorization: Bearer $TOKEN"
```

### 15.4 Cloud: WebSocket (JavaScript, wie die Web-App)
```js
const token = "…";
const { code } = await (await fetch("https://play.ws.autodarts.com/ms/v0/tickets", {
  method: "POST", headers: { Authorization: `Bearer ${token}` } })).json();

const ws = new WebSocket(`wss://play.ws.autodarts.com/ms/v0/subscribe?code=${code}`);
ws.onopen = () => {
  ws.send(JSON.stringify({ type: "subscribe", channel: "autodarts.boards",  topic: `${boardId}.matches` }));
  ws.send(JSON.stringify({ type: "subscribe", channel: "autodarts.boards",  topic: `${boardId}.events` }));
};
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.type === "error") return;
  if (m.channel === "autodarts.boards" && m.data?.event === "start") {
    ws.send(JSON.stringify({ type: "subscribe", channel: "autodarts.matches", topic: `${m.data.id}.state` }));
  }
  if (m.channel === "autodarts.matches") console.log("Match-State", m.data);
};
```

### 15.5 Lobby anlegen, Spieler hinzufügen, starten
```bash
LOBBY=$(curl -s -X POST https://api.autodarts.com/gs/v0/lobbies -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"variant":"X01","isPrivate":true,"bullOffMode":"Normal","legs":3,
       "settings":{"baseScore":501,"inMode":"Straight","outMode":"Double","maxRounds":50,"bullMode":"25/50"}}' | jq -r .id)
curl -s -X POST https://api.autodarts.com/gs/v0/lobbies/$LOBBY/players -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d "{\"name\":\"Gast\",\"boardId\":\"$BOARD_ID\"}"
curl -s -X POST https://api.autodarts.com/gs/v0/lobbies/$LOBBY/start -H "Authorization: Bearer $TOKEN"
```

---

## 16. Historie und Breaking Changes

| Datum | Änderung | Beleg |
|---|---|---|
| 2023 | ESP32-Client nutzt Keycloak (`autodarts-app`, Passwort-Grant), Ticket über `/ms/v0/ticket`, WS `…/subscribe?ticket=` | [Q14-a] |
| bis v2.2.5 (Tools) | Token aus Cookie `Authorization=` gelesen | [Q11-a] |
| v2.2.6/2.2.7 (Tools) | Token aus Keycloak-Antwort bzw. `Authorization: Bearer`-Header | [Q11-a] |
| ca. 2025 | Winmau übernimmt Autodarts („vor etwa einem Jahr“, gesagt zur IFA 2026) | [Q2] |
| **28.06.2026** | **Keycloak abgeschaltet**, neuer OAuth-2.0-Server `/auth/v1` (Code+PKCE, Device, Client Credentials), Access-Token ~15 min | [Q11-a][Q16-c] |
| 2026 | Domainwechsel `*.autodarts.io` → `*.autodarts.com` (alte Domains leiten teils um) | [Q11-g][Q9] |
| 04.09.2026 | IFA-Launch „Winmau Autodarts“ (App, LENS, Autodarts X, Plus) | [Q1] |
| 21.10.2026 | Autodarts: keine Client-IDs für Dritte, kein Support für Schnittstellen | [Q16-d] |
| bis 31.10.2026 (Tag der Aufzeichnung) | Board Manager **2.1.0**: flaches Wurf-Format, camelCase, `/api/state/motion` entfällt, neuer Socket `/api/events/system`, Streams-Start/Stop 404 | [Q16-f][Q24] |
| 25.11.2026 | Aktuell: Desktop/Headless **2.1.1**; Board-Client-1.x **1.0.7**; WS-Broker `play.ws.autodarts.com` mit Ticket `?code=` | [Q23][Q9][Q7] |

---

## 17. Offene Punkte und Unsicherheiten

1. **Kein offizieller Vertrag:** Alle Cloud-Routen können sich ohne Ankündigung ändern [Q16-d].
2. **Request-Bodies** einiger Routen sind im Client nur als „durchgereichtes Objekt“ sichtbar (z. B. `POST /throws`, `POST /turns`, `PUT …/handicap`, Turnier-Objekte). Die Struktur ist dort nicht vollständig belegt.
3. **Autodarts X / LENS:** Ob Autodarts X einen lokalen Board Manager mit Port 3180 hat, ist nicht belegt [Q16-c]. LENS hat keinen lokalen Board Manager im Netz [Q16-d].
4. **Rate-Limits:** nicht dokumentiert.
5. **JWKS:** Der im Discovery-Dokument genannte `jwks_uri` lieferte am 25.11.2026 404 [Q9].
6. **Format 1.x/2.0:** Die 1.x/2.0-Beispiele in [Q16-f] wurden aus dokumentierten Formen gebaut, nicht von einem echten Gerät aufgezeichnet (anders als 2.1.0). Die Feldnamen bestätigen aber weitere unabhängige Quellen [Q14-b][Q20].
7. **Admin-Routen** (`admin/v0`, `ts/v0/tournaments/admin/…`) existieren im Client, sind aber für normale Konten gesperrt.
8. Eine Analyse der Desktop-/Headless-Binärdateien (z. B. auf weitere lokale Routen) wurde **nicht** gemacht.

---

## 18. Quellenverzeichnis

Alle Abrufe am **25.11.2026**. GitHub-Links mit festem Commit (Permalinks).

**Offiziell / Hersteller**
- **[Q1]** Winmau: „Winmau Redefines the Future of Darts With Launch of Autodarts Ecosystem“ (04.09.2026) – https://winmau.com/blogs/news/winmau-redefines-the-future-of-darts-with-launch-of-autodarts-ecosystem
- **[Q2]** T3: Interview mit dem Winmau-CEO zur Autodarts-App – https://www.t3.com/tech/gaming-accessories/so-many-people-have-dartboards-but-theyre-not-playing-winmaus-ceo-hopes-the-free-autodarts-app-can-change-the-tide
- **[Q3]** Winmau Autodarts X Produktseite – https://winmau.com/products/winmau-autodarts-x-automatic-darts-scoring-system
- **[Q4]** Winmau Autodarts Download/FAQ – https://winmau.com/pages/autodarts-download
- **[Q5]** Wikipedia „Winmau“ (Eigentümer Nodor) – https://en.wikipedia.org/wiki/Winmau
- **[Q6]** OIDC-Discovery – https://api.autodarts.com/.well-known/openid-configuration (auch unter https://api.autodarts.io/.well-known/openid-configuration)
- **[Q7]** Offizielle Web-App Autodarts Play – https://play.autodarts.com/ ; API-Clients: https://play.autodarts.com/assets/clients-wU0NewE_.js ; Auth-Modul: https://play.autodarts.com/assets/src-BXZV2BBH.js (Sentry-Release `c75bbd3176e263a1c6f28d30a24ffddcb3dd92d4`; Dateinamen ändern sich mit jedem Release)
- **[Q8]** Offizielle Auth-Oberfläche – https://auth.autodarts.io/link ; Bundle https://auth.autodarts.io/assets/index-GaYuv2e3.js und Chunks `link-Dq_u5-9U.js`, `authorize-CrBV1Ktn.js`, `scopes-list-DytiXOyj.js`, `account-CHaANNKu.js`, `login-BWOf49xc.js`, `register-BRx9Kuwn.js`
- **[Q9]** Eigene Prüfung am 25.11.2026: unauthentifizierte Requests (nur GET bzw. POST mit leerem Body) gegen die genannten Routen; ausgewertet wurden nur Statuscodes und Fehlermeldungen. Öffentlich lesbar: `https://api.autodarts.com/auth/v0/permissions`, `…/consent/v0/current`, `…/us/v0/profile/countries`, `…/user/v1/countries`, `…/bs/v0/board-client/releases/latest`, `https://discover.autodarts.com`
- **[Q21]** Autodarts-Doku-Repository `autodarts/docs` @ 2d11348 – https://github.com/autodarts/docs/tree/2d1134840dd52e04211c5b3f650d38fd9387d592
  - **a)** `content/en/getting-started/first-startup.md` (Board Manager unter `http://localhost:3180`, Board-ID und API-Key)
  - **b)** `content/en/config/_index.md` (Board Manager nur bis Version 0.x/1.x, ab v2 nicht unterstützt; alte Config-Parameter)
  - **c)** `content/en/FAQ/_index.md` (Board-ID und API-Key)
- **[Q22]** Autodarts User Guides – https://docs.autodarts.com/ (keine API-Doku)
- **[Q23]** Release-Manifeste – https://releases.autodarts.com/desktop/downloads/latest.stable.json , https://releases.autodarts.com/headless/downloads/latest.stable.json

**Community (Code und Aufzeichnungen)**
- **[Q11]** creazy231/tools-for-autodarts @ 505b684 – https://github.com/creazy231/tools-for-autodarts/tree/505b684a401f8fa4c352503b795483e91d8a6a05
  - **a)** `AUTH_CHANGES.md` und `entrypoints/auth-cookie.ts` (Keycloak-Abschaltung 28.06.2026, neue Auth-Endpunkte, 15-min-Token)
  - **b)** `utils/websocket-helpers.ts`, `utils/board-data-storage.ts` (Kanäle, Typen IMatch/ILobbies/IBoard)
  - **c)** `utils/lobby-guests.ts`, `entrypoints/lobby.content/local-lobby.ts` (Spieler/Gäste/Bots, Verschieben, Entfernen)
  - **d)** `entrypoints/match.content/QuickCorrection.vue` (Corrections, PATCH throws)
  - **e)** `utils/teams-undo.ts`, `entrypoints/background.ts` (Undo + players/next)
  - **g)** `CHANGELOG.md` Zeile 418 (Umzug auf `api.autodarts.com` / `boards.ws.autodarts.com`)
- **[Q12]** lbormann/darts-caller @ b267eab – https://github.com/lbormann/darts-caller/tree/b267eabceb67ff29f40c09829990a72c94d1e331
  - **a)** `darts-caller.py` (REST-URLs Z. 125–131, WS mit Bearer-Header Z. 5012, Abos/Events Z. 1179 ff. und 5074 ff.)
  - **b)** `assets/autodarts_keycloak_client.py` (alter Keycloak-Login)
- **[Q13]** lbormann/darts-hub @ baddaf7, README „Connect darts-caller to your Autodarts account“ (Device-Link, `auth.autodarts.io/link`, 8-stelliger Code) – https://github.com/lbormann/darts-hub/blob/baddaf76d8f75d912d49225fa41ea782b3112751/README.md
- **[Q14]** Chade/AutodartsClient @ 4966592 (2023) – https://github.com/Chade/AutodartsClient/tree/49665920963d5a1a474ced248cd5a5fb6b3a2092
  - **a)** `AutodartsDefines.h` Z. 163–170 (Keycloak `autodarts-app`, `/ms/v0/ticket`, lokaler WS `/api/events`)
  - **b)** `AutodartsDefines.h` (Status-/Event-Strings), `AutodartsDetector.h` (State-Felder)
  - **c)** `AutodartsBoard.h` (lokaler WebSocket)
- **[Q15]** thomasasen/autodarts_local_tournament @ d577f59, `docs/autodarts-api-capabilities.md` – https://github.com/thomasasen/autodarts_local_tournament/blob/d577f59a7bf77b4ca2dd02fd1cbd2945b5ff7dd7/docs/autodarts-api-capabilities.md
- **[Q16]** Dennis-Otto/homedarts-for-autodarts (früher ha-autodarts) @ f80a502 – https://github.com/Dennis-Otto/homedarts-for-autodarts/tree/f80a50297322855d587c480536fa9a8228d2b99f
  - **a)** `custom_components/homedarts/local_api.py` (alle lokalen Routen, Befehle Z. 68 ff., Sockets Z. 37–38, Config-Schreiben Z. 682 ff.)
  - **b)** `custom_components/homedarts/discovery.py`, `const.py` Z. 45 (`discover.autodarts.com`)
  - **c)** `docs/decisions/0020-a-public-client-for-the-cloud-link.md` (Auth-Service, Device-Grant, Token-Laufzeiten, Leitfaden von Autodarts)
  - **d)** `docs/decisions/0025-no-cloud-link.md` (Antwort von Autodarts vom 21.10.2026) und `0002-local-api-of-the-board-manager.md`
  - **e)** Tag `v1.18.0`, `custom_components/autodarts/api.py` (Device-Flow-Implementierung, Fehlercodes, Refresh) – https://github.com/Dennis-Otto/homedarts-for-autodarts/blob/v1.18.0/custom_components/autodarts/api.py
  - **f)** `tests/fixtures/board_manager/` (README, Ordner `1.0.7`, `2.0.0`, `2.0.2`, `2.1.0` – **2.1.0 ist eine echte Aufzeichnung vom 31.10.2026**) und `tests/fixtures/board_manager_2.1.0_*.jsonl`
- **[Q17]** Dennis-Otto/player-switch-for-autodarts @ 9c931be – https://github.com/Dennis-Otto/player-switch-for-autodarts/tree/9c931bed37a76dddd87b203e9e3e10cf69b103d7
  - **a)** `src/autodarts.ts` (Auth-Basis, `client_id` `autodarts-play`, `autodarts_refresh_token`, `/login`, `/refresh`, `/logout`, Lobby-Join, Boards)
  - **b)** `test/e2e/fake/recorded.ts` (echte Antworten des Auth-Service vom 12.11.2026 mit erfundenen Daten; Board-Antwortform vom 14.11.2026)
  - **c)** `docs/help.md` (Google-/Apple-Konten haben kein Autodarts-Passwort)
- **[Q18]** Wadim-dev/Autodarts_ha @ fe4f16f, `custom_components/autodarts/board.py` (u. a. `/api/devices`, Bild-/Stream-Pfade, `/api/update/apply`, Kalibrier-Ellipsen) – https://github.com/Wadim-dev/Autodarts_ha/blob/fe4f16fc36d097595997268d22526c14ad92e165/custom_components/autodarts/board.py
- **[Q19]** ioBroker-Bot/ioBroker.autodarts @ 40438ef, README (Kompatibilität v2) – https://github.com/ioBroker-Bot/ioBroker.autodarts/blob/40438efc997594536e21f03d286f9142e9ea7307/README.md
- **[Q20]** FluxieGG/darts-dashboard @ 9142503 (lokale API ohne Login, `/api/streams/live`, Koordinatensystem) – https://github.com/FluxieGG/darts-dashboard/blob/9142503de36a5f0f0af4f99610a42c44749a201f/autodarts_modular_stats_dashboard_specification.md
- **[Q24]** homedarts-for-autodarts PR #531 und Issue #521 (Änderungen in Board Manager 2.1: `/api/events/system`, `/api/state/motion` 404, Streams 404) – https://github.com/Dennis-Otto/homedarts-for-autodarts/pull/531 , https://github.com/Dennis-Otto/homedarts-for-autodarts/issues/521

---

*Diese Dokumentation ist inoffiziell und steht in keiner Verbindung zu Winmau, Nodor oder Autodarts. Nutze die Cloud-API nur mit deinem eigenen Account und auf eigenes Risiko.*
