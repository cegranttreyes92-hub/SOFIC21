/**
 * Lógica de Negocio (logic.js)
 * Horarios, prevención de cruces, formato netamente en Soles peruanos (S/)
 * y enlaces dinámicos para WhatsApp (Perú +51).
 */

const ESTADOS_CONFIG = {
    pendiente: { label: 'Pendiente', next: 'confirmada', nextLabel: 'Confirmar' },
    confirmada: { label: 'Confirmada', next: 'en_proceso', nextLabel: 'Pasar a silla' },
    en_proceso: { label: 'En silla', next: 'completada', nextLabel: 'Finalizar' },
    completada: { label: 'Completada', next: null, nextLabel: null },
    cancelada: { label: 'Cancelada', next: null, nextLabel: null }
};

function timeToMinutes(hhmm) {
    if (!hhmm) return 0;
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function minutesToTime(totalMinutes) {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const h = String(Math.floor(clamped / 60)).padStart(2, '0');
    const m = String(clamped % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function calcularHoraFin(horaInicio, duracionMinutos) {
    const start = timeToMinutes(horaInicio);
    return minutesToTime(start + Number(duracionMinutos || 0));
}

/**
 * Verifica si una nueva cita se cruza con otra cita activa del mismo día.
 * Fórmula de solapamiento de intervalos: InicioA < FinB && FinA > InicioB
 */
function validarDisponibilidad({ id, fecha, horaInicio, horaFin }, todasLasCitas) {
    const startA = timeToMinutes(horaInicio);
    const endA = timeToMinutes(horaFin);

    const citasMismoDia = todasLasCitas.filter(
        c => c.fecha === fecha && c.estado !== 'cancelada' && c.id !== id
    );

    for (const existente of citasMismoDia) {
        const startB = timeToMinutes(existente.horaInicio);
        const endB = timeToMinutes(existente.horaFin);

        if (startA < endB && endA > startB) {
            return { disponible: false, conflictoCon: existente };
        }
    }

    return { disponible: true, conflictoCon: null };
}

/**
 * Normaliza números móviles de Perú (9 dígitos comenzando en 9 -> prefijo internacional 51)
 */
function formatearTelefonoWhatsApp(telefono) {
    const digits = String(telefono || '').replace(/\D/g, '');
    if (digits.length === 9 && digits.startsWith('9')) {
        return '51' + digits;
    }
    if (digits.length === 11 && digits.startsWith('519')) {
        return digits;
    }
    return digits;
}

function formatearFechaCorta(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    return `${d}/${m}/${y}`;
}

/**
 * Formateador oficial de moneda en Soles peruanos (S/)
 */
function formatMoney(amount) {
    const num = Number(amount || 0);
    return `S/ ${num.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function calcularDiasDesde(isoDate) {
    if (!isoDate) return null;
    const past = new Date(isoDate + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diffTime = today.getTime() - past.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Plantilla 1: Confirmación de Cita por WhatsApp (Netamente en Soles)
 */
function generarLinkConfirmacionCita(cita, config = {}) {
    const phone = formatearTelefonoWhatsApp(cita.clientaTelefono);
    const serviciosTxt = (cita.servicios || []).map(s => `• ${s.nombre}`).join('\n');

    let saldoTxt = '';
    if (cita.saldoPendiente > 0) {
        saldoTxt = `\n💰 Saldo pendiente: *${formatMoney(cita.saldoPendiente)}*`;
    } else {
        saldoTxt = `\n✅ Estado de pago: *Pagado en su totalidad*`;
    }

    let abonoTxt = '';
    if (cita.abonado > 0) {
        abonoTxt = `\n💵 Abonado previamente: ${formatMoney(cita.abonado)}`;
    }

    const estudioNombre = config.nombreEstudio || 'nuestro Estudio';

    const mensaje =
        `Hola *${cita.clientaNombre}* ✨ Te saludamos de *${estudioNombre}* para confirmar los detalles de tu cita:\n\n` +
        `📅 Fecha: *${formatearFechaCorta(cita.fecha)}*\n` +
        `⏰ Horario: *${cita.horaInicio} a ${cita.horaFin}*\n` +
        `💅🏻 Servicios:\n${serviciosTxt}\n\n` +
        `🏷️ Total servicio: *${formatMoney(cita.total)}*` +
        `${abonoTxt}` +
        `${saldoTxt}\n\n` +
        `📍 ¿Nos confirmas tu asistencia? Por favor llegar 5 minutos antes. ¡Te esperamos! ✨`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Plantilla 2: Recibo de Pago por WhatsApp (Netamente en Soles)
 */
function generarLinkReciboPago(pago, cita = null, config = {}) {
    const phone = cita ? formatearTelefonoWhatsApp(cita.clientaTelefono) : '';
    const refTxt = pago.referencia ? `\n🧾 Ref / Operación: *${pago.referencia}*` : '';

    let saldoTxt = '';
    if (cita) {
        saldoTxt = cita.saldoPendiente > 0
            ? `\n⏳ Saldo restante: *${formatMoney(cita.saldoPendiente)}*`
            : `\n🎉 *¡Cuenta saldada en su totalidad!*`;
    }

    const estudioNombre = config.nombreEstudio || 'nuestro Estudio';

    const mensaje =
        `Hola *${pago.clientaNombre}* ✨ Comprobante de pago recibido en *${estudioNombre}*:\n\n` +
        `✅ Monto recibido: *${formatMoney(pago.monto)}*\n` +
        `💳 Método: *${pago.metodo}*` +
        `${refTxt}\n` +
        `📅 Fecha: *${formatearFechaCorta(pago.fecha)}*` +
        `${saldoTxt}\n\n` +
        `¡Muchas gracias por tu preferencia! 💅🏻✨`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

/**
 * Plantilla 3: Recordatorio de Mantenimiento / Retoque
 */
function generarLinkRecordatorioRetoque(clienta, ultimaCita, config = {}) {
    const phone = formatearTelefonoWhatsApp(clienta.telefono);
    const dias = ultimaCita ? calcularDiasDesde(ultimaCita.fecha) : 0;
    const estudioNombre = config.nombreEstudio || 'el estudio';
    const servicioTxt = ultimaCita && ultimaCita.servicios && ultimaCita.servicios.length
        ? ultimaCita.servicios.map(s => s.nombre).join(' / ')
        : 'tus servicios de cejas y uñas';

    let tiempoTxt = '';
    if (dias > 0) {
        tiempoTxt = `Han pasado *${dias} días* desde tu última visita (${formatearFechaCorta(ultimaCita.fecha)}).`;
    } else {
        tiempoTxt = `Ha pasado un tiempo desde tu última visita.`;
    }

    const mensaje =
        `Hola *${clienta.nombre}* ✨ Te escribimos con cariño desde *${estudioNombre}*.\n\n` +
        `${tiempoTxt}\n\n` +
        `Para mantener *${servicioTxt}* siempre impecables y cuidar la salud de tu uña y vello natural, es momento ideal para tu retoque.\n\n` +
        `🗓️ ¿Te gustaría apartar un cupo esta semana? ¡Escríbenos tu disponibilidad y te agendamos! 💖`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(mensaje)}`;
}

// Exposición global en window
window.ESTADOS_CONFIG = ESTADOS_CONFIG;
window.timeToMinutes = timeToMinutes;
window.minutesToTime = minutesToTime;
window.calcularHoraFin = calcularHoraFin;
window.validarDisponibilidad = validarDisponibilidad;
window.formatearTelefonoWhatsApp = formatearTelefonoWhatsApp;
window.formatearFechaCorta = formatearFechaCorta;
window.formatMoney = formatMoney;
window.calcularDiasDesde = calcularDiasDesde;
window.generarLinkConfirmacionCita = generarLinkConfirmacionCita;
window.generarLinkReciboPago = generarLinkReciboPago;
window.generarLinkRecordatorioRetoque = generarLinkRecordatorioRetoque;
