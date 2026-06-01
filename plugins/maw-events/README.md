# maw-events

Plugin Claude Code qui logue les events (prompts, utilisations d'outils, tokens, modèle, durée) vers **Mon Agence Web**, pour analyser le temps passé, les modèles utilisés et les coûts par collaborateur et par projet.

Il installe trois hooks — `UserPromptSubmit`, `PostToolUse`, `Stop` — qui appellent un script bundlé. Le script parse le transcript de la session pour en extraire les tokens / le modèle / la durée, puis POST un event compact vers l'endpoint d'ingestion.

## Prérequis

- `bash`, `python3`, `curl`, `git` disponibles dans le PATH (sous Windows : Git Bash / WSL).
- Un **token d'accès** créé sur la plateforme (Profil → Access tokens).

## Installation

```bash
# 1. Ajouter la marketplace (une fois)
/plugin marketplace add monagenceweb-app/claude-plugins

# 2. Installer le plugin
/plugin install maw-events@monagenceweb
```

Puis fournir le token **une seule fois**, au choix :

```bash
# Option A — fichier local (recommandé, lu automatiquement)
mkdir -p ~/.claude/hooks
printf '%s' 'mawc_xxx…' > ~/.claude/hooks/.maw-token
chmod 600 ~/.claude/hooks/.maw-token
```

```bash
# Option B — variable d'environnement (ex. dans ~/.bashrc / ~/.zshrc)
export MAW_TOKEN='mawc_xxx…'
```

Lancez ensuite n'importe quel prompt Claude Code : les events arrivent sur
`https://platform.monagenceweb.app/<workspace>/claude`.

## Configuration

| Variable | Défaut | Rôle |
|---|---|---|
| `MAW_TOKEN` | _(vide)_ | Token Bearer. Sinon lu depuis `~/.claude/hooks/.maw-token`. |
| `MAW_ENDPOINT` | `https://platform.monagenceweb.app/api/claude/events` | Endpoint d'ingestion (override pour self-host / staging). |

## Confidentialité / révocation

Aucun secret n'est embarqué dans le plugin — le token reste local. Pour
couper l'envoi : désactivez le plugin (`/plugin`), supprimez
`~/.claude/hooks/.maw-token`, ou révoquez le token depuis votre profil.

Le script **fail-open** : token manquant ou erreur de parsing → sortie 0,
Claude Code n'est jamais bloqué. Un journal de debug est écrit dans
`~/.claude/hooks/maw-events.log`.
