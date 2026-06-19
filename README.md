# Mon Agence Web — Claude Code plugins

Marketplace de plugins Claude Code pour [Mon Agence Web](https://app.monagence.pro).

## Utilisation

```bash
/plugin marketplace add monagencepro/claude-plugins
/plugin install events@monagence
```

## Plugins

| Plugin | Description |
|---|---|
| [`events`](./plugins/events) | Logue les events Claude Code (prompts, tools, tokens, modèle, durée) vers Mon Agence Web pour l'analyse du temps et des coûts par collaborateur et par projet. |

## Déploiement par équipe (optionnel)

Pour pré-câbler la marketplace et activer le plugin sans action manuelle des
collaborateurs, ajoutez à un `.claude/settings.json` (projet ou global) :

```json
{
  "extraKnownMarketplaces": {
    "monagence": {
      "source": { "source": "github", "repo": "monagencepro/claude-plugins" }
    }
  },
  "enabledPlugins": {
    "events@monagence": true
  }
}
```

> Les noms de clés (`extraKnownMarketplaces`, `enabledPlugins`) sont à recouper
> avec la doc de votre version de Claude Code avant déploiement large.
