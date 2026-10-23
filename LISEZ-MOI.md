# Achref Sakouhi — Photographe : mise en ligne

Application web installable (PWA) pour Achref Sakouhi, photographe de mariage :

- **Clients** : création de compte (téléphone + e-mail), portfolio, réservation d'une date, réception des photos et vidéos par lien WeTransfer avec notification, avis, compte et suppression du compte.
- **Achref (administrateur)** : envoi des liens aux clients, suivi (envoyé → vu → téléchargé), réponses aux demandes, portfolio, forfaits, avis, agenda des dates prises, réglages.
- **Langues** : français et arabe (bouton en haut de l'écran).
- **Plus tard** : publication sur Google Play (dossier `android/` déjà prêt).

---

## Contenu du dossier

| Fichier / dossier | Rôle |
|---|---|
| `index.html` | L'application complète |
| `config.js` | Les clés Firebase et la clé des notifications (déjà remplies) |
| `sw.js` | Mode hors ligne et réception des notifications |
| `manifest.webmanifest`, `icon-*.png`, `logo-mark.png` | Installation sur le téléphone, icônes |
| `fonts/`, `qrcode.js` | Polices et QR code (inclus, rien à télécharger) |
| `confidentialite.html`, `suppression-compte.html` | Pages légales (exigées par Google Play) |
| `regles-firestore.txt` | Règles de sécurité à coller dans Firebase |
| `scripts/` + `.github/workflows/notifications.yml` | Robot GitHub qui envoie les notifications |
| `.github/workflows/garder-actif.yml` | Empêche GitHub de mettre ce robot en pause |
| `android/` + `.github/workflows/android-playstore.yml` | Pour Google Play, **plus tard** |

---

## Étape 1 — Créer le projet Firebase (15 min)

1. ✅ Projet créé : `acherf-sakouhi-photograp-8aa60`. L'app n'utilise pas Google Analytics (vous pouvez le laisser tel quel).
2. ✅ **Authentication** : E-mail/Mot de passe et Google activés.
   - Onglet **Templates** → crayon → **Sender name** : `Achref Sakouhi` → Save. En bas, Template language : **French**.
   - Nom dans le texte des e-mails : Sign-in method → **Add new provider → Google → Enable** → *Public-facing name for project* : `Achref Sakouhi — Photographe`, Support email : votre adresse → Save.
3. **Firestore Database** → Créer une base de données → emplacement en Europe (par exemple `europe-west1`, **définitif**) → mode **production** → Créer.
   Onglet **Règles** → effacez tout → collez le contenu de `regles-firestore.txt` → **Publier**.
4. ✅ App Web enregistrée : ses clés sont déjà dans `config.js`.
5. ✅ Clé des notifications (`vapidKey`, Cloud Messaging → Certificats push Web) : déjà dans `config.js`.
6. ⚙️ **Paramètres du projet → Comptes de service → Générer une nouvelle clé privée** → un fichier `.json` se télécharge.
   ⚠️ **Ce fichier est secret.** Ne l'envoyez à personne et ne le mettez jamais dans le dépôt : il va uniquement dans un secret GitHub (étape 2.4).

Les valeurs de `config.js` ne sont pas secrètes : elles identifient seulement le projet. La protection vient des règles du point 3.

## Étape 2 — Mettre l'app sur GitHub (10 min)

1. Créez un dépôt **public** (par exemple `achref-photo`). Conseil : un compte GitHub dédié (par exemple `achref-sakouhi`), car son nom apparaît dans l'adresse : `https://achref-sakouhi.github.io/achref-photo/`.
2. **Add file → Upload files** : déposez **tout le contenu** du dossier, y compris le dossier caché `.github` et le fichier `.nojekyll`.
   Sous Ubuntu, affichez les fichiers cachés avec **Ctrl + H**. Si `.github` ne passe pas, créez les fichiers à la main : Add file → Create new file → nom `.github/workflows/notifications.yml` → collez le contenu.
3. **Settings → Pages** → Source : *Deploy from a branch* → branche `main`, dossier `/ (root)` → Save. L'adresse de l'app apparaît au bout d'une ou deux minutes.
4. **Settings → Secrets and variables → Actions → New repository secret** :
   - Nom : `FIREBASE_SERVICE_ACCOUNT`
   - Valeur : **tout** le contenu du fichier `.json` de l'étape 1.6 (de `{` à `}`).
5. Onglet **Actions** : si GitHub le demande, activez les workflows. Lancez une fois **Notifications push → Run workflow** pour vérifier qu'il se termine en vert.

## Étape 3 — Le compte d'Achref (administrateur)

1. Ouvrez l'adresse de l'app → **Créer un compte** avec le nom, le téléphone et l'e-mail d'Achref.
2. Firebase → **Firestore Database → Données → users** → le document d'Achref → champ `role` : remplacez `client` par `admin` → Mettre à jour.
3. Rouvrez l'app : l'**Espace photographe** s'affiche.
4. Dans l'app : **Plus → Réglages** → téléphone, WhatsApp, Instagram, ville → Enregistrer. Puis **Activer les notifications** sur le téléphone d'Achref.
5. **Plus → Portfolio** : ajoutez des photos (mettez-en 3 à 5 « en avant » pour l'accueil). **Plus → Forfaits** : ajoutez les offres.

## Étape 4 — Tester (avec un deuxième téléphone)

- [ ] Créer un compte client, se déconnecter, se reconnecter avec le **numéro** puis avec l'**e-mail**.
- [ ] « Mot de passe oublié ? » avec le numéro : l'e-mail arrive (regardez dans les spams).
- [ ] Client : activer les notifications, puis **Réserver** une date.
- [ ] Achref : la demande arrive (notification en 5 à 15 min) → **Confirmer** → le client est prévenu, la date apparaît barrée dans le calendrier.
- [ ] Achref : **Envoyer des photos à un client** → coller un vrai lien WeTransfer → le client reçoit « Vos photos sont prêtes ».
- [ ] Client : ouvrir le lien, puis **J'ai tout téléchargé** → Achref voit « Téléchargée ».
- [ ] Client : **Laisser un avis** → Achref le publie → il apparaît sur l'accueil.

## Envoi immédiat des notifications (facultatif)

Sans réglage, le robot GitHub passe toutes les 5 à 15 minutes. Pour un envoi en moins d'une minute quand Achref envoie un lien :

1. GitHub (compte du dépôt) → photo de profil → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Nom : `achref-photo-notifications` ; expiration : 1 an ; *Repository access* : **Only select repositories** → `achref-photo`.
3. *Permissions → Repository permissions* → **Actions : Read and write** (rien d'autre) → Generate token → copiez-le.
4. Sur le téléphone d'Achref : **Plus → Réglages → Envoi immédiat des notifications** → collez → Enregistrer → **Tester l'envoi**.

Le jeton reste sur ce téléphone et n'est jamais enregistré dans la base. Si le téléphone est perdu, supprimez le jeton sur GitHub. Pensez à le renouveler avant son expiration.

## Au quotidien (Achref)

1. Préparer le transfert sur **WeTransfer** et copier le lien.
2. App → **Envoyer des photos à un client** → choisir le client → coller le lien des photos et celui de la vidéo → date d'expiration = celle de WeTransfer (3 jours pour un compte gratuit) → **Envoyer au client**.
3. Le client est prévenu tout de suite, puis **la veille de l'expiration** s'il n'a pas encore téléchargé.
4. Lien expiré ? Le client touche « Demander un nouveau lien » → Achref est prévenu → **Livraisons → la livraison** → nouveau lien et nouvelle date → Enregistrer (case « Prévenir le client » cochée).

## Mettre l'app à jour

- Modifiez les fichiers sur GitHub : les clients voient la nouvelle version à la prochaine ouverture.
- À chaque mise à jour : augmentez `CACHE_VERSION` dans `sw.js` et `APP_VERSION` dans `index.html` (affichée dans À propos).

## Plus tard : Google Play

Tout est prêt pour la méthode utilisée pour Animaux d'abord (voir le *Guide — Publier une app web sur Google Play*, phases 2 à 10) :

- `android/config.json` : `packageId` = `tn.achrefsakouhi.photo`. Vérifiez-le avant la première publication : il devient **définitif** ensuite.
- Robot **Android — app Play Store** : il fabrique le `.aab`, l'APK de test et `assetlinks.json` (il faut d'abord une clé de signature et ses 2 secrets).
- Avant de publier : ajoutez une adresse e-mail de contact d'Achref dans `confidentialite.html` (partie 1).
- Data safety : Name, Email address, Phone number, User IDs (compte) ; Other user-generated content (demandes, avis) ; Device or other IDs (notifications). Aucune localisation, aucune statistique, aucune publicité.

## Limites de l'offre gratuite

- **Firebase Spark** : 50 000 lectures et 20 000 écritures par jour, 1 Go de données. Les photos du portfolio sont enregistrées dans la base (150 à 400 Ko chacune) : gardez-en moins de 200.
- **GitHub** : gratuit pour un dépôt public, robots compris.
- Les fichiers des mariages ne passent jamais par l'app : ils restent sur WeTransfer.

---
Conception et développement : Rahmeni Hamdi — rahmenihamdi@gmail.com — +216 95 063 068
