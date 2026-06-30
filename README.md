# Menu QR — Application Multi-Tenant de Menus Digitaux

Application web complète de gestion de menus de restaurants avec génération de QR Codes, upload d'images et vidéos, et interface publique mobile-first. Architecture multi-tenant avec séparation stricte des rôles.

---

## Table des matières

1. [Fonctionnalités](#fonctionnalités)
2. [Architecture](#architecture)
3. [Technologies](#technologies)
4. [Structure du projet](#structure-du-projet)
5. [Installation et démarrage local](#installation-et-démarrage-local)
6. [Variables d'environnement](#variables-denvironnement)
7. [Commandes disponibles](#commandes-disponibles)
8. [Identifiants de connexion](#identifiants-de-connexion)
9. [Routes et pages](#routes-et-pages)
10. [API Routes](#api-routes)
11. [Sécurité](#sécurité)
12. [Génération des QR Codes](#génération-des-qr-codes)
13. [Upload de fichiers](#upload-de-fichiers)
14. [Déploiement en production (Vercel)](#déploiement-en-production-vercel)
15. [Configuration Firebase (production)](#configuration-firebase-production)
16. [Dépannage](#dépannage)

---

## Fonctionnalités

### Menu public (`/menu/[slug]`)

- **Page mobile-first** optimisée pour les téléphones des clients
- Bannière et logo du restaurant avec dégradé
- Navigation par catégories (tabs horizontaux scrollables)
- Cartes de plats avec photo, nom, description et prix
- **Lecture vidéo intégrée** (MP4) pour les plats avec `videoUrl`
- Indicateur visuel de disponibilité (les plats indisponibles sont grisés/barrés)
- Filtrage par catégorie en un tap
- **ISR (Incremental Static Regeneration)** — revalidation toutes les 60 secondes
- Cache en mémoire + React `cache()` pour déduplication des requêtes
- SEO complet : meta title, description, OpenGraph par restaurant
- Page d'accueil `/` affiche le menu du restaurant de démo

### Dashboard Restaurateur (`/dashboard`)

- **Statistiques** : nombre de catégories, de plats, de plats disponibles
- **Gestion du menu par catégorie** : liste groupée de tous les plats
- **Toggle switch** de disponibilité en un clic (optimistic update)
- **Ajout/modification de plats** via dialog avec :
  - Nom, description, prix, catégorie (Select)
  - **Upload d'image** (JPG/WebP, max 5 Mo) ou URL externe
  - **Upload de vidéo** (MP4, max 10 Mo) ou URL externe
  - Checkbox de disponibilité
- **Suppression de plats** avec confirmation
- **Générateur de QR Code** haute définition :
  - Format PNG (1024px) et SVG vectoriel
  - Téléchargement direct
  - URL dynamique basée sur `NEXT_PUBLIC_SITE_URL`
- **Lien direct** vers la page publique du menu
- Déconnexion

### Administration Super Admin (`/admin`)

- **Statistiques globales** : restaurants, plats total, utilisateurs
- **Tableau de tous les restaurants** avec slug, nombre de catégories/plats/utilisateurs
- **Création de restaurant** avec :
  - Nom et slug (auto-généré à partir du nom, normalisation NFD)
  - URL de logo et bannière (optionnel)
  - 4 catégories par défaut créées automatiquement (Entrées, Plats, Desserts, Boissons)
  - Validation backend du slug (minuscules, chiffres, tirets, unicité)
- **Invitation de restaurateur** avec :
  - Nom, email, mot de passe
  - Sélection du restaurant par radio buttons
  - Le rôle est **toujours forcé à `restaurateur`** (impossible de créer un autre super_admin)
  - Validation d'unicité de l'email
- **Lien "Voir"** pour ouvrir le menu public de chaque restaurant
- Déconnexion

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                         Naviguateur Client                        │
├──────────┬──────────────────┬───────────────────┬────────────────┤
│  /login  │  /menu/[slug]    │   /dashboard      │    /admin       │
│ (public) │  (public, ISR)   │ (restaurateur)    │ (super_admin)  │
├──────────┴──────────┬───────┴─────────┬─────────┴────────────────┤
│                     │  Middleware    │                            │
│   Pages publiques   │  (vérification │   Pages protégées         │
│   (pas de check)    │   rôle serveur)│   (redirect si non-auth)  │
├─────────────────────┴───────────────┴───────────────────────────┤
│                        API Routes                                │
│  /api/menu/[slug]       → public, cache 60s                     │
│  /api/dashboard/*       → requireRestaurateur() (JWT)           │
│  /api/admin/*           → requireAuth() + rôle super_admin      │
│  /api/auth/*            → NextAuth credentials                  │
├─────────────────────────────────────────────────────────────────┤
│                      Couche Données                               │
│  Données métier : Prisma    │    Auth/Storage : Firebase         │
│  Sessions       : NextAuth  │    Admin SDK    : Firebase         │
└─────────────────────────────────────────────────────────────────┘
```

### Modèle de données

```
Restaurant (id, slug, name, logoUrl, bannerUrl)
  └── Category[] (id, name, sortOrder)
        └── Item[] (id, name, description, price, imageUrl, videoUrl, isAvailable)

User (id, name, email, password, role, restaurantId?)
  - role = "super_admin" (gère tous les restaurants, pas de restaurantId)
  - role = "restaurateur" (lié à exactement 1 restaurant)
```

### Flux d'authentification

1. L'utilisateur se connecte via `/login` avec email + mot de passe
2. NextAuth valide les credentials contre la DB (bcrypt)
3. Un JWT est signé contenant : `id`, `role`, `restaurantId`
4. Le middleware vérifie le rôle avant le rendu de `/admin/*` et `/dashboard/*`
5. Les API routes vérifient le rôle + le `restaurantId` depuis le JWT (pas du body)

---

## Technologies

| Technologie | Version | Usage |
|---|---|---|
| Next.js | 16.1 (App Router) | Framework React avec SSR/SSG/ISR |
| React | 19 | UI |
| TypeScript | 5 | Typage statique |
| Tailwind CSS | 4 | Styles utilitaires |
| shadcn/ui | latest | Composants UI (Radix) |
| Prisma | 6 | ORM (SQLite local / PostgreSQL prod) |
| NextAuth | 4 | Authentification (JWT strategy) |
| bcryptjs | 3 | Hashage des mots de passe |
| qrcode | 1.5 | Génération QR Code (PNG/SVG) |
| Lucide React | latest | Icônes |
| Sonner | 2 | Toasts notifications |

---

## Structure du projet

```
src/
├── app/
│   ├── layout.tsx              # RootLayout avec AuthProvider + Toaster
│   ├── page.tsx                # Page d'accueil (menu démo)
│   ├── globals.css             # Tailwind CSS 4 + shadcn/ui theme
│   ├── login/page.tsx          # Page de connexion (Suspense + useSearchParams)
│   ├── admin/page.tsx          # Dashboard super_admin (client component)
│   ├── dashboard/page.tsx      # Dashboard restaurateur (client component)
│   ├── menu/[slug]/page.tsx    # Menu public (SSG + ISR, revalidate 60s)
│   └── api/
│       ├── auth/[...nextauth]/route.ts  # NextAuth handler
│       ├── menu/[slug]/route.ts         # API menu public
│       ├── admin/
│       │   ├── restaurants/route.ts          # GET list + POST create
│       │   ├── restaurants/[id]/route.ts      # GET detail + DELETE
│       │   ├── restaurants/[id]/users/route.ts # POST create user
│       │   └── create-user/route.ts           # POST create user (legacy)
│       └── dashboard/
│           ├── menu/route.ts                  # GET menu du restaurant
│           ├── items/route.ts                 # POST create item
│           ├── items/[id]/route.ts            # PUT update + DELETE item
│           ├── items/[id]/toggle/route.ts     # PATCH toggle disponibilité
│           ├── upload/route.ts                # POST upload image/video
│           └── qrcode/route.ts                # GET QR code PNG/SVG
├── components/
│   ├── auth-provider.tsx       # SessionProvider wrapper
│   ├── menu/MenuPageClient.tsx # Composant client du menu public
│   └── ui/                     # Composants shadcn/ui
├── lib/
│   ├── auth.ts                 # Config NextAuth (credentials, JWT, callbacks)
│   ├── api-auth.ts             # requireAuth() / requireRestaurateur()
│   ├── db.ts                   # Singleton PrismaClient
│   ├── menu-data.ts            # getMenuBySlug() + cache ISR
│   └── utils.ts                # Fonctions utilitaires (cn, etc.)
├── middleware.ts                # Protection serveur des routes /admin/* et /dashboard/*
└── hooks/                       # Custom hooks React

prisma/
├── schema.prisma                # Schéma de base de données (SQLite)
└── seed.ts                      # Données de démonstration

db/
└── custom.db                    # Base SQLite locale
```

---

## Installation et démarrage local

### Prérequis

- **Node.js** 18+ ou **Bun** 1.0+
- **npm**, **yarn** ou **bun** comme gestionnaire de paquets

### Installation

```bash
# Cloner le projet
git clone <url-du-repo>
cd menu-qr

# Installer les dépendances
npm install
# ou: bun install

# Générer le client Prisma
npx prisma generate

# Pousser le schéma dans la base SQLite
npx prisma db push

# Peupler la base avec les données de démo
npx prisma db seed
# ou: bunx prisma db seed
```

### Démarrage

```bash
# Mode développement
npm run dev
# Le serveur démarre sur http://localhost:3000

# Mode production
npm run build
npm start
# Le serveur démarre sur http://localhost:3000
```

### Vérification rapide

Après le `npm run dev`, ouvrez votre navigateur :

1. **http://localhost:3000** → Page d'accueil avec le menu de démo
2. **http://localhost:3000/menu/le-petit-bistrot** → Menu public complet
3. **http://localhost:3000/login** → Page de connexion
4. Connectez-vous avec les identifiants ci-dessous

---

## Variables d'environnement

Créez un fichier `.env` à la racine du projet :

```env
# Base de données (local)
DATABASE_URL=file:./db/custom.db

# URL de base pour les QR Codes et liens publics
# Local : http://localhost:3000
# Production : https://votre-domaine.com
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# NextAuth (obligatoire)
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=changez-moi-en-production-utilisez-openssl-rand-base64-32
```

### Variables de production (Vercel)

```env
DATABASE_URL=file:./prod.db
NEXT_PUBLIC_SITE_URL=https://menuqr.votre-domaine.com
NEXTAUTH_URL=https://menuqr.votre-domaine.com
NEXTAUTH_SECRET=<secret-fort-32-caracteres>
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

---

## Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (port 3000, Turbopack) |
| `npm run build` | Build de production (standalone output) |
| `npm start` | Serveur de production (après build) |
| `npm run lint` | Vérification ESLint |
| `npm run db:push` | Pousser le schéma Prisma dans la DB |
| `npm run db:generate` | Régénérer le client Prisma |
| `npm run db:migrate` | Migrations Prisma (development) |
| `npm run db:reset` | Réinitialiser la DB (supprime + recrée) |

---

## Identifiants de connexion

### Comptes de démonstration (seed)

Ces comptes sont créés automatiquement par `npx prisma db seed`.

| Rôle | Email | Mot de passe | Route après connexion |
|---|---|---|---|
| **Super Admin** | `admin@menuqr.com` | `admin1234` | `/admin` |
| **Restaurateur** | `restaurateur@petitbistrot.fr` | `demo1234` | `/dashboard` |

### Fonctionnement en local et en production

Les identifiants fonctionnent **de la même manière** en local et en production :

- **En local** : NextAuth utilise le provider `credentials` avec bcrypt contre SQLite
- **En production (Vercel + Firebase)** : NextAuth conserve la session applicative, et la validation des identifiants passe par Firebase Auth quand `NEXT_PUBLIC_FIREBASE_API_KEY` est configure.

> **Important** : les identifiants de seed sont destinés au développement. En production, le super_admin crée les restaurants et les comptes restaurateurs via l'interface `/admin`.

---

## Routes et pages

### Pages publiques (aucune authentification)

| Route | Description | Rendu |
|---|---|---|
| `/` | Page d'accueil, menu du restaurant de démo | SSG (ISR 60s) |
| `/menu/[slug]` | Menu public d'un restaurant | SSG (ISR 60s) |
| `/login` | Page de connexion | Static |

### Pages protégées (middleware + vérification client)

| Route | Rôle requis | Si non autorisé |
|---|---|---|
| `/admin` | `super_admin` | Redirect vers `/login` |
| `/dashboard` | `restaurateur` + `restaurantId` | Redirect vers `/login` |

### Redirections du middleware

- `/admin` + non connecté → `/login?callbackUrl=/admin`
- `/admin` + rôle `restaurateur` → `/dashboard`
- `/dashboard` + non connecté → `/login?callbackUrl=/dashboard`
- `/dashboard` + rôle `super_admin` → `/admin`
- `/dashboard` + pas de `restaurantId` → `/login?error=no_restaurant`

---

## API Routes

### Publiques

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/menu/[slug]` | Données complètes d'un menu (JSON, cache 60s) |
| GET | `/api/auth/csrf` | Token CSRF pour le formulaire de login |
| POST | `/api/auth/callback/credentials` | Authentification |
| GET | `/api/auth/session` | Session utilisateur courante |

### Restaurateur (`requireRestaurateur()` — JWT requis)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/dashboard/menu` | Menu complet du restaurant |
| POST | `/api/dashboard/items` | Créer un plat |
| PUT | `/api/dashboard/items/[id]` | Modifier un plat |
| DELETE | `/api/dashboard/items/[id]` | Supprimer un plat |
| PATCH | `/api/dashboard/items/[id]/toggle` | Basculer disponibilité |
| POST | `/api/dashboard/upload` | Upload image (5 Mo) ou vidéo (10 Mo) |
| GET | `/api/dashboard/qrcode?format=png\|svg` | Générer QR Code HD |

### Super Admin (`requireAuth()` + rôle `super_admin`)

| Méthode | Route | Description |
|---|---|---|
| GET | `/api/admin/restaurants` | Liste tous les restaurants avec stats |
| POST | `/api/admin/restaurants` | Créer un restaurant |
| GET | `/api/admin/restaurants/[id]` | Détail d'un restaurant |
| DELETE | `/api/admin/restaurants/[id]` | Supprimer un restaurant (cascade) |
| POST | `/api/admin/restaurants/[id]/users` | Créer un compte restaurateur |
| POST | `/api/admin/create-user` | Créer un compte (alternative) |

---

## Sécurité

### Protection multi-couches

1. **Middleware serveur** (`src/middleware.ts`) : vérifie le rôle JWT AVANT le rendu de la page. Un utilisateur non authentifié ne voit jamais le HTML du dashboard/admin.

2. **Guards API** (`src/lib/api-auth.ts`) : chaque API route protégée appelle `requireAuth()` ou `requireRestaurateur()` qui extrait le rôle et le `restaurantId` du JWT signé.

3. **Protection contre l'injection cross-tenant** : le `restaurantId` n'est **jamais** pris du body de la requête. Il provient toujours du JWT, qui lui-même provient de la base de données au moment du login. Un restaurateur ne peut jamais accéder ou modifier les données d'un autre restaurant.

4. **Validation backend stricte** :
   - Noms : 2-200 caractères
   - Slugs : regex `[a-z0-9]+(-[a-z0-9]+)*`, unicité vérifiée
   - Prix : nombre entre 0 et 99999
   - Email : format valide, unicité vérifiée
   - Mot de passe : minimum 6 caractères, hashé en bcrypt (10 rounds)

5. **Upload sécurisé** :
   - Validation du type MIME (pas de l'extension)
   - Limites de taille : 5 Mo images, 10 Mo vidéos
   - Nom de fichier UUID (pas de path traversal)
   - Dossier isolé par restaurant : `/public/uploads/{restaurantId}/`

6. **Rôle forcé** : l'API de création d'utilisateur force toujours `role = "restaurateur"`. Il est impossible de créer un autre super_admin via l'interface.

### Ce qui est vérifié côté serveur (pas seulement côté client)

- Rôle de l'utilisateur (middleware + API guards)
- Appartenance du restaurant (JWT, pas le body)
- Existence et propriété des catégories avant CRUD
- Validité des slugs et des emails
- Types MIME et tailles des fichiers uploadés

---

## Génération des QR Codes

### Comment ça fonctionne

1. Le restaurateur clique sur "PNG HD" ou "SVG Vectoriel" dans son dashboard
2. L'API `/api/dashboard/qrcode?format=png` est appelée
3. Le serveur construit l'URL du menu public :
   ```
   {NEXT_PUBLIC_SITE_URL}/menu/{restaurant.slug}
   ```
   - En local : `http://localhost:3000/menu/le-petit-bistrot`
   - En production : `https://menuqr.votre-domaine.com/menu/le-petit-bistrot`
4. Le QR code est généré avec :
   - **Taille** : 1024px
   - **Correction d'erreur** : Niveau H (30% du QR code peut être endommagé)
   - **Marge** : 2 modules
   - **Format** : PNG (bitmap) ou SVG (vectoriel, imprimable à toute taille)

### Pourquoi les QR codes vont fonctionner sans problème

- L'URL encodée dans le QR est construite dynamiquement avec `NEXT_PUBLIC_SITE_URL`
- En production sur Vercel, cette variable pointe vers votre domaine réel
- Le slug du restaurant est unique (contrainte `@unique` en base)
- Le niveau de correction H garantit une lecture fiable même si le QR est partiellement caché (coin de table, pli, reflet)
- Le format SVG peut être imprimé en grand format sans perte de qualité
- La page cible `/menu/[slug]` est en SSG+ISR, donc elle se charge instantanément

### Téléchargement

Le QR code est renvoyé avec le header `Content-Disposition: attachment`, ce qui déclenche un téléchargement automatique. Le fichier est nommé `qr-{slug}.png` ou `qr-{slug}.svg`.

---

## Upload de fichiers

### Types acceptés

| Type | MIME | Extension | Taille max |
|---|---|---|---|
| Image | `image/jpeg` | .jpg | 5 Mo |
| Image | `image/webp` | .webp | 5 Mo |
| Vidéo | `video/mp4` | .mp4 | 10 Mo |

### Stockage

- **En local** : les fichiers sont sauvegardés dans `/public/uploads/{restaurantId}/{uuid}.{ext}`
- L'URL retournée est relative : `/uploads/{restaurantId}/{uuid}.jpg`
- Les fichiers sont accessibles publiquement via le dossier `public/`
- **En production** : Firebase Storage est utilise automatiquement quand l'Admin SDK est configure

### Affichage des vidéos dans le menu public

Les plats avec un `videoUrl` affichent un lecteur vidéo intégré :

```html
<video muted loop playsInline autoPlay>
  <source src="/uploads/{restaurantId}/{uuid}.mp4" type="video/mp4" />
</video>
```

- `muted` : obligatoire pour l'autoplay sur mobile
- `loop` : la vidéo tourne en boucle
- `playsInline` : lecture intégrée sur iOS (pas de plein forcé)
- `autoPlay` : démarre automatiquement

---

## Déploiement en production (Vercel)

### 1. Préparer le dépôt

Assurez-vous que le fichier `.env` contient les variables de production (voir section Variables d'environnement).

### 2. Déployer sur Vercel

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Déployer en production
vercel --prod
```

### 3. Configurer les variables d'environnement

Dans le dashboard Vercel, ajoutez :

```
NEXT_PUBLIC_SITE_URL=https://votre-app.vercel.app
NEXTAUTH_URL=https://votre-app.vercel.app
NEXTAUTH_SECRET=<secret-fort-32-caracteres>
DATABASE_URL=<database-url>
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

### 4. Seed de la base de données

En production, vous ne pouvez pas utiliser `prisma db seed` directement. Deux options :

**Option A** : Utiliser le super_admin pour créer tout via l'interface

1. Déployer avec une DB vide
2. Se connecter avec le premier super_admin (créé manuellement en DB ou via un script de migration)
3. Créer les restaurants et inviter les restaurateurs via `/admin`

**Option B** : Script de seed en production

```bash
# Lancer le seed contre la DB de production
DATABASE_URL="postgresql://..." npx prisma db seed
```

### 5. Domaine personnalisé

1. Dans Vercel, ajoutez votre domaine
2. Mettez à jour `NEXT_PUBLIC_SITE_URL` et `NEXTAUTH_URL`
3. Les QR codes générés après la mise à jour pointeront vers le nouveau domaine

### Build et output

Le `next.config.ts` utilise `output: "standalone"`. Le build script copie automatiquement les fichiers statiques et le dossier `public/` dans le dossier standalone :

```json
{
  "build": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/",
  "start": "NODE_ENV=production node .next/standalone/server.js"
}
```

---

## Configuration Firebase (production)

Firebase est utilise pour l'authentification et le stockage des medias. Prisma reste la couche de donnees metier de l'application.

### Variables necessaires

Renseignez les variables `NEXT_PUBLIC_FIREBASE_*` du SDK client et `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` pour l'Admin SDK.

### Fonctionnement

- Les comptes restaurateurs crees par l'admin sont synchronises dans Firebase Auth.
- Les mots de passe sont verifies via Firebase Auth quand la cle API Firebase est presente.
- Les uploads passent dans Firebase Storage quand l'Admin SDK est configure, avec un fallback local pour le developpement.

---

## Dépannage

### `npm run dev` ne démarre pas

```bash
# Supprimer le cache
rm -rf .next node_modules/.cache

# Régénérer le client Prisma
npx prisma generate

# Redémarrer
npm run dev
```

### Erreur "Element type is invalid" au render

C'est une erreur d'import du composant `AuthProvider`. Vérifiez que `layout.tsx` utilise un import par défaut :

```tsx
// CORRECT
import AuthProvider from "@/components/auth-provider";

// INCORRECT
import { AuthProvider } from "@/components/auth-provider";
```

### Le login ne fonctionne pas

1. Vérifiez que la base est seedée : `npx prisma db seed`
2. Vérifiez le `.env` contient `NEXTAUTH_SECRET`
3. Les mots de passe sont case-sensitive

### Les QR codes pointent vers localhost

Mettez à jour `NEXT_PUBLIC_SITE_URL` dans votre `.env` :

```env
NEXT_PUBLIC_SITE_URL=https://votre-domaine.com
```

Puis redémarrez le serveur et **regénérez les QR codes**.

### Build échoue avec "useSearchParams() should be wrapped in a suspense boundary"

Assurez-vous que la page `/login` utilise un `Suspense` wrapper autour du composant qui appelle `useSearchParams()`. Ce fix est déjà appliqué dans le code actuel.

### L'upload échoue en production

En production sur Vercel, le filesystem est en lecture seule. Vous devez :
1. Configurer Firebase Storage et les variables Firebase Admin
2. Ou utiliser un service externe (S3, Cloudinary, etc.)

### Avertissement "The middleware file convention is deprecated"

Cet avertissement apparaît avec Next.js 16 qui recommande d'utiliser la convention "proxy" à la place de "middleware". Le middleware fonctionne toujours correctement. Pour supprimer l'avertissement, vous pouvez migrer vers la convention `proxy.ts` dans une future version.
#   m e n u c o d e q r  
 