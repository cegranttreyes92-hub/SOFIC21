# 💅 Agenda Studio — Cejas & Uñas (PWA & Firebase)

Aplicación web progresiva (PWA) de alto rendimiento diseñada específicamente para estudios de cejas, pestañas y uñas. Optimizada para Safari iOS (iPhone) y navegadores web modernos, funcionando netamente en **Soles Peruanos (S/)**.

---

## 🚀 Guía Rápida de Despliegue en GitHub & Firebase

### 1. Subir a GitHub
1. Entra en tu cuenta de [GitHub](https://github.com) y crea un **nuevo repositorio** (por ejemplo: `studio-citas`).
2. Abre la terminal en esta carpeta (`B:\Documentos\SOFIA`) y ejecuta:
```bash
git remote add origin https://github.com/TU_USUARIO/studio-citas.git
git branch -M main
git push -u origin main
```

---

### 2. Activar GitHub Pages (URL Gratuita para tu iPhone)
1. En tu repositorio de GitHub, ve a la pestaña **Settings** (Ajustes).
2. En el menú lateral izquierdo, haz clic en **Pages**.
3. En **Build and deployment > Branch**:
   - Selecciona la rama: `main`
   - Carpeta: `/ (root)`
4. Haz clic en **Save**.
5. En 1 minuto tendrás tu enlace HTTPS público, por ejemplo:
   `https://tu-usuario.github.io/studio-citas/`

---

### 3. Conectar Firebase Firestore (Base de Datos en Tiempo Real)
La app funciona de inmediato en modo local, pero para sincronizar tus citas y caja en tiempo real con tu iPhone y cualquier otra computadora:

1. Ve a [Firebase Console](https://console.firebase.google.com/) e inicia sesión con tu cuenta de Google.
2. Haz clic en **Crear un proyecto** (ejemplo: `studio-cejas-unas`).
3. En el menú lateral, ve a **Compilación > Firestore Database**:
   - Haz clic en **Crear base de datos**.
   - Elige la ubicación (por ejemplo `us-central1` o `southamerica-east1`).
   - Elige **Modo de prueba** (o pega las reglas que vienen en el archivo `firestore.rules`).
4. Ve al engranaje ⚙️ (**Configuración del proyecto**) > pestaña **General**.
5. En la sección **Tus apps**, haz clic en el icono Web **`</>`**.
6. Registra la app y copia los datos del objeto `firebaseConfig`.
7. Abre el archivo `js/firebase-config.js` y reemplaza los valores de `window.firebaseConfig`:
```javascript
window.firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "tu-proyecto.firebaseapp.com",
    projectId: "tu-proyecto",
    storageBucket: "tu-proyecto.appspot.com",
    messagingSenderId: "123456789...",
    appId: "1:123456789:web:abcdef..."
};
```
8. Guarda los cambios, haz commit y push a GitHub:
```bash
git add js/firebase-config.js
git commit -m "chore: configurar credenciales firebase"
git push
```
9. Abre la app, ve a **⚙️ Ajustes** y presiona **☁️ Subir Datos Locales a Firebase** para cargar tu catálogo y datos iniciales en la nube. ¡Listo!

---

### 4. Instalar como App Nativa en iPhone (Safari iOS)
1. Abre tu enlace de GitHub Pages en **Safari** en tu iPhone.
2. Presiona el botón **Compartir** (el cuadro con una flecha hacia arriba en la barra inferior de Safari).
3. Desliza hacia abajo y selecciona **"Agregar a pantalla de inicio"** (o *"Add to Home Screen"*).
4. Elige el nombre (ej. **Studio Citas**) y presiona **Agregar**.
5. ¡Listo! Se abrirá como una aplicación nativa a pantalla completa sin barras de navegador.

---

## 🇵🇪 Características del Negocio (Perú)
- **Moneda:** Soles peruanos (`S/`).
- **Métodos de Pago:** Yape, Plin, Transferencia BCP/BBVA, Efectivo, Tarjeta/POS.
- **WhatsApp Integrado (+51):**
  - Confirmación de citas con detalle de abono y saldo pendiente.
  - Recibo/comprobante de pago automático.
  - Recordatorio de retoque o mantenimiento personalizado según fecha de última cita.
- **Offline First:** Funciona incluso si se cae el internet o la señal móvil en el estudio.
