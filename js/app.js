/**
 * Controlador Principal de la Aplicación (app.js)
 * Compatible con file:// (apertura directa local) y https:// (GitHub Pages / Hosting)
 */

const AppState = {
    currentView: 'view-agenda',
    selectedDate: getLocalTodayISO(),
    serviceCategory: 'Todos',
    clientSearch: '',
    cajaPeriod: 'hoy',
    selectedClientaForCita: null,
    reagendarCitaId: null
};

/* ==================== INICIALIZACIÓN ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initPWA();
    setupNavigation();
    setupModals();
    setupAgendaEvents();
    setupClientasEvents();
    setupServiciosEvents();
    setupCajaEvents();
    setupSettingsEvents();

    // Inicializar persistencia de datos y suscribir la interfaz
    Store.init();
    Store.subscribe(() => {
        renderAll();
    });
    renderAll();
});

function initPWA() {
    // Los Service Workers solo funcionan sobre HTTP/HTTPS, no en file://
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(reg => {
                    console.log('[PWA] Service Worker activo en:', reg.scope);
                })
                .catch(err => {
                    console.warn('[PWA] Error registrando Service Worker:', err);
                });
        });
    }
}

function renderAll() {
    renderHeaderInfo();
    renderAgenda();
    renderClientas();
    renderServicios();
    renderCaja();
}

function renderHeaderInfo() {
    const config = Store.getConfig();
    if (config && config.nombreEstudio) {
        const sub = document.getElementById('header-subtitle');
        if (sub) sub.textContent = config.nombreEstudio;
    }
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

/* ==================== AJUSTES DEL ESTUDIO ==================== */
function setupSettingsEvents() {
    const btnOpen = document.getElementById('btn-open-settings');
    if (btnOpen) {
        btnOpen.addEventListener('click', () => {
            const config = Store.getConfig();
            document.getElementById('settings-nombre-estudio').value = config.nombreEstudio || '';
            document.getElementById('settings-telefono-estudio').value = config.telefonoEstudio || '';

            // Actualizar estado visual de Firebase
            const badge = document.getElementById('firebase-status-badge');
            const desc = document.getElementById('firebase-status-desc');
            const btnSync = document.getElementById('btn-sync-firebase');

            if (badge && desc) {
                if (Store.isFirebaseConnected) {
                    badge.textContent = '🟢 Conectado (Nube)';
                    badge.style.background = 'rgba(46, 125, 50, 0.15)';
                    badge.style.color = '#2e7d32';
                    desc.innerHTML = 'Base de datos Firestore conectada en tiempo real. Todos los cambios se sincronizan en vivo entre tus dispositivos (iPhone, PC, etc.).';
                    if (btnSync) btnSync.style.display = 'block';
                } else {
                    badge.textContent = '🟡 Modo Local';
                    badge.style.background = 'rgba(245, 158, 11, 0.15)';
                    badge.style.color = '#b45309';
                    desc.innerHTML = 'Datos guardados de forma segura en este dispositivo. Para sincronizar en tiempo real en la nube, coloca tus credenciales en <code>js/firebase-config.js</code>.';
                    if (btnSync) btnSync.style.display = 'none';
                }
            }

            openModal('modal-settings');
        });
    }

    const btnSync = document.getElementById('btn-sync-firebase');
    if (btnSync) {
        btnSync.addEventListener('click', async () => {
            try {
                btnSync.disabled = true;
                btnSync.textContent = '⏳ Sincronizando con Firebase...';
                await Store.syncLocalToFirebase();
                showToast('¡Datos sincronizados con éxito en Firebase!');
            } catch (err) {
                alert('Error al sincronizar con Firebase: ' + (err.message || err));
            } finally {
                btnSync.disabled = false;
                btnSync.textContent = '☁️ Subir Datos Locales a Firebase';
            }
        });
    }

    const formSettings = document.getElementById('form-settings-general');
    if (formSettings) {
        formSettings.addEventListener('submit', async e => {
            e.preventDefault();
            const nombreEstudio = document.getElementById('settings-nombre-estudio').value.trim();
            const telefonoEstudio = document.getElementById('settings-telefono-estudio').value.trim();

            await Store.saveConfig({ nombreEstudio, telefonoEstudio });
            closeModal('modal-settings');
            showToast('Ajustes guardados');
        });
    }

    const btnCatalogo = document.getElementById('btn-cargar-catalogo-base');
    if (btnCatalogo) {
        btnCatalogo.addEventListener('click', async () => {
            if (confirm('¿Cargar el catálogo sugerido con 9 servicios populares de cejas, pestañas y uñas?')) {
                await Store.cargarCatalogoBase();
                closeModal('modal-settings');
                showToast('Catálogo base cargado exitosamente');
            }
        });
    }

    const btnReset = document.getElementById('btn-reset-demo');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (confirm('¿Restaurar los datos de ejemplo iniciales?')) {
                Store.resetDemoData();
                AppState.selectedDate = getLocalTodayISO();
                closeModal('modal-settings');
                showToast('Datos de ejemplo restaurados');
            }
        });
    }
}

/* ==================== NAVEGACIÓN ==================== */
function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetView = btn.dataset.view;
            const title = btn.dataset.title;

            navItems.forEach(n => n.classList.remove('active'));
            btn.classList.add('active');

            document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            const viewEl = document.getElementById(targetView);
            if (viewEl) viewEl.classList.add('active');

            const headerTitle = document.getElementById('header-title');
            if (headerTitle) headerTitle.textContent = title;

            AppState.currentView = targetView;
            renderAll();
        });
    });
}

function openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('open');
}

function closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('open');
}

function setupModals() {
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => closeModal(btn.dataset.close));
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', e => {
            if (e.target === backdrop) backdrop.classList.remove('open');
        });
    });
}

/* ==================== VISTA 1: AGENDA ==================== */
function setupAgendaEvents() {
    const datePicker = document.getElementById('agenda-date-picker');
    if (datePicker) {
        datePicker.value = AppState.selectedDate;
        datePicker.addEventListener('change', e => {
            if (e.target.value) {
                AppState.selectedDate = e.target.value;
                renderAgenda();
            }
        });
    }

    const btnHoy = document.getElementById('btn-hoy');
    if (btnHoy) {
        btnHoy.addEventListener('click', () => {
            AppState.selectedDate = getLocalTodayISO();
            renderAgenda();
        });
    }

    const btnFab = document.getElementById('btn-fab-cita');
    if (btnFab) {
        btnFab.addEventListener('click', () => {
            openCitaModal();
        });
    }

    // Toggle formulario clienta nueva inline
    const toggleNueva = document.getElementById('toggle-nueva-clienta-inline');
    if (toggleNueva) {
        toggleNueva.addEventListener('click', () => {
            const box = document.getElementById('inline-nueva-clienta');
            if (box) box.classList.toggle('hidden');
        });
    }

    // Guardar clienta inline
    const btnGuardarInline = document.getElementById('btn-guardar-clienta-inline');
    if (btnGuardarInline) {
        btnGuardarInline.addEventListener('click', async () => {
            const nombre = document.getElementById('inline-clienta-nombre').value.trim();
            const telefono = document.getElementById('inline-clienta-telefono').value.trim();
            if (!nombre || !telefono) {
                alert('Ingresa al menos el nombre y teléfono de la clienta.');
                return;
            }
            const nueva = await Store.upsertClienta({
                nombre,
                telefono,
                notasTecnicas: ''
            });
            selectClientaForCita(nueva);
            document.getElementById('inline-nueva-clienta').classList.add('hidden');
            document.getElementById('inline-clienta-nombre').value = '';
            document.getElementById('inline-clienta-telefono').value = '';
            showToast(`Clienta "${nueva.nombre}" fijada`);
        });
    }

    // Búsqueda instantánea de clienta en modal cita
    const clientaSearchInput = document.getElementById('cita-clienta-search');
    const clientasDropdown = document.getElementById('cita-clientas-dropdown');

    if (clientaSearchInput && clientasDropdown) {
        clientaSearchInput.addEventListener('input', () => {
            const term = clientaSearchInput.value.toLowerCase().trim();
            if (!term) {
                clientasDropdown.classList.remove('show');
                return;
            }
            const matches = Store.getClientas().filter(c =>
                (c.nombre && c.nombre.toLowerCase().includes(term)) ||
                (c.telefono && c.telefono.includes(term))
            ).slice(0, 8);

            if (matches.length === 0) {
                clientasDropdown.innerHTML = `
                    <div class="client-search-item" style="color:var(--text-muted); cursor:default;">
                        Sin coincidencias. Toca "+ Clienta nueva" arriba.
                    </div>`;
            } else {
                clientasDropdown.innerHTML = matches.map(c => `
                    <div class="client-search-item" data-id="${c.id}">
                        <strong>${c.nombre}</strong>
                        <span style="color:var(--text-muted); font-size:12px;">${c.telefono}</span>
                    </div>
                `).join('');

                clientasDropdown.querySelectorAll('.client-search-item[data-id]').forEach(item => {
                    item.addEventListener('click', () => {
                        const cli = matches.find(m => m.id === item.dataset.id);
                        if (cli) selectClientaForCita(cli);
                    });
                });
            }
            clientasDropdown.classList.add('show');
        });
    }

    // Botón Cambiar clienta en cita
    const btnCambiarCli = document.getElementById('btn-cambiar-clienta-cita');
    if (btnCambiarCli) {
        btnCambiarCli.addEventListener('click', () => {
            AppState.selectedClientaForCita = null;
            document.getElementById('cita-clienta-id').value = '';
            document.getElementById('cita-clienta-selected').classList.add('hidden');
            document.getElementById('cita-search-container').classList.remove('hidden');
            if (clientaSearchInput) {
                clientaSearchInput.value = '';
                clientaSearchInput.focus();
            }
        });
    }

    // Actualización de cálculos en tiempo real
    ['cita-fecha', 'cita-hora'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateCitaCalculation);
    });

    const formCita = document.getElementById('form-cita');
    if (formCita) formCita.addEventListener('submit', handleSaveCita);

    const formPago = document.getElementById('form-pago');
    if (formPago) formPago.addEventListener('submit', handleSavePago);

    const formReagendar = document.getElementById('form-reagendar');
    if (formReagendar) formReagendar.addEventListener('submit', handleSaveReagendar);

    ['reagendar-fecha', 'reagendar-hora'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', updateReagendarCalculation);
    });
}

function selectClientaForCita(clienta) {
    AppState.selectedClientaForCita = clienta;
    document.getElementById('cita-clienta-id').value = clienta.id;
    document.getElementById('cita-selected-nombre').textContent = clienta.nombre;
    document.getElementById('cita-selected-telefono').textContent = `(${clienta.telefono})`;
    document.getElementById('cita-clienta-selected').classList.remove('hidden');
    document.getElementById('cita-search-container').classList.add('hidden');
    const dd = document.getElementById('cita-clientas-dropdown');
    if (dd) dd.classList.remove('show');
}

function renderWeekStrip() {
    const container = document.getElementById('week-strip');
    if (!container) return;
    const citas = Store.getCitas();
    const baseDate = new Date(AppState.selectedDate + 'T12:00:00');
    const diasSemana = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    let html = '';
    for (let offset = -3; offset <= 3; offset++) {
        const d = new Date(baseDate);
        d.setDate(baseDate.getDate() + offset);
        const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const isActive = iso === AppState.selectedDate;
        const hasCitas = citas.some(c => c.fecha === iso && c.estado !== 'cancelada');

        html += `
      <button type="button" class="day-chip ${isActive ? 'active' : ''}" data-date="${iso}">
        <span class="day-name">${diasSemana[d.getDay()]}</span>
        <span class="day-num">${d.getDate()}</span>
        ${hasCitas ? '<span class="day-dot"></span>' : ''}
      </button>
    `;
    }

    container.innerHTML = html;
    container.querySelectorAll('.day-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            AppState.selectedDate = chip.dataset.date;
            renderAgenda();
        });
    });
}

function renderAgenda() {
    const picker = document.getElementById('agenda-date-picker');
    if (picker) picker.value = AppState.selectedDate;
    renderWeekStrip();

    const config = Store.getConfig();
    const citasDia = Store.getCitas()
        .filter(c => c.fecha === AppState.selectedDate)
        .sort((a, b) => timeToMinutes(a.horaInicio) - timeToMinutes(b.horaInicio));

    const activas = citasDia.filter(c => c.estado !== 'cancelada');
    const estimado = activas.reduce((acc, c) => acc + Number(c.total || 0), 0);
    const porCobrar = activas.reduce((acc, c) => acc + Number(c.saldoPendiente || 0), 0);

    const kpiCount = document.getElementById('kpi-citas-count');
    if (kpiCount) kpiCount.textContent = activas.length;

    const kpiEst = document.getElementById('kpi-citas-estimado');
    if (kpiEst) kpiEst.textContent = formatMoney(estimado);

    const kpiPend = document.getElementById('kpi-citas-pendiente');
    if (kpiPend) kpiPend.textContent = formatMoney(porCobrar);

    const listEl = document.getElementById('agenda-list');
    if (!listEl) return;

    if (citasDia.length === 0) {
        listEl.innerHTML = `
      <div class="empty-state">
        No hay citas agendadas para este día.<br/>
        Toca el botón <strong>+</strong> abajo para agendar.
      </div>`;
        return;
    }

    listEl.innerHTML = citasDia.map(cita => {
        const estadoInfo = ESTADOS_CONFIG[cita.estado] || ESTADOS_CONFIG.pendiente;
        const serviciosNames = (cita.servicios || []).map(s => s.nombre).join(' • ');
        const waLink = generarLinkConfirmacionCita(cita, config);

        return `
      <article class="cita-card estado-${cita.estado}">
        <div class="cita-top">
          <span class="cita-time">⏰ ${cita.horaInicio} – ${cita.horaFin}</span>
          <span class="status-badge badge-${cita.estado}">${estadoInfo.label}</span>
        </div>

        <div class="cita-clienta">${cita.clientaNombre}</div>
        <div class="cita-servicios">${serviciosNames}</div>
        ${cita.notasCita ? `<div class="cita-nota">📝 ${cita.notasCita}</div>` : ''}

        <div class="cita-finance-row">
          <span>Total: <strong>${formatMoney(cita.total)}</strong> · Abonado: <strong>${formatMoney(cita.abonado)}</strong></span>
          ${cita.saldoPendiente > 0
                ? `<span class="finance-pill finance-pendiente">Resta ${formatMoney(cita.saldoPendiente)}</span>`
                : `<span class="finance-pill finance-pagado">Pagado ✓</span>`
            }
        </div>

        <div class="cita-actions">
          <a href="${waLink}" target="_blank" rel="noopener" class="btn-action wa">📲 Confirmar WhatsApp</a>
          ${cita.saldoPendiente > 0 && cita.estado !== 'cancelada'
                ? `<button type="button" class="btn-action cobrar" onclick="openPagoModal('${cita.id}')">💵 Cobrar</button>`
                : ''
            }
          ${estadoInfo.next
                ? `<button type="button" class="btn-action next-state" onclick="avanzarEstadoCita('${cita.id}')">${estadoInfo.nextLabel}</button>`
                : ''
            }
          ${cita.estado !== 'cancelada'
                ? `<button type="button" class="btn-action reagendar" onclick="openReagendarModal('${cita.id}')">🔄 Reagendar</button>`
                : ''
            }
          <button type="button" class="btn-action" onclick="openCitaModal('${cita.id}')">Editar</button>
          ${cita.estado !== 'cancelada'
                ? `<button type="button" class="btn-action" onclick="cancelarCita('${cita.id}')">Cancelar</button>`
                : `<button type="button" class="btn-action eliminar" onclick="eliminarCita('${cita.id}')">🗑️ Eliminar</button>`
            }
        </div>
      </article>
    `;
    }).join('');
}

function openCitaModal(citaId = null) {
    const form = document.getElementById('form-cita');
    if (!form) return;
    form.reset();
    document.getElementById('cita-id').value = citaId || '';

    const inlineBox = document.getElementById('inline-nueva-clienta');
    if (inlineBox) inlineBox.classList.add('hidden');

    const dropdown = document.getElementById('cita-clientas-dropdown');
    if (dropdown) dropdown.classList.remove('show');

    const hint = document.getElementById('cita-abono-bs-hint');
    if (hint) hint.classList.add('hidden');

    const servicios = Store.getServicios();
    const checklist = document.getElementById('cita-servicios-checklist');

    let citaEditar = null;
    if (citaId) {
        citaEditar = Store.getCitas().find(c => c.id === citaId);
    }

    const selectedServiceIds = citaEditar ? (citaEditar.servicios || []).map(s => s.id) : [];

    if (checklist) {
        checklist.innerHTML = servicios.map(s => `
        <label class="service-check-item">
          <span class="service-check-left">
            <input type="checkbox" name="cita-srv" value="${s.id}" ${selectedServiceIds.includes(s.id) ? 'checked' : ''} />
            <span>${s.nombre} <small style="color:var(--text-muted)">(${s.duracion}m)</small></span>
          </span>
          <strong>${formatMoney(s.precio)}</strong>
        </label>
      `).join('');

        checklist.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', updateCitaCalculation);
        });
    }

    if (citaEditar) {
        document.getElementById('modal-cita-title').textContent = 'Editar Cita';
        const clienta = Store.getClientas().find(c => c.id === citaEditar.clientaId) || {
            id: citaEditar.clientaId,
            nombre: citaEditar.clientaNombre,
            telefono: citaEditar.clientaTelefono
        };
        selectClientaForCita(clienta);

        document.getElementById('cita-fecha').value = citaEditar.fecha;
        document.getElementById('cita-hora').value = citaEditar.horaInicio;
        document.getElementById('cita-notas').value = citaEditar.notasCita || '';
        document.getElementById('cita-abono-section').classList.add('hidden');
    } else {
        document.getElementById('modal-cita-title').textContent = 'Nueva Cita';
        AppState.selectedClientaForCita = null;
        document.getElementById('cita-clienta-id').value = '';
        document.getElementById('cita-clienta-selected').classList.add('hidden');
        document.getElementById('cita-search-container').classList.remove('hidden');
        document.getElementById('cita-clienta-search').value = '';

        document.getElementById('cita-fecha').value = AppState.selectedDate;
        document.getElementById('cita-hora').value = '10:00';
        document.getElementById('cita-abono-section').classList.remove('hidden');
    }

    updateCitaCalculation();
    openModal('modal-cita');
}

function getSelectedServicesFromModal() {
    const allServicios = Store.getServicios();
    const checkedIds = Array.from(document.querySelectorAll('input[name="cita-srv"]:checked')).map(cb => cb.value);
    return allServicios.filter(s => checkedIds.includes(s.id));
}

function updateCitaCalculation() {
    const selectedServices = getSelectedServicesFromModal();
    const duracionTotal = selectedServices.reduce((acc, s) => acc + Number(s.duracion), 0);
    const precioTotal = selectedServices.reduce((acc, s) => acc + Number(s.precio), 0);

    const fechaEl = document.getElementById('cita-fecha');
    const horaInicioEl = document.getElementById('cita-hora');
    if (!fechaEl || !horaInicioEl) return true;

    const fecha = fechaEl.value;
    const horaInicio = horaInicioEl.value;
    const horaFin = duracionTotal > 0 ? calcularHoraFin(horaInicio, duracionTotal) : horaInicio;

    const calcHorario = document.getElementById('calc-horario');
    if (calcHorario) calcHorario.textContent = `${horaInicio || '--:--'} a ${horaFin || '--:--'} (${duracionTotal} min)`;

    const calcTotal = document.getElementById('calc-total');
    if (calcTotal) calcTotal.textContent = formatMoney(precioTotal);

    const conflictBox = document.getElementById('calc-conflict-alert');
    if (fecha && horaInicio && duracionTotal > 0 && conflictBox) {
        const id = document.getElementById('cita-id').value;
        const check = validarDisponibilidad({ id, fecha, horaInicio, horaFin }, Store.getCitas());
        if (!check.disponible) {
            conflictBox.textContent = `⚠️ Cruce de horario con ${check.conflictoCon.clientaNombre} (${check.conflictoCon.horaInicio} - ${check.conflictoCon.horaFin})`;
            conflictBox.classList.remove('hidden');
            return false;
        }
    }
    if (conflictBox) conflictBox.classList.add('hidden');
    return true;
}

async function handleSaveCita(e) {
    e.preventDefault();
    const selectedServices = getSelectedServicesFromModal();
    if (selectedServices.length === 0) {
        alert('Selecciona al menos un servicio.');
        return;
    }

    const isLibre = updateCitaCalculation();
    if (!isLibre) {
        alert('Existe un cruce de horario con otra cita existente. Ajusta la hora.');
        return;
    }

    const clienta = AppState.selectedClientaForCita;
    if (!clienta || !clienta.id) {
        alert('Selecciona una clienta usando el buscador o regístrala con "+ Clienta nueva".');
        return;
    }

    const idExistente = document.getElementById('cita-id').value;
    const fecha = document.getElementById('cita-fecha').value;
    const horaInicio = document.getElementById('cita-hora').value;
    const duracionTotal = selectedServices.reduce((acc, s) => acc + Number(s.duracion), 0);
    const horaFin = calcularHoraFin(horaInicio, duracionTotal);
    const total = selectedServices.reduce((acc, s) => acc + Number(s.precio), 0);
    const notasCita = document.getElementById('cita-notas').value.trim();

    if (idExistente) {
        const prev = Store.getCitas().find(c => c.id === idExistente);
        const abonado = Number(prev.abonado || 0);
        const saldoPendiente = Math.max(0, total - abonado);
        await Store.upsertCita({
            ...prev,
            clientaId: clienta.id,
            clientaNombre: clienta.nombre,
            clientaTelefono: clienta.telefono,
            fecha,
            horaInicio,
            horaFin,
            servicios: selectedServices,
            total,
            saldoPendiente,
            notasCita
        });
        showToast('Cita actualizada');
    } else {
        const abonoMonto = Math.min(total, Math.max(0, Number(document.getElementById('cita-abono-monto').value || 0)));
        const abonoMetodo = document.getElementById('cita-abono-metodo').value;
        const abonoRef = document.getElementById('cita-abono-ref').value.trim();
        const citaId = 'cita_' + Date.now();

        await Store.upsertCita({
            id: citaId,
            clientaId: clienta.id,
            clientaNombre: clienta.nombre,
            clientaTelefono: clienta.telefono,
            fecha,
            horaInicio,
            horaFin,
            servicios: selectedServices,
            total,
            abonado: abonoMonto,
            saldoPendiente: total - abonoMonto,
            estado: abonoMonto > 0 ? 'confirmada' : 'pendiente',
            notasCita
        });

        if (abonoMonto > 0) {
            const pagoObj = await Store.addPago({
                citaId,
                clientaNombre: clienta.nombre,
                fecha: getLocalTodayISO(),
                monto: abonoMonto,
                tipo: abonoMonto >= total ? 'pago_completo' : 'abono',
                metodo: abonoMetodo,
                referencia: abonoRef
            });

            mostrarModalReciboWA(pagoObj, {
                clientaNombre: clienta.nombre,
                clientaTelefono: clienta.telefono,
                saldoPendiente: total - abonoMonto
            });
        }
        showToast('Cita agendada con éxito');
    }

    AppState.selectedDate = fecha;
    closeModal('modal-cita');
    renderAll();
}

/* ==================== REAGENDAR CITA ==================== */
function openReagendarModal(citaId) {
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    AppState.reagendarCitaId = citaId;
    document.getElementById('reagendar-cita-id').value = citaId;
    document.getElementById('reagendar-clienta-nombre').textContent = cita.clientaNombre;
    document.getElementById('reagendar-servicios-resumen').textContent =
        (cita.servicios || []).map(s => s.nombre).join(' • ');

    document.getElementById('reagendar-fecha').value = cita.fecha;
    document.getElementById('reagendar-hora').value = cita.horaInicio;

    updateReagendarCalculation();
    openModal('modal-reagendar');
}

function updateReagendarCalculation() {
    const citaId = document.getElementById('reagendar-cita-id').value;
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return false;

    const fecha = document.getElementById('reagendar-fecha').value;
    const horaInicio = document.getElementById('reagendar-hora').value;
    const duracion = (cita.servicios || []).reduce((acc, s) => acc + Number(s.duracion), 0);
    const horaFin = calcularHoraFin(horaInicio, duracion);

    const calcEl = document.getElementById('reagendar-calc-horario');
    if (calcEl) calcEl.textContent = `${horaInicio} a ${horaFin} (${duracion} min)`;

    const conflictBox = document.getElementById('reagendar-conflict-alert');
    const check = validarDisponibilidad({ id: citaId, fecha, horaInicio, horaFin }, Store.getCitas());

    if (!check.disponible && conflictBox) {
        conflictBox.textContent = `⚠️ Cruce con ${check.conflictoCon.clientaNombre} (${check.conflictoCon.horaInicio} - ${check.conflictoCon.horaFin})`;
        conflictBox.classList.remove('hidden');
        return false;
    }

    if (conflictBox) conflictBox.classList.add('hidden');
    return true;
}

async function handleSaveReagendar(e) {
    e.preventDefault();
    const citaId = document.getElementById('reagendar-cita-id').value;
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    const isLibre = updateReagendarCalculation();
    if (!isLibre) {
        alert('Existe un cruce de horario con otra cita. Selecciona otra hora.');
        return;
    }

    const nuevaFecha = document.getElementById('reagendar-fecha').value;
    const nuevaHora = document.getElementById('reagendar-hora').value;
    const duracion = (cita.servicios || []).reduce((acc, s) => acc + Number(s.duracion), 0);
    const nuevaHoraFin = calcularHoraFin(nuevaHora, duracion);

    cita.fecha = nuevaFecha;
    cita.horaInicio = nuevaHora;
    cita.horaFin = nuevaHoraFin;

    await Store.upsertCita(cita);
    AppState.selectedDate = nuevaFecha;
    closeModal('modal-reagendar');
    renderAll();
    showToast(`Cita reagendada para el ${formatearFechaCorta(nuevaFecha)}`);
}

/* ==================== ESTADOS & CANCELAR / ELIMINAR CITAS ==================== */
function avanzarEstadoCita(citaId) {
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;
    const nextEstado = ESTADOS_CONFIG[cita.estado]?.next;
    if (!nextEstado) return;

    cita.estado = nextEstado;
    Store.upsertCita(cita).then(() => {
        renderAll();
        if (nextEstado === 'completada' && cita.saldoPendiente > 0) {
            openPagoModal(cita.id);
        } else {
            showToast(`Estado: ${ESTADOS_CONFIG[nextEstado].label}`);
        }
    });
}

function cancelarCita(citaId) {
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    if (!confirm(`¿Cancelar la cita de ${cita.clientaNombre} y liberar el cupo en agenda?`)) return;

    cita.estado = 'cancelada';
    Store.upsertCita(cita).then(() => {
        renderAll();
        showToast('Cita cancelada — Horario liberado');
    });
}

async function eliminarCita(citaId) {
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    if (cita.abonado > 0) {
        const accion = confirm(
            `Esta cita tiene un abono registrado de ${formatMoney(cita.abonado)}.\n\n` +
            `• Presiona [Aceptar] para eliminar la cita pero MANTENER el pago en Caja (saldo a favor / ingreso).\n` +
            `• Presiona [Cancelar] si prefieres ELIMINAR también el movimiento de Caja.`
        );

        const eliminarCaja = !accion;
        await Store.deleteCita(citaId, eliminarCaja);
        renderAll();
        showToast(eliminarCaja ? 'Cita y pago de caja eliminados' : 'Cita eliminada (Abono conservado en caja)');
    } else {
        if (!confirm('¿Eliminar definitivamente esta cita del historial?')) return;
        await Store.deleteCita(citaId, false);
        renderAll();
        showToast('Cita eliminada');
    }
}

/* ==================== VISTA 4: CAJA / PAGOS / TASA DE CAMBIO ==================== */
function setupCajaEvents() {
    document.querySelectorAll('#caja-period-filter .pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#caja-period-filter .pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            AppState.cajaPeriod = btn.dataset.period;
            renderCaja();
        });
    });
}

function renderCaja() {
    const hoy = getLocalTodayISO();
    const hace7Dias = getRelativeDateISO(-7);
    const mesActual = hoy.slice(0, 7);

    const pagosFiltrados = Store.getPagos().filter(p => {
        if (AppState.cajaPeriod === 'hoy') return p.fecha === hoy;
        if (AppState.cajaPeriod === 'semana') return p.fecha >= hace7Dias;
        return (p.fecha || '').startsWith(mesActual);
    });

    const totalCobrado = pagosFiltrados.reduce((acc, p) => acc + Number(p.monto || 0), 0);
    const totalPendiente = Store.getCitas()
        .filter(c => c.estado !== 'cancelada')
        .reduce((acc, c) => acc + Number(c.saldoPendiente || 0), 0);

    const totalCobradoEl = document.getElementById('caja-total-cobrado');
    if (totalCobradoEl) totalCobradoEl.textContent = formatMoney(totalCobrado);

    const totalPendienteEl = document.getElementById('caja-total-pendiente');
    if (totalPendienteEl) totalPendienteEl.textContent = formatMoney(totalPendiente);

    const metodos = ['Yape', 'Plin', 'Efectivo', 'Transferencia BCP/BBVA', 'Tarjeta / POS'];
    const metodosList = document.getElementById('caja-metodos-list');
    if (metodosList) {
        metodosList.innerHTML = metodos.map(m => {
            const subtotal = pagosFiltrados
                .filter(p => p.metodo === m)
                .reduce((acc, p) => acc + Number(p.monto || 0), 0);

            return `
          <div class="metodo-item">
            <div class="metodo-item-top">
              <span>${m}</span>
              <strong>${formatMoney(subtotal)}</strong>
            </div>
          </div>
        `;
        }).join('');
    }

    const pagosList = document.getElementById('pagos-list');
    if (!pagosList) return;

    if (pagosFiltrados.length === 0) {
        pagosList.innerHTML = `<div class="empty-state">No hay movimientos registrados en este período.</div>`;
        return;
    }

    const tipoLabels = {
        abono: 'Abono / Seña',
        saldo_final: 'Saldo final',
        pago_completo: 'Pago completo'
    };

    pagosList.innerHTML = pagosFiltrados.map(p => {
        return `
      <article class="pago-card">
        <div class="cita-top">
          <strong>${p.clientaNombre}</strong>
          <strong class="text-success">+ ${formatMoney(p.monto)}</strong>
        </div>
        <div class="cita-servicios">
          ${tipoLabels[p.tipo] || p.tipo} · <strong>${p.metodo}</strong>
          ${p.referencia ? ` · Ref: ${p.referencia}` : ''}
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="kpi-label">${formatearFechaCorta(p.fecha)}</span>
          <button type="button" class="btn-action eliminar" style="padding:4px 8px; font-size:11px;"
            onclick="eliminarPago('${p.id}')">✕ Eliminar</button>
        </div>
      </article>
    `;
    }).join('');
}

async function eliminarPago(pagoId) {
    const pago = Store.getPagos().find(p => p.id === pagoId);
    if (!pago) return;

    if (!confirm(`¿Eliminar este movimiento de cobro de ${formatMoney(pago.monto)} de ${pago.clientaNombre}? Se recalculará el saldo de la cita.`)) {
        return;
    }

    await Store.deletePago(pagoId, true);
    renderAll();
    showToast('Movimiento de caja eliminado y saldo recalculado');
}

/* ==================== REGISTRAR PAGO (COBRO) ==================== */
function openPagoModal(citaId) {
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    document.getElementById('form-pago').reset();
    document.getElementById('pago-cita-id').value = cita.id;
    document.getElementById('pago-clienta-nombre').textContent = cita.clientaNombre;
    document.getElementById('pago-total-cita').textContent = formatMoney(cita.total);
    document.getElementById('pago-abonado-cita').textContent = formatMoney(cita.abonado);
    document.getElementById('pago-saldo-cita').textContent = formatMoney(cita.saldoPendiente);
    document.getElementById('pago-monto').value = cita.saldoPendiente.toFixed(2);
    document.getElementById('pago-monto').max = cita.saldoPendiente;

    openModal('modal-pago');
}

async function handleSavePago(e) {
    e.preventDefault();
    const citaId = document.getElementById('pago-cita-id').value;
    const cita = Store.getCitas().find(c => c.id === citaId);
    if (!cita) return;

    const monto = Number(document.getElementById('pago-monto').value || 0);
    if (monto <= 0 || monto > cita.saldoPendiente + 0.01) {
        alert('Ingresa un monto válido que no supere el saldo pendiente.');
        return;
    }

    const metodo = document.getElementById('pago-metodo').value;
    const referencia = document.getElementById('pago-referencia').value.trim();
    const completar = document.getElementById('pago-marcar-completada').checked;

    cita.abonado = Number((cita.abonado + monto).toFixed(2));
    cita.saldoPendiente = Math.max(0, Number((cita.total - cita.abonado).toFixed(2)));
    if (completar) cita.estado = 'completada';

    await Store.upsertCita(cita);
    const nuevoPago = await Store.addPago({
        citaId: cita.id,
        clientaNombre: cita.clientaNombre,
        fecha: getLocalTodayISO(),
        monto,
        tipo: cita.saldoPendiente === 0 ? 'saldo_final' : 'abono',
        metodo,
        referencia
    });

    closeModal('modal-pago');
    renderAll();
    showToast(`Cobro registrado: ${formatMoney(monto)}`);

    mostrarModalReciboWA(nuevoPago, cita);
}

function mostrarModalReciboWA(pago, cita) {
    const config = Store.getConfig();
    const link = generarLinkReciboPago(pago, cita, config);
    const btnWA = document.getElementById('btn-enviar-recibo-wa');
    if (btnWA) btnWA.href = link;
    openModal('modal-recibo-wa');
}

/* ==================== VISTA 2: CLIENTAS ==================== */
function setupClientasEvents() {
    const searchCli = document.getElementById('search-clientas');
    if (searchCli) {
        searchCli.addEventListener('input', e => {
            AppState.clientSearch = e.target.value.toLowerCase();
            renderClientas();
        });
    }

    const btnNuevaCli = document.getElementById('btn-nueva-clienta');
    if (btnNuevaCli) {
        btnNuevaCli.addEventListener('click', () => {
            openClientaModal();
        });
    }

    const formCli = document.getElementById('form-clienta');
    if (formCli) {
        formCli.addEventListener('submit', async e => {
            e.preventDefault();
            const id = document.getElementById('clienta-id').value || 'cli_' + Date.now();
            await Store.upsertClienta({
                id,
                nombre: document.getElementById('clienta-nombre').value.trim(),
                telefono: document.getElementById('clienta-telefono').value.trim(),
                notasTecnicas: document.getElementById('clienta-notas-tecnicas').value.trim()
            });
            closeModal('modal-clienta');
            renderClientas();
            showToast('Clienta guardada');
        });
    }

    const btnEliminarCli = document.getElementById('btn-eliminar-clienta');
    if (btnEliminarCli) {
        btnEliminarCli.addEventListener('click', async () => {
            const id = document.getElementById('clienta-id').value;
            if (!id) return;

            try {
                if (confirm('¿Eliminar esta clienta de tu cartera?')) {
                    await Store.deleteClienta(id);
                    closeModal('modal-clienta');
                    renderClientas();
                    showToast('Clienta eliminada');
                }
            } catch (err) {
                alert(err.message || 'No se pudo eliminar la clienta');
            }
        });
    }
}

function renderClientas() {
    const clientas = Store.getClientas().filter(c =>
        (c.nombre && c.nombre.toLowerCase().includes(AppState.clientSearch)) ||
        (c.telefono && c.telefono.includes(AppState.clientSearch))
    );
    const citas = Store.getCitas();
    const listEl = document.getElementById('clientas-list');
    if (!listEl) return;

    if (clientas.length === 0) {
        listEl.innerHTML = `<div class="empty-state">No se encontraron clientas en la cartera.</div>`;
        return;
    }

    listEl.innerHTML = clientas.map(cli => {
        const susCitas = citas.filter(c => c.clientaId === cli.id && c.estado !== 'cancelada');
        const deuda = susCitas.reduce((acc, c) => acc + Number(c.saldoPendiente || 0), 0);

        return `
      <article class="card" onclick="openClientaModal('${cli.id}')" style="cursor:pointer">
        <div class="cita-top">
          <strong style="font-size:16px">${cli.nombre}</strong>
          ${deuda > 0
                ? `<span class="finance-pill finance-pendiente">Saldo: ${formatMoney(deuda)}</span>`
                : `<span class="kpi-label">${susCitas.length} cita(s)</span>`
            }
        </div>
        <div class="cita-servicios">📱 ${cli.telefono}</div>
        ${cli.notasTecnicas ? `<div class="cita-nota">✨ ${cli.notasTecnicas}</div>` : ''}
      </article>
    `;
    }).join('');
}

function openClientaModal(clientaId = null) {
    const form = document.getElementById('form-clienta');
    if (!form) return;
    form.reset();
    document.getElementById('clienta-id').value = clientaId || '';
    const histSection = document.getElementById('clienta-historial-section');
    const deleteSection = document.getElementById('clienta-delete-section');
    const retoqueSection = document.getElementById('clienta-retoque-section');
    const btnRetoque = document.getElementById('btn-clienta-wa-retoque');

    if (clientaId) {
        const cli = Store.getClientas().find(c => c.id === clientaId);
        if (!cli) return;
        document.getElementById('modal-clienta-title').textContent = 'Ficha de Clienta';
        document.getElementById('clienta-nombre').value = cli.nombre;
        document.getElementById('clienta-telefono').value = cli.telefono;
        document.getElementById('clienta-notas-tecnicas').value = cli.notasTecnicas || '';

        const historial = Store.getCitas()
            .filter(c => c.clientaId === clientaId)
            .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

        if (histSection) histSection.classList.remove('hidden');
        if (deleteSection) deleteSection.classList.remove('hidden');

        const histList = document.getElementById('clienta-historial-list');
        if (histList) {
            histList.innerHTML = historial.length
                ? historial.map(h => `
              <div class="historial-item">
                <strong>${formatearFechaCorta(h.fecha)} (${h.horaInicio})</strong> · ${formatMoney(h.total)}<br/>
                <span style="color:var(--text-muted)">${(h.servicios || []).map(s => s.nombre).join(', ')}</span>
              </div>
            `).join('')
                : '<p class="kpi-label">Sin citas registradas aún.</p>';
        }

        // Recordatorio de Retoque por WhatsApp
        const ultimaCompletada = historial.find(h => h.estado === 'completada') || historial[0];
        if (ultimaCompletada && retoqueSection && btnRetoque) {
            const dias = calcularDiasDesde(ultimaCompletada.fecha);
            const config = Store.getConfig();
            btnRetoque.href = generarLinkRecordatorioRetoque(cli, ultimaCompletada, config);
            btnRetoque.textContent = dias !== null
                ? `📲 Recordar Retoque por WhatsApp (${dias} días desde última cita)`
                : '📲 Recordar Retoque por WhatsApp';
            retoqueSection.classList.remove('hidden');
        } else if (retoqueSection) {
            retoqueSection.classList.add('hidden');
        }

    } else {
        document.getElementById('modal-clienta-title').textContent = 'Nueva Clienta';
        if (histSection) histSection.classList.add('hidden');
        if (deleteSection) deleteSection.classList.add('hidden');
        if (retoqueSection) retoqueSection.classList.add('hidden');
    }

    openModal('modal-clienta');
}

/* ==================== VISTA 3: SERVICIOS ==================== */
function setupServiciosEvents() {
    document.querySelectorAll('#servicios-filter .pill').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('#servicios-filter .pill').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            AppState.serviceCategory = btn.dataset.cat;
            renderServicios();
        });
    });

    const btnNuevoSrv = document.getElementById('btn-nuevo-servicio');
    if (btnNuevoSrv) {
        btnNuevoSrv.addEventListener('click', () => {
            openServicioModal();
        });
    }

    const formSrv = document.getElementById('form-servicio');
    if (formSrv) {
        formSrv.addEventListener('submit', async e => {
            e.preventDefault();
            const id = document.getElementById('servicio-id').value || 'srv_' + Date.now();
            await Store.upsertServicio({
                id,
                nombre: document.getElementById('servicio-nombre').value.trim(),
                categoria: document.getElementById('servicio-categoria').value,
                duracion: Number(document.getElementById('servicio-duracion').value),
                precio: Number(document.getElementById('servicio-precio').value)
            });
            closeModal('modal-servicio');
            renderServicios();
            showToast('Servicio guardado');
        });
    }
}

function renderServicios() {
    const list = Store.getServicios().filter(s =>
        AppState.serviceCategory === 'Todos' || s.categoria === AppState.serviceCategory
    );
    const container = document.getElementById('servicios-list');
    if (!container) return;

    if (list.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                No hay servicios en esta categoría.<br/>
                Toca <strong>+ Servicio</strong> o carga el catálogo base en Ajustes.
            </div>`;
        return;
    }

    container.innerHTML = list.map(s => `
    <article class="card">
      <div class="cita-top">
        <span class="status-badge badge-confirmada">${s.categoria}</span>
        <strong style="font-size:16px; color:var(--primary-dark)">${formatMoney(s.precio)}</strong>
      </div>
      <div class="cita-clienta">${s.nombre}</div>
      <div class="cita-servicios">⏱️ Duración estimada: ${s.duracion} minutos</div>
      <div class="cita-actions">
        <button type="button" class="btn-action" onclick="openServicioModal('${s.id}')">Editar</button>
        <button type="button" class="btn-action eliminar" onclick="eliminarServicio('${s.id}')">Eliminar</button>
      </div>
    </article>
  `).join('');
}

function openServicioModal(srvId = null) {
    const form = document.getElementById('form-servicio');
    if (!form) return;
    form.reset();
    document.getElementById('servicio-id').value = srvId || '';

    if (srvId) {
        const srv = Store.getServicios().find(s => s.id === srvId);
        if (!srv) return;
        document.getElementById('modal-servicio-title').textContent = 'Editar Servicio';
        document.getElementById('servicio-nombre').value = srv.nombre;
        document.getElementById('servicio-categoria').value = srv.categoria;
        document.getElementById('servicio-duracion').value = srv.duracion;
        document.getElementById('servicio-precio').value = srv.precio;
    } else {
        document.getElementById('modal-servicio-title').textContent = 'Nuevo Servicio';
    }

    openModal('modal-servicio');
}

async function eliminarServicio(srvId) {
    if (!confirm('¿Eliminar este servicio del catálogo?')) return;
    await Store.deleteServicio(srvId);
    renderServicios();
    showToast('Servicio eliminado');
}

// Exponer en window para retrocompatibilidad total con botones inline onclick
window.openCitaModal = openCitaModal;
window.openReagendarModal = openReagendarModal;
window.openPagoModal = openPagoModal;
window.openClientaModal = openClientaModal;
window.openServicioModal = openServicioModal;
window.avanzarEstadoCita = avanzarEstadoCita;
window.cancelarCita = cancelarCita;
window.eliminarCita = eliminarCita;
window.eliminarPago = eliminarPago;
window.eliminarServicio = eliminarServicio;
window.openModal = openModal;
window.closeModal = closeModal;
