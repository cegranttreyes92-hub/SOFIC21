/**
 * Configuración de Firebase para Studio Cejas & Uñas
 * Pega tus credenciales de Firebase Console:
 * 1. Ve a console.firebase.google.com
 * 2. Selecciona o crea tu proyecto.
 * 3. En Configuración del proyecto > General > Tus apps > Añadir app Web (</>).
 * 4. Copia los valores del objeto firebaseConfig y reemplázalos aquí abajo.
 */

window.firebaseConfig = {
    apiKey: "TU_API_KEY",
    authDomain: "TU_PROYECTO.firebaseapp.com",
    projectId: "TU_PROYECTO",
    storageBucket: "TU_PROYECTO.appspot.com",
    messagingSenderId: "TU_MESSAGING_SENDER_ID",
    appId: "TU_APP_ID"
};

/**
 * Valida si las credenciales de Firebase han sido reemplazadas por las reales.
 */
window.isFirebaseConfigured = function () {
    return Boolean(
        window.firebaseConfig &&
        window.firebaseConfig.apiKey &&
        !window.firebaseConfig.apiKey.includes('TU_API_KEY') &&
        window.firebaseConfig.projectId &&
        !window.firebaseConfig.projectId.includes('TU_PROYECTO')
    );
};

// Exportación para entornos CommonJS si aplica
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig: window.firebaseConfig,
        isFirebaseConfigured: window.isFirebaseConfigured
    };
}
