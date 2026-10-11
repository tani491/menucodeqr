# Audit sécurité et SEO — MenuCraft

## Configuration de production

- `NEXTAUTH_SECRET` : secret aléatoire obligatoire, sans valeur de secours connue. Sa rotation invalide les anciennes sessions.
- `NEXT_PUBLIC_SITE_URL` : `https://menucodeqr.vercel.app` par défaut ; remplacer après réservation et configuration du domaine.
- `PUBLIC_DEMO_SLUGS` : `demo,la-playa` par défaut. Le sitemap publie uniquement les menus existants et actifs.
- Firebase Admin : `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` valides sont nécessaires aux écritures serveur, à la lecture des menus publics et au suivi public des commandes. Les prix sont relus depuis Firestore, jamais acceptés depuis le panier. Le serveur publie uniquement les champs du menu et garde l’email du gérant et son UID privés.
- Les profils administrateurs doivent avoir le rôle exact `super_admin`. L’ancien rôle `admin` n’est plus promu implicitement. Vérifier les profils existants dans Firebase avant la mise en production.

## Barrières mises en place

Le proxy Next.js vérifie le JWT pour `/admin`, `/dashboard` et leurs API. Les API conservent leurs contrôles de rôle et de restaurant. Les mutations Firestore des plats et de l’identité du restaurant vérifient aussi l’appartenance dans la base et les catégories dans une transaction. Aucun identifiant provenant du stockage navigateur ne constitue une autorisation.

Les requêtes API inter-origines sont refusées. Une mutation exige une origine correspondante ou `Sec-Fetch-Site: same-origin`. Les clients serveur doivent transmettre l’origine du site ; les routes NextAuth conservent également leur protection CSRF native. Aucune origine tierce n’est autorisée par CORS.

Les schémas Zod rejettent champs supplémentaires, valeurs non finies, prix négatifs, tables contenant du HTML et images de plats dépassant 200 000 caractères Base64. Les libellés de table sont affichés comme texte React et assainis lors de la lecture des anciennes commandes. Les trois statuts de commande restent `pending`, `ready`, `delivered`.

Le client public soumet une commande à `/api/menu-orders`; sa réponse contient un jeton aléatoire de suivi conservé dans l’onglet. Seule son empreinte est enregistrée dans `order_access`. Les commandes sont suivies par interrogation toutes les cinq secondes ; l’écoute Firestore temps réel de la cuisine est conservée. Les paniers et commandes actives utilisent `sessionStorage`. Le cache persistant Firestore partagé a été retiré pour éviter de conserver des commandes privées entre comptes.

## Firebase : étape de déploiement indispensable

Les fichiers `firestore.rules` et `firestore.indexes.json` sont préparés dans le dépôt. **Un commit ou un déploiement Vercel ne déploie pas ces fichiers Firebase.** Avec un compte Firebase autorisé, contrôler les profils, comparer les règles en vigueur, tester dans l’émulateur puis déployer vers le projet voulu :

```sh
firebase deploy --only firestore:rules,firestore:indexes --project codeqrmenu-525a7
```

Ne pas écraser à l’aveugle des règles déployées concernant des collections supplémentaires. Le dépôt couvre `users`, `accounts`, `restaurants`, `categories`, `dishes`, `items`, `orders`, `order_access`, `testimonials`, `site_settings`. Les informations de menus restent publiques ; les commandes et profils d’autres restaurateurs sont privés. Les règles interdisent les écritures anonymes de commandes et les écritures directes de plats par les restaurateurs, désormais réalisées par les API serveur.

La garantie d’isolation Firestore dépend de ces règles effectivement déployées : les vérifications React et les schémas client ne suffisent pas. Le projet local ne dispose pas d’un accès Firebase Admin valide permettant de certifier les règles en production. Les index doivent également atteindre l’état Ready dans Firebase.

## SEO et limites

Metadata, canonical, OpenGraph/Twitter, aperçu PNG 1200×630, robots et sitemap sont fournis. Le JSON-LD décrit SoftwareApplication, Organization et Service, sans inventer de gratuité, de prix ni d’avis réels. Le design visible conserve son nom MenuLive conformément à la consigne de conservation visuelle ; les métadonnées demandées utilisent MenuCraft. Harmoniser la marque visible lors d’un futur changement éditorial.

Le crawl est autorisé sur les pages publiques et exclu sur `/admin`, `/dashboard`, `/api/`. L’exclusion robots n’est pas une protection d’accès ; les contrôles serveur s’appliquent séparément. Le référencement ne garantit ni la première place ni une recommandation par les IA. La compression réduit la charge mais ne garantit pas 300 ms sur tous les réseaux.
