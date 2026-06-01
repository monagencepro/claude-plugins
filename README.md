# Mon Agence Web — Claude Code plugins

Marketplace de plugins Claude Code pour [Mon Agence Web](https://platform.monagenceweb.app).

## Utilisation

```bash
/plugin marketplace add monagenceweb-app/claude-plugins
/plugin install maw-events@monagenceweb
```

## Plugins

| Plugin | Description |
|---|---|
| [`maw-events`](./plugins/maw-events) | Logue les events Claude Code (prompts, tools, tokens, modèle, durée) vers Mon Agence Web pour l'analyse du temps et des coûts par collaborateur et par projet. |

## Déploiement par équipe (optionnel)

Pour pré-câbler la marketplace et activer le plugin sans action manuelle des
collaborateurs, ajoutez à un `.claude/settings.json` (projet ou global) :

```json
{
  "extraKnownMarketplaces": {
    "monagenceweb": {
      "source": { "source": "github", "repo": "monagenceweb-app/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "maw-events@monagenceweb": true
  }
}
```

> Les noms de clés (`extraKnownMarketplaces`, `enabledPlugins`) sont à recouper
> avec la doc de votre version de Claude Code avant déploiement large.
