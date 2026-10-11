# Gestion Landing Page

Ouvrir `/admin/marketing` avec une session NextAuth `super_admin`.
Le lien « Gestion Landing Page » est disponible sur `/admin`.

## Firestore

Les collections sont créées automatiquement à la première sauvegarde :

- `testimonials/{id}` : `id`, `restaurantName`, `ownerName`, `comment`, `rating`, `avatarBase64`, `isActive`, `createdAt` (horodatage serveur).
- `site_settings/marketing` : `whatsappNumber`, `defaultMessage`, `demoImageBase64`, `stats.totalRestaurants`, `stats.satisfactionRate`.

Configurer `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL` et `FIREBASE_PRIVATE_KEY` côté serveur (voir `.env.local.example`). Aucune clé de service ne doit être exposée au navigateur.

Les mutations passent par `/api/admin/marketing` : session super administrateur, contrôle d’origine et validation des données. `/api/marketing` expose uniquement les trois derniers avis actifs et les paramètres publics. Aucun index composite n’est nécessaire. Le panneau `/login` recharge à l’ouverture, au retour sur la fenêtre et toutes les 30 secondes pendant que la page est visible. Une panne marketing ne bloque pas la connexion.

Les formulaires sauvegardent immédiatement dans Firestore à leur validation. Les images sont conservées en Base64, avec une limite de 500 Ko par image pour respecter la taille maximale des documents. Le numéro WhatsApp utilise le format international sans `+` ni espaces. Un numéro vide masque le bouton. Les statistiques à zéro sont masquées ; aucun avis fictif n’est inséré.

## Règles de sécurité

L’accès marketing utilise Firebase Admin côté serveur. Les clients Firebase ne nécessitent aucun accès direct à ces collections. Ajouter ces clauses dans les règles existantes si elles ne sont pas déjà restrictives :

```text
match /testimonials/{id} {
  allow read, write: if false;
}
match /site_settings/{id} {
  allow read, write: if false;
}
```

Les autorisations Firestore sont additives : une règle globale permissive peut toujours autoriser ces chemins. Adapter cette règle globale pour exclure les collections marketing ; ne pas remplacer les règles des plats, commandes ou tables. Les règles ne sont pas déployées par ce module.

## Vérification fonctionnelle

1. Depuis un compte super administrateur, ajouter un avis et configurer WhatsApp, une image et les statistiques.
2. Ouvrir `/login` sans session : vérifier le visuel, les valeurs et le lien WhatsApp avec message encodé.
3. Modifier puis désactiver l’avis : vérifier son retrait après actualisation. Le réactiver puis le supprimer.
4. Vérifier que seuls les trois derniers avis actifs s’affichent.
5. Tester un compte restaurateur : l’API admin doit retourner 403 ; sans session, 401.
6. Tester la connexion habituelle et les redirections restaurateur/admin.
7. Tester une image trop lourde et une configuration invalide : aucune écriture ne doit être faite.
