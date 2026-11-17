/**
 * Capa de Persistencia y Base de Datos (store.js)
 * Sistema netamente en Soles peruanos (S/) con Yape, Plin y transferencias
 * Soporte dual: Firebase Firestore en tiempo real + Almacenamiento Local Offline
 */

function getLocalTodayISO() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function getRelativeDateISO(offsetDays) {
    const date = new Date();
    date.setDate(date.getDate() + offsetDays);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

const CATALOGO_BASE_SERVICIOS = [
    { nombre: 'Diseño y Pigmentación de Cejas', categoria: 'Cejas', duracion: 45, precio: 35 },
    { nombre: 'Laminado de Cejas + Tinte', categoria: 'Cejas', duracion: 60, precio: 55 },
    { nombre: 'Depilación de Cejas (Cera / Hilo)', categoria: 'Cejas', duracion: 30, precio: 25 },
    { nombre: 'Sistema Uñas Acrílicas Esculpidas', categoria: 'Uñas', duracion: 120, precio: 95 },
    { nombre: 'Mantenimiento / Retoque Acrílico', categoria: 'Uñas', duracion: 90, precio: 65 },
    { nombre: 'Manicure Semipermanente + Base Rubber', categoria: 'Uñas', duracion: 60, precio: 45 },
    { nombre: 'Baño de Acrílico sobre Uña Natural', categoria: 'Uñas', duracion: 75, precio: 55 },
    { nombre: 'Lifting de Pestañas + Tinte', categoria: 'Pestañas', duracion: 60, precio: 60 },
    { nombre: 'Extensiones Pelo a Pelo Clásicas', categoria: 'Pestañas', duracion: 120, precio: 110 }
];

const STORAGE_KEYS = {
    CITAS: 'estetica_citas_soles_v1',
    CLIENTAS: 'estetica_clientas_soles_v1',
    SERVICIOS: 'estetica_servicios_soles_v1',
    PAGOS: 'estetica_pagos_soles_v1',
    CONFIG: 'estetica_config_soles_v1'
};

const storeState = {
    citas: [],
    clientas: [],
    servicios: [],
    pagos: [],
    config: {
        nombreEstudio: 'Studio Cejas & Uñas',
        telefonoEstudio: '987654321'
    }
};

let changeListeners = [];
let firestoreDb = null;
let isFirebaseReady = false;

function notifySubscribers() {
    changeListeners.forEach(fn => {
        try {
            fn(storeState);
        } catch (err) {
            console.error('[Store] Error notificando suscriptor:', err);
        }
    });
}

function saveToLocalStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.CITAS, JSON.stringify(storeState.citas));
        localStorage.setItem(STORAGE_KEYS.CLIENTAS, JSON.stringify(storeState.clientas));
        localStorage.setItem(STORAGE_KEYS.SERVICIOS, JSON.stringify(storeState.servicios));
        localStorage.setItem(STORAGE_KEYS.PAGOS, JSON.stringify(storeState.pagos));
        localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(storeState.config));
    } catch (e) {
        console.warn('[Store] Error guardando en localStorage:', e);
    }
}

const Store = {
    isFirebaseConnected: false,

    subscribe(fn) {
        if (typeof fn === 'function') {
            changeListeners.push(fn);
        }
    },

    init() {
        // 1. Cargar almacenamiento local de inmediato (render rápido y modo offline)
        let rawServicios, rawCitas, rawClientas, rawPagos, rawConfig;
        try {
            rawServicios = localStorage.getItem(STORAGE_KEYS.SERVICIOS);
            rawCitas = localStorage.getItem(STORAGE_KEYS.CITAS);
            rawClientas = localStorage.getItem(STORAGE_KEYS.CLIENTAS);
            rawPagos = localStorage.getItem(STORAGE_KEYS.PAGOS);
            rawConfig = localStorage.getItem(STORAGE_KEYS.CONFIG);
        } catch (e) {
            console.warn('[Store] localStorage no accesible:', e);
        }

        if (!rawServicios && !rawCitas) {
            this.seedDemoData();
        } else {
            storeState.citas = rawCitas ? JSON.parse(rawCitas) : [];
            storeState.clientas = rawClientas ? JSON.parse(rawClientas) : [];
            storeState.servicios = rawServicios ? JSON.parse(rawServicios) : [];
            storeState.pagos = rawPagos ? JSON.parse(rawPagos) : [];
            storeState.config = rawConfig ? JSON.parse(rawConfig) : {
                nombreEstudio: 'Studio Cejas & Uñas',
                telefonoEstudio: '987654321'
            };
            notifySubscribers();
        }

        // 2. Conexión opcional a Firebase Firestore si las credenciales están configuradas
        this.initFirebase();
    },

    initFirebase() {
        if (typeof window.firebase === 'undefined' || typeof window.isFirebaseConfigured !== 'function') {
            console.log('[Store] SDK de Firebase o firebase-config no detectado. Funcionando en modo local.');
            return;
        }

        if (!window.isFirebaseConfigured()) {
            console.log('[Store] Credenciales de Firebase pendientes de configurar en js/firebase-config.js. Modo local activo.');
            return;
        }

        try {
            if (!firebase.apps.length) {
                firebase.initializeApp(window.firebaseConfig);
            }
            firestoreDb = firebase.firestore();

            // Persistencia offline de Firestore para iPhone / Safari / Web
            firestoreDb.enablePersistence({ synchronizeTabs: true }).catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('[Store Firebase] Múltiples pestañas abiertas, persistencia en pestaña principal.');
                } else if (err.code === 'unimplemented') {
                    console.warn('[Store Firebase] El navegador actual no soporta persistencia offline de Firestore.');
                }
            });

            isFirebaseReady = true;
            this.isFirebaseConnected = true;
            console.log('[Store] Conectado exitosamente a Firebase Firestore en tiempo real.');

            // Suscripciones en tiempo real
            this.listenToFirestore();
        } catch (err) {
            console.error('[Store] Error al inicializar Firestore:', err);
            isFirebaseReady = false;
            this.isFirebaseConnected = false;
        }
    },

    listenToFirestore() {
        if (!firestoreDb) return;

        // Escuchar servicios
        firestoreDb.collection('servicios').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const items = [];
                snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                storeState.servicios = items;
                saveToLocalStorage();
                notifySubscribers();
            }
        }, err => console.warn('[Firebase] Error en servicios onSnapshot:', err));

        // Escuchar clientas
        firestoreDb.collection('clientas').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const items = [];
                snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                storeState.clientas = items;
                saveToLocalStorage();
                notifySubscribers();
            }
        }, err => console.warn('[Firebase] Error en clientas onSnapshot:', err));

        // Escuchar citas
        firestoreDb.collection('citas').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const items = [];
                snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                storeState.citas = items;
                saveToLocalStorage();
                notifySubscribers();
            }
        }, err => console.warn('[Firebase] Error en citas onSnapshot:', err));

        // Escuchar pagos
        firestoreDb.collection('pagos').onSnapshot(snapshot => {
            if (!snapshot.empty) {
                const items = [];
                snapshot.forEach(doc => items.push({ id: doc.id, ...doc.data() }));
                storeState.pagos = items;
                saveToLocalStorage();
                notifySubscribers();
            }
        }, err => console.warn('[Firebase] Error en pagos onSnapshot:', err));

        // Escuchar config general
        firestoreDb.collection('config').doc('general').onSnapshot(doc => {
            if (doc.exists) {
                storeState.config = { ...storeState.config, ...doc.data() };
                saveToLocalStorage();
                notifySubscribers();
            }
        }, err => console.warn('[Firebase] Error en config onSnapshot:', err));
    },

    async syncLocalToFirebase() {
        if (!isFirebaseReady || !firestoreDb) {
            throw new Error('Firebase no está configurado aún con credenciales válidas.');
        }

        const batch = firestoreDb.batch();

        storeState.servicios.forEach(s => {
            const ref = firestoreDb.collection('servicios').doc(s.id);
            batch.set(ref, s);
        });

        storeState.clientas.forEach(c => {
            const ref = firestoreDb.collection('clientas').doc(c.id);
            batch.set(ref, c);
        });

        storeState.citas.forEach(c => {
            const ref = firestoreDb.collection('citas').doc(c.id);
            batch.set(ref, c);
        });

        storeState.pagos.forEach(p => {
            const ref = firestoreDb.collection('pagos').doc(p.id);
            batch.set(ref, p);
        });

        const configRef = firestoreDb.collection('config').doc('general');
        batch.set(configRef, storeState.config);

        await batch.commit();
        console.log('[Store] Todos los datos locales se sincronizaron con Firebase Firestore.');
        return true;
    },

    seedDemoData() {
        const hoy = getLocalTodayISO();
        const ayer = getRelativeDateISO(-1);
        const manana = getRelativeDateISO(1);

        storeState.servicios = CATALOGO_BASE_SERVICIOS.slice(0, 6).map((s, i) => ({
            id: 'srv_' + (i + 1),
            ...s
        }));

        storeState.clientas = [
            {
                id: 'cli_1',
                nombre: 'Valeria Mendoza',
                telefono: '987654321',
                notasTecnicas: 'Pigmento castaño medio (7 min). Prefiere forma almendrada #2 en uñas.'
            },
            {
                id: 'cli_2',
                nombre: 'Camila Rodríguez',
                telefono: '912345678',
                notasTecnicas: 'Piel sensible, usar cera tibia de manzanilla. Usa base rubber tono nude.'
            },
            {
                id: 'cli_3',
                nombre: 'Sofía González',
                telefono: '976543210',
                notasTecnicas: 'Cejas con henna castaño oscuro. Le gustan los diseños minimalistas.'
            }
        ];

        storeState.citas = [
            {
                id: 'cita_1',
                clientaId: 'cli_1',
                clientaNombre: 'Valeria Mendoza',
                clientaTelefono: '987654321',
                fecha: hoy,
                horaInicio: '09:00',
                horaFin: '11:00',
                servicios: [storeState.servicios[3]], // Uñas Acrílicas S/ 95
                total: 95,
                abonado: 95,
                saldoPendiente: 0,
                estado: 'completada',
                notasCita: 'Diseño francés blanco con brillo.'
            },
            {
                id: 'cita_2',
                clientaId: 'cli_2',
                clientaNombre: 'Camila Rodríguez',
                clientaTelefono: '912345678',
                fecha: hoy,
                horaInicio: '11:30',
                horaFin: '13:15',
                servicios: [storeState.servicios[0], storeState.servicios[5]], // Cejas (35) + Semipermanente (45) = 80
                total: 80,
                abonado: 30,
                saldoPendiente: 50,
                estado: 'en_proceso',
                notasCita: 'Abonó S/ 30 por Yape para apartar cupo.'
            },
            {
                id: 'cita_3',
                clientaId: 'cli_3',
                clientaNombre: 'Sofía González',
                clientaTelefono: '976543210',
                fecha: manana,
                horaInicio: '10:00',
                horaFin: '11:00',
                servicios: [storeState.servicios[1]], // Laminado S/ 55
                total: 55,
                abonado: 20,
                saldoPendiente: 35,
                estado: 'confirmada',
                notasCita: 'Confirmada por WhatsApp. Seña por Plin.'
            }
        ];

        storeState.pagos = [
            {
                id: 'pag_1',
                citaId: 'cita_1',
                clientaNombre: 'Valeria Mendoza',
                fecha: hoy,
                monto: 95,
                tipo: 'pago_completo',
                metodo: 'Transferencia BCP/BBVA',
                referencia: 'OP-8291'
            },
            {
                id: 'pag_2',
                citaId: 'cita_2',
                clientaNombre: 'Camila Rodríguez',
                fecha: hoy,
                monto: 30,
                tipo: 'abono',
                metodo: 'Yape',
                referencia: '4821'
            },
            {
                id: 'pag_3',
                citaId: 'cita_3',
                clientaNombre: 'Sofía González',
                fecha: ayer,
                monto: 20,
                tipo: 'abono',
                metodo: 'Plin',
                referencia: '7102'
            }
        ];

        storeState.config = {
            nombreEstudio: 'Studio Cejas & Uñas',
            telefonoEstudio: '987654321'
        };

        saveToLocalStorage();
        notifySubscribers();
    },

    resetDemoData() {
        this.seedDemoData();
    },

    // --- GETTERS ---
    getCitas() {
        return storeState.citas;
    },
    getClientas() {
        return storeState.clientas;
    },
    getServicios() {
        return storeState.servicios;
    },
    getPagos() {
        return storeState.pagos;
    },
    getConfig() {
        return storeState.config;
    },

    // --- CONFIG ---
    async saveConfig(newConfig) {
        storeState.config = { ...storeState.config, ...newConfig };
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('config').doc('general').set(storeState.config);
            } catch (err) {
                console.error('[Firebase] Error al guardar config:', err);
            }
        }
    },

    // --- CITAS ---
    async upsertCita(cita) {
        const id = cita.id || 'cita_' + Date.now();
        const cleanedCita = { ...cita, id };

        const idx = storeState.citas.findIndex(c => c.id === id);
        if (idx >= 0) storeState.citas[idx] = cleanedCita;
        else storeState.citas.push(cleanedCita);

        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('citas').doc(id).set(cleanedCita);
            } catch (err) {
                console.error('[Firebase] Error al guardar cita en Firestore:', err);
            }
        }

        return cleanedCita;
    },

    async deleteCita(citaId, eliminarMovimientoCaja = false) {
        if (eliminarMovimientoCaja) {
            const pagosAsociados = storeState.pagos.filter(p => p.citaId === citaId);
            for (const p of pagosAsociados) {
                await this.deletePago(p.id, false);
            }
        }

        storeState.citas = storeState.citas.filter(c => c.id !== citaId);
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('citas').doc(citaId).delete();
            } catch (err) {
                console.error('[Firebase] Error al eliminar cita en Firestore:', err);
            }
        }
    },

    // --- CLIENTAS ---
    async upsertClienta(clienta) {
        const id = clienta.id || 'cli_' + Date.now();
        const cleaned = { ...clienta, id };

        const idx = storeState.clientas.findIndex(c => c.id === id);
        if (idx >= 0) storeState.clientas[idx] = cleaned;
        else storeState.clientas.push(cleaned);

        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('clientas').doc(id).set(cleaned);
            } catch (err) {
                console.error('[Firebase] Error al guardar clienta en Firestore:', err);
            }
        }

        return cleaned;
    },

    async deleteClienta(clientaId) {
        const activas = storeState.citas.filter(c => c.clientaId === clientaId && c.estado !== 'cancelada');
        if (activas.length > 0) {
            throw new Error(`La clienta tiene ${activas.length} cita(s) activa(s). Cancela o elimina sus citas primero.`);
        }

        storeState.clientas = storeState.clientas.filter(c => c.id !== clientaId);
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('clientas').doc(clientaId).delete();
            } catch (err) {
                console.error('[Firebase] Error al eliminar clienta en Firestore:', err);
            }
        }
    },

    // --- SERVICIOS ---
    async upsertServicio(servicio) {
        const id = servicio.id || 'srv_' + Date.now();
        const cleaned = { ...servicio, id };

        const idx = storeState.servicios.findIndex(s => s.id === id);
        if (idx >= 0) storeState.servicios[idx] = cleaned;
        else storeState.servicios.push(cleaned);

        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('servicios').doc(id).set(cleaned);
            } catch (err) {
                console.error('[Firebase] Error al guardar servicio en Firestore:', err);
            }
        }

        return cleaned;
    },

    async deleteServicio(servicioId) {
        storeState.servicios = storeState.servicios.filter(s => s.id !== servicioId);
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('servicios').doc(servicioId).delete();
            } catch (err) {
                console.error('[Firebase] Error al eliminar servicio en Firestore:', err);
            }
        }
    },

    async cargarCatalogoBase() {
        for (const item of CATALOGO_BASE_SERVICIOS) {
            await this.upsertServicio({
                nombre: item.nombre,
                categoria: item.categoria,
                duracion: item.duracion,
                precio: item.precio
            });
        }
    },

    // --- PAGOS ---
    async addPago(pago) {
        const id = pago.id || 'pag_' + Date.now();
        const cleaned = { ...pago, id };

        storeState.pagos.unshift(cleaned);
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('pagos').doc(id).set(cleaned);
            } catch (err) {
                console.error('[Firebase] Error al guardar pago en Firestore:', err);
            }
        }

        return cleaned;
    },

    async updatePago(pagoId, updatedData) {
        const prevPago = storeState.pagos.find(p => p.id === pagoId);
        if (!prevPago) return;

        const merged = { ...prevPago, ...updatedData };
        const idx = storeState.pagos.findIndex(p => p.id === pagoId);
        if (idx >= 0) storeState.pagos[idx] = merged;

        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('pagos').doc(pagoId).set(merged);
            } catch (err) {
                console.error('[Firebase] Error al actualizar pago en Firestore:', err);
            }
        }

        if (merged.citaId) {
            await this.recalcularSaldoCita(merged.citaId);
        }
    },

    async deletePago(pagoId, recalcularCita = true) {
        const pago = storeState.pagos.find(p => p.id === pagoId);
        const citaId = pago ? pago.citaId : null;

        storeState.pagos = storeState.pagos.filter(p => p.id !== pagoId);
        saveToLocalStorage();
        notifySubscribers();

        if (isFirebaseReady && firestoreDb) {
            try {
                await firestoreDb.collection('pagos').doc(pagoId).delete();
            } catch (err) {
                console.error('[Firebase] Error al eliminar pago en Firestore:', err);
            }
        }

        if (recalcularCita && citaId) {
            await this.recalcularSaldoCita(citaId);
        }
    },

    async recalcularSaldoCita(citaId) {
        const cita = storeState.citas.find(c => c.id === citaId);
        if (!cita) return;

        const pagosDeEstaCita = storeState.pagos.filter(p => p.citaId === citaId);
        const totalAbonado = pagosDeEstaCita.reduce((acc, p) => acc + Number(p.monto || 0), 0);
        cita.abonado = Number(totalAbonado.toFixed(2));
        cita.saldoPendiente = Math.max(0, Number((cita.total - cita.abonado).toFixed(2)));

        await this.upsertCita(cita);
    }
};

window.Store = Store;
window.getLocalTodayISO = getLocalTodayISO;
window.getRelativeDateISO = getRelativeDateISO;
window.CATALOGO_BASE_SERVICIOS = CATALOGO_BASE_SERVICIOS;
