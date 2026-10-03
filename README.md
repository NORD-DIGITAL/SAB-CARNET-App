# SAB-CARNET — By NORD DIGITAL

Carnet personnel (sans plafond de budget) : dépenses, cartes bancaires et retraits, caisse business séparée,
petit commerce (stock, ventes échelonnées, encaissements), dettes dans les deux sens.
Déclinaison client de **Budget.Go.Family** (même socle : inscription, empreinte, Go Code, blocage des anciennes versions).

## Ce que fait la version 1.0

- **Accueil** : solde *Espèces perso* et *Caisse business*, dépenses perso du mois, « On me doit » / « Je dois ».
- **Bouton +** : dépense, retrait DAB (carte → espèces ou caisse business, frais comptés), virement entre caisses,
  vente, versement client, achat de stock, frais business, emprunt, prêt.
- **Business** : ventes (comptant ou échelonné avec échéancier, retards, rappel WhatsApp), stock, achats et frais, bilan du mois.
- **Dettes** : par personne, ventes à crédit + prêts (on me doit) et emprunts (je dois), remboursements partiels.
- **Historique** : toutes les opérations, filtres, export Excel (CSV).
- **Compte** : cartes (nom + 4 derniers chiffres), caisses, catégories, abonnement Go Code, admin.

Prévu ensuite : Sport (établissements, coachs indépendants), Beauté, Projets, Investissements/collaborations
(les tables existent déjà dans la base).

## Base de données (Supabase, projet « SAB-CARNET-App »)

Les fichiers `supabase/migrations/*.sql` décrivent toute la base, dans l'ordre. Ils sont **déjà appliqués** sur le projet.
Sécurité : chaque compte ne voit que ses propres lignes (RLS sur toutes les tables).

Après ta première inscription dans l'app, rends-toi administrateur (SQL Editor) :

```sql
insert into public.app_admins(user_id) select id from auth.users where email = 'TON_EMAIL';
```

## Publier

- **APK Android** : chaque push sur `main` lance « Construire l'APK Android » → Releases › `apk-latest` › `SabCarnet.apk`.
- **Web / iPhone (PWA)** : le workflow « Publier le site web » pousse `dist/` sur la branche `gh-pages`
  (Settings › Pages › branche `gh-pages`). Sur iPhone : Safari → Partager → Sur l'écran d'accueil.

Les clés Supabase utilisées par l'app sont dans `.env.production` : ce sont des clés **publiques** (prévues pour ça).
Ne jamais y mettre la clé `service_role`.

## Nouvelle version

1. Augmente `APP_VERSION` et `APP_LABEL` dans `src/lib/version.ts`.
2. Après publication, mets `latest_version` (et `min_version` pour bloquer les anciennes) dans la table `app_config`.

## Développement

```bash
npm install
npm run dev      # aperçu
npm run build    # production (dist/)
```

Structure : `src/screens` (Home, Business, Dettes, Historique, Compte, Moyens), `src/components` (formulaires dans
OpsForms, BizForms, DebtForms ; FormHost ouvre les feuilles), `src/lib/derive.ts` (soldes, stock, retards — même logique
que les vues SQL), `src/lib/data.tsx` (chargement Supabase).
