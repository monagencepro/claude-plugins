# maw-events

Plugin Claude Code qui logue les events (prompts, utilisations d'outils, tokens, modèle, durée) vers **Mon Agence Web**, pour analyser le temps passé, les modèles utilisés et les coûts par collaborateur et par projet.

## Installation

```bash
/plugin marketplace add monagenceweb-app/claude-plugins
/plugin install maw-events@monagenceweb
```

Au **prochain démarrage** de Claude Code, le plugin détecte que la machine
n'est pas encore liée et affiche une URL + un code. Ouvre l'URL (tu es déjà
connecté à la plateforme dans ton navigateur), choisis le workspace, clique
**Autoriser** → l'enregistrement s'active **automatiquement** dans les
secondes qui suivent. Aucun token à copier-coller.

Pour (re)lier une machine à la demande :

```
/maw-login
```

## Comment ça marche

- Hooks `UserPromptSubmit` / `PostToolUse` / `Stop` → envoient un event compact à l'API d'ingestion. Les tokens / modèle / durée sont extraits du transcript de session.
- Hook `SessionStart` → si la machine n'est pas liée, lance le **device flow OAuth** (RFC 8628) et affiche le lien d'autorisation.
- Liaison OAuth : aucun secret n'est embarqué dans le plugin. L'autorisation mint un token côté plateforme, rapatrié **une seule fois** et stocké localement dans `~/.claude/hooks/.maw-token`.

## Dépendances

**Uniquement `node`** — déjà présent puisque Claude Code tourne dessus
(Node ≥ 18 pour `fetch` natif). Pas de python, pas de curl, pas de jq, pas de
git requis.

## Configuration (avancé)

| Variable | Défaut | Rôle |
|---|---|---|
| `MAW_TOKEN` | _(vide)_ | Court-circuite la liaison OAuth avec un token explicite. Sinon lu depuis `~/.claude/hooks/.maw-token`. |
| `MAW_BASE_URL` | `https://platform.monagenceweb.app` | Base de la plateforme (device flow + ingestion). |
| `MAW_ENDPOINT` | `$MAW_BASE_URL/api/claude/events` | Endpoint d'ingestion (override fin). |

## Confidentialité / révocation

Le token reste local. Pour couper l'envoi : désactive le plugin
(`/plugin`), supprime `~/.claude/hooks/.maw-token`, ou révoque le token
depuis ton profil sur la plateforme. Le hook **fail-open** : token manquant
ou erreur → sortie 0, Claude Code n'est jamais bloqué. Journal de debug dans
`~/.claude/hooks/maw-events.log`.
