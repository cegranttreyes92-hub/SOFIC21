/**
 * Configuración de Firebase para Studio Cejas & Uñas
 * Proyecto: Sofyc21 (sofyc21-b2fe5)
 */

window.firebaseConfig = {
    apiKey: "AIzaSyDZ2J1QH_3FN9u2GALRU-tMThDdkkpZXiw",
    authDomain: "sofyc21-b2fe5.firebaseapp.com",
    projectId: "sofyc21-b2fe5",
    storageBucket: "sofyc21-b2fe5.firebasestorage.app",
    messagingSenderId: "1050532856784",
    appId: "1:1050532856784:web:0d6301fa3b60c485582fd5"
};

/**
 * Valida si las credenciales de Firebase son válidas y están configuradas.
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

// Compatibilidad para entornos CommonJS si aplica
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        firebaseConfig: window.firebaseConfig,
        isFirebaseConfigured: window.isFirebaseConfigured
    };
}
