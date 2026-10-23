# Android (Google Play) — à utiliser plus tard

Ce dossier fabrique l'application Android (Trusted Web Activity) qui ouvre le site en plein écran.
Rien à faire tant que l'app n'est pas publiée sur le Play Store.

Le moment venu :
1. Vérifier `config.json` : `packageId` (définitif après la 1re publication), `appName`, `launcherName` (30 caractères max).
2. Créer une clé de signature et ajouter les secrets `ANDROID_KEYSTORE_BASE64` et `ANDROID_KEYSTORE_PASSWORD`.
3. Onglet Actions → **Android — app Play Store** → Run workflow → télécharger `app-play-store`.
4. Suivre le *Guide — Publier une app web sur Google Play* (phases 3 à 10).
