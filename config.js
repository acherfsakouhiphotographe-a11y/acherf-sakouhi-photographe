/* =====================================================================
   CONFIGURATION FIREBASE — projet acherf-sakouhi-photograp-8aa60
   ---------------------------------------------------------------------
   Ces clés ne sont pas secrètes : elles identifient le projet. La sécurité
   vient des règles Firestore (fichier regles-firestore.txt).

   vapidKey (notifications) : Console Firebase → ⚙️ Paramètres du projet →
   Cloud Messaging → « Configuration Web » → Certificats push Web.
   ===================================================================== */
window.APP_CONFIG = {
  firebase: {
    apiKey: "AIzaSyDZmUTCS7xStvi5wvOPAQvQPNM0kYD82M0",
    authDomain: "acherf-sakouhi-photograp-8aa60.firebaseapp.com",
    projectId: "acherf-sakouhi-photograp-8aa60",
    storageBucket: "acherf-sakouhi-photograp-8aa60.firebasestorage.app",
    messagingSenderId: "69969887264",
    appId: "1:69969887264:web:99c574af8ef7bb2b497c45"
  },
  vapidKey: "BDF4uJNjwNpK-SQKTecZ0ponGFY0t9_v6ToP1AgYBIM0i10pcJo5-CE_FUaHKIwvMEwGLbY2C6P4OkkBDC4ybww",

  // Reels (vidéos) : compte Cloudinary gratuit — voir LISEZ-MOI.md, partie « Reels ».
  // cloudName : Cloudinary → Settings → Product environment (ou en haut du Dashboard).
  // uploadPreset : nom du preset NON SIGNÉ créé dans Settings → Upload → Upload presets.
  // Ces deux valeurs ne sont pas secrètes. La clé secrète (API secret) va uniquement dans GitHub.
  cloudinary: { cloudName: "gdnknfv2", uploadPreset: "reels_achref" }
};
