// =====================================================
// WhatsApp Webhook - Notificación de Transferencias
// =====================================================

/**
 * Envía una notificación de transferencia por WhatsApp
 * @param {Object} transferencia - Datos de la transferencia
 * @param {string} transferencia.fechahora - Fecha y hora de la transferencia
 * @param {string} transferencia.caso - Tipo: 'ingreso' o 'egreso'
 * @param {number} transferencia.monto - Monto de la transferencia
 * @param {string} transferencia.motivo - Motivo/descripción
 * @param {string} transferencia.subido_por_nombre - Nombre completo del usuario
 * @param {string} transferencia.foto_url - URL de la foto del comprobante
 * @param {Object} ferredatos - Configuración de la API desde la tabla ferredatos
 * @param {string} ferredatos.number - Número de WhatsApp destino
 * @param {string} ferredatos.apikey - API Key
 * @param {string} ferredatos.instance - Nombre de la instancia
 */
async function enviarNotificacionWhatsApp(transferencia, ferredatos) {
    try {
        // Formatear la fecha y hora
        const fecha = new Date(transferencia.fechahora);
        const fechaFormateada = fecha.toLocaleDateString('es-EC', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
        const horaFormateada = fecha.toLocaleTimeString('es-EC', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        // Determinar emoji según el tipo de movimiento
        const emoji = transferencia.caso === 'ingreso' ? '💰' : '💸';
        const tipoMovimiento = transferencia.caso === 'ingreso' ? 'INGRESO' : 'EGRESO';
        
        // Formatear el monto
        const montoFormateado = parseFloat(transferencia.monto).toFixed(2);

        // Construir el mensaje personalizado
        const mensaje = `${emoji} *Nueva Transferencia Registrada*

*DETALLES DEL MOVIMIENTO*


📅 *Fecha:* ${fechaFormateada}
🕐 *Hora:* ${horaFormateada}

${transferencia.caso === 'ingreso' ? '✅' : '❌'} *Tipo:* ${tipoMovimiento}
💵 *Monto:* $${montoFormateado}

📝 *Motivo:*
${transferencia.motivo}

👤 *Registrado por:*
${transferencia.subido_por_nombre}

📸 *Comprobante adjunto*

_Sistema de Gestión FERRESOLUCIONES_
_Powered by FERRESOLUCIONES Tech_`;

        // Configurar la URL del endpoint
        const url = `https://api.manasakilla.com/message/sendMedia/${ferredatos.instance}`;

        // Configurar las opciones de la petición
        const options = {
            method: 'POST',
            headers: {
                'apikey': ferredatos.apikey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                number: ferredatos.number,
                mediatype: 'image',
                mimetype: 'image/jpeg',
                caption: mensaje,
                media: transferencia.foto_url,
                fileName: `TRANSFERENCIA_${fechaFormateada.replace(/\//g, '-')}_${horaFormateada.replace(/:/g, '-')}.jpg`,
                delay: 1000,
                linkPreview: false
            })
        };

        // Enviar la petición
        console.log('Enviando notificación de WhatsApp...');
        const response = await fetch(url, options);
        const data = await response.json();

        if (response.ok) {
            console.log('✅ Notificación enviada exitosamente:', data);
            return { success: true, data };
        } else {
            console.error('❌ Error al enviar notificación:', data);
            return { success: false, error: data };
        }

    } catch (error) {
        console.error('❌ Error en enviarNotificacionWhatsApp:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Obtiene la configuración de WhatsApp desde Supabase
 * @param {Object} supabase - Cliente de Supabase
 * @returns {Object} Configuración de ferredatos
 */
async function obtenerConfiguracionWhatsApp(supabase) {
    try {
        const { data, error } = await supabase
            .from('ferredatos')
            .select('*')
            .limit(1)
            .single();

        if (error) {
            console.error('Error al obtener configuración de WhatsApp:', error);
            return null;
        }

        return data;
    } catch (error) {
        console.error('Error en obtenerConfiguracionWhatsApp:', error);
        return null;
    }
}

/**
 * Función principal que se llama después de guardar una transferencia
 * @param {Object} transferencia - Datos de la transferencia guardada
 * @param {Object} supabase - Cliente de Supabase
 */
async function notificarTransferencia(transferencia, supabase) {
    try {
        // Obtener configuración de WhatsApp
        const ferredatos = await obtenerConfiguracionWhatsApp(supabase);

        if (!ferredatos) {
            console.warn('⚠️ No se pudo obtener la configuración de WhatsApp');
            return { success: false, error: 'Configuración no disponible' };
        }

        // Enviar notificación
        const resultado = await enviarNotificacionWhatsApp(transferencia, ferredatos);

        return resultado;

    } catch (error) {
        console.error('Error en notificarTransferencia:', error);
        return { success: false, error: error.message };
    }
}


// Para usar en el navegador (si no usas módulos ES6)
if (typeof window !== 'undefined') {
    window.enviarNotificacionWhatsApp = enviarNotificacionWhatsApp;
    window.obtenerConfiguracionWhatsApp = obtenerConfiguracionWhatsApp;
    window.notificarTransferencia = notificarTransferencia;
}
