# Photo Coverage Routing API

This GraphHopper fork adds two boolean encoded values on every graph edge based on Panoramax photo coverage data:

| Encoded value | Meaning |
|---|---|
| `photo_coverage` | L'edge est couvert par au moins une photo (toutes sources) |
| `photo_coverage_only360` | L'edge est couvert **uniquement** par des photos 360° |

Ces valeurs sont calculées à l'import du graphe depuis le fichier GeoJSON généré par `tools/panoramax_preprocess.py`. Elles sont ensuite disponibles dans les `custom_model` de toutes les requêtes de routing.

---

## Endpoint

```
POST /route
Content-Type: application/json
```

> Le GET `/route` est disponible mais ne permet pas d'envoyer un `custom_model`. Utiliser POST pour le routing photo.

### Paramètres obligatoires

| Champ | Type | Description |
|---|---|---|
| `points` | `[[lng, lat], ...]` | Minimum 2 points, coordonnées en WGS84 |
| `profile` | `string` | `car`, `foot` ou `bike` |
| `ch.disable` | `boolean` | **Doit être `true`** pour utiliser un `custom_model` |

### Paramètres optionnels

| Champ | Type | Description |
|---|---|---|
| `details` | `string[]` | Détails à retourner par segment (voir plus bas) |
| `locale` | `string` | Langue des instructions (ex: `fr`) |
| `instructions` | `boolean` | Inclure les instructions turn-by-turn (défaut: `true`) |
| `points_encoded` | `boolean` | Encoder le tracé en polyline (défaut: `true`) |

---

## Custom Model — Routing photo

Le `custom_model` permet de pénaliser les edges selon les valeurs photo. Le champ `priority` multiplie le "désir" d'emprunter un edge (1 = neutre, < 1 = évité, proche de 0 = fortement évité).

### Éviter toutes les zones avec photos

```json
{
  "points": [[1.9, 47.9], [2.0, 47.85]],
  "profile": "car",
  "ch.disable": true,
  "custom_model": {
    "priority": [
      { "if": "photo_coverage", "multiply_by": "0.1" }
    ],
    "distance_influence": 50
  }
}
```

### Éviter uniquement les zones avec photos 360°

```json
{
  "points": [[1.9, 47.9], [2.0, 47.85]],
  "profile": "car",
  "ch.disable": true,
  "custom_model": {
    "priority": [
      { "if": "photo_coverage_only360", "multiply_by": "0.1" }
    ],
    "distance_influence": 50
  }
}
```

### Régler le poids d'évitement

Le `multiply_by` contrôle l'intensité de l'évitement. La valeur doit être entre `0` (exclusif) et `1` :

| `multiply_by` | Comportement |
|---|---|
| `"1.0"` | Pas d'évitement (désactivé) |
| `"0.5"` | Légère préférence pour les zones sans photos |
| `"0.2"` | Fort évitement, accepte un détour notable |
| `"0.05"` | Évitement maximal, ne passe que si aucune alternative |

Le `distance_influence` (0–100+) contrôle le compromis entre distance et priorité :
- Valeur haute → accepte de longs détours pour éviter les photos
- Valeur basse → préfère rester court même si des photos sont présentes

### Combiner les deux conditions

```json
{
  "custom_model": {
    "priority": [
      { "if": "photo_coverage_only360", "multiply_by": "0.05" },
      { "else_if": "photo_coverage", "multiply_by": "0.3" }
    ],
    "distance_influence": 60
  }
}
```

> Ici les zones 360° sont fortement évitées, les zones avec photos ordinaires sont modérément évitées.

---

## Récupérer la couverture photo par segment

Ajouter `"details": ["photo_coverage", "photo_coverage_only360"]` pour recevoir la couverture photo de chaque segment du tracé.

### Requête

```json
{
  "points": [[1.9, 47.9], [2.0, 47.85]],
  "profile": "car",
  "ch.disable": true,
  "details": ["photo_coverage", "photo_coverage_only360"],
  "custom_model": {
    "priority": [
      { "if": "photo_coverage", "multiply_by": "0.1" }
    ],
    "distance_influence": 50
  }
}
```

### Format de réponse des détails

```json
{
  "paths": [{
    "details": {
      "photo_coverage": [
        [0, 14, false],
        [14, 27, true],
        [27, 45, false]
      ],
      "photo_coverage_only360": [
        [0, 27, false],
        [27, 45, true]
      ]
    }
  }]
}
```

Chaque entrée est `[index_point_début, index_point_fin, valeur]`. Les index font référence au tableau `points` du chemin (polyline décodée si `points_encoded: false`).

---

## Exemple complet

```json
POST /route

{
  "points": [[1.9, 47.9], [2.0, 47.85]],
  "profile": "bike",
  "ch.disable": true,
  "locale": "fr",
  "points_encoded": false,
  "details": ["photo_coverage", "photo_coverage_only360", "road_class"],
  "custom_model": {
    "priority": [
      { "if": "photo_coverage_only360", "multiply_by": "0.05" },
      { "else_if": "photo_coverage", "multiply_by": "0.3" }
    ],
    "distance_influence": 70
  }
}
```

---

## Mode « couverture maximale » — ne pas repasser deux fois

Deux paramètres optionnels du POST `/route` pénalisent les edges déjà empruntés par les
tronçons précédents du trajet (waypoints intermédiaires), dans **les deux sens**. Au lieu
d'un aller-retour vers un waypoint, la route revient par une boucle.

| Champ | Type | Défaut | Description |
|---|---|---|---|
| `avoid_traversed_edges` | `boolean` | `false` | Active le mode. Nécessite `ch.disable: true`. |
| `traversed_edge_factor` | `number` | `0.1` | Facteur de priorité dans `(0, 1]`. `1.0` = neutre, proche de `0` = quasi-interdit. Le poids d'un edge déjà emprunté est multiplié par `1/facteur`. |

```json
{
  "points": [[1.9, 47.9], [1.95, 47.88], [2.0, 47.85]],
  "profile": "bike",
  "ch.disable": true,
  "avoid_traversed_edges": true,
  "traversed_edge_factor": 0.1
}
```

- Sans waypoint intermédiaire (2 points), le mode est sans effet : un plus court chemin
  ne repasse jamais deux fois sur le même edge à l'intérieur d'un tronçon.
- La pénalité est **souple** : une impasse menant à un waypoint reste franchissable,
  le routeur ne réutilise un edge qu'en dernier recours.
- Incompatible avec `algorithm=alternative_route` et avec le mode CH (speed mode).

---

## Notes importantes

- **`ch.disable: true` est obligatoire** dès qu'un `custom_model` est présent. Sans ça, l'API retourne une erreur.
- Les valeurs photo sont calculées **une fois à l'import** du graphe. Si le fichier parquet change, il faut supprimer le cache (`/data/graph-cache`) et redémarrer.
- Si le fichier `panoramax_coverage.geojson` n'est pas présent au démarrage (parquet absent), `photo_coverage` et `photo_coverage_only360` sont tous `false` sur l'ensemble du graphe.
