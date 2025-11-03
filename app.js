const supabaseUrl = 'https://lpsupabase.manasakilla.com';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.ElbNIiT2JsqJkVxUx4bRasL7GpN-Y1A1-5h09fsgpW8';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

let currentUser = null;
let currentUserData = null;
let allTransferencias = [];

const tbody = document.getElementById('transferencias-tbody');
const loading = document.getElementById('loading');
const errorMessage = document.getElementById('error-message');
const searchInput = document.getElementById('search-input');
const filterCaso = document.getElementById('filter-caso');

// Elementos que se ocultan para usuarios normales
const saldoCard = document.querySelector('.saldo-card');
const filtersCard = document.querySelector('.filters-card');

// Configurar vista desde caché antes de cargar datos
function setupViewFromCache() {
    const cachedRole = localStorage.getItem('userRole');
    const cachedNombres = localStorage.getItem('userNombres');
    const cachedApellidos = localStorage.getItem('userApellidos');
    
    if (cachedRole) {
        // Mostrar nombre en cache si existe
        if (cachedNombres && cachedApellidos) {
            document.getElementById('user-email').textContent = cachedNombres + ' ' + cachedApellidos;
        }
        
        // Configurar vista según rol en caché (instantáneo)
        const formCard = document.querySelector('.form-card');
        const statsGrid = document.querySelector('.stats-grid');
        const container = document.querySelector('.container');
        
        if (cachedRole === 'admin' || cachedRole === 'contador') {
            saldoCard.style.display = 'block';
            filtersCard.style.display = 'flex';
        } else {
            saldoCard.style.display = 'none';
            filtersCard.style.display = 'none';
            container.insertBefore(formCard, container.firstChild);
            document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar Movimiento del Día';
            statsGrid.style.marginTop = '30px';
        }
    }
    
    // Mostrar contenido con fade-in suave
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
}

async function checkAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
        localStorage.removeItem('userRole');
        localStorage.removeItem('userNombres');
        localStorage.removeItem('userApellidos');
        window.location.href = 'login.html';
        return;
    }

    currentUser = session.user;
    
    const { data: userData, error } = await supabase
        .from('usuarios_ferreteria')
        .select('*')
        .eq('user_id', currentUser.id)
        .maybeSingle();
    
    if (error) {
        console.error('Error al cargar usuario:', error);
    }
    
    if (userData) {
        currentUserData = userData;
        
        // Actualizar caché
        localStorage.setItem('userRole', userData.rol);
        localStorage.setItem('userNombres', userData.nombres);
        localStorage.setItem('userApellidos', userData.apellidos);
        
        document.getElementById('user-email').textContent = userData.nombres + ' ' + userData.apellidos;
        
        // Configurar vista según rol
        setupViewByRole(userData.rol);
    } else {
        console.log('Usuario no encontrado en usuarios_ferreteria, usando datos de auth');
        localStorage.setItem('userRole', 'usuario');
        document.getElementById('user-email').textContent = currentUser.email;
        // Si no tiene rol, tratarlo como usuario por defecto
        setupViewByRole('usuario');
    }
}

function setupViewByRole(rol) {
    const formCard = document.querySelector('.form-card');
    const statsGrid = document.querySelector('.stats-grid');
    const container = document.querySelector('.container');
    
    if (rol === 'admin' || rol === 'contador') {
        // Vista completa para admin y contador
        saldoCard.style.display = 'block';
        filtersCard.style.display = 'flex';
        
        // Orden normal: Saldo -> Stats -> Form -> Filters -> Table
        
        // Cargar todo
        loadSaldo();
        loadTransferencias();
    } else {
        // Vista simplificada para usuario
        saldoCard.style.display = 'none';
        filtersCard.style.display = 'none';
        
        // Reordenar: Form primero, luego Stats, luego Table
        // Mover el formulario al principio (después del navbar)
        container.insertBefore(formCard, container.firstChild);
        
        // Cambiar título del formulario
        document.getElementById('form-title').innerHTML = '<i class="fas fa-plus-circle"></i> Registrar nueva transferencia';
        
        // Stats después del form
        statsGrid.style.marginTop = '30px';
        
        // Solo cargar transferencias del día actual
        loadTransferenciasDelDia();
    }
}

async function loadSaldo() {
    try {
        const { data, error } = await supabase
            .from('saldo_actual')
            .select('*')
            .eq('id', 1)
            .single();
        
        if (error) throw error;
        
        if (data) {
            document.getElementById('saldo-total').textContent = 
                '$' + parseFloat(data.monto_total || 0).toFixed(2);
            
            const fecha = new Date(data.ultima_actualizacion);
            document.getElementById('ultima-actualizacion').textContent = 
                fecha.toLocaleString('es-ES');
        }
    } catch (error) {
        console.error('Error al cargar saldo:', error);
    }
}

// Función para enriquecer transferencias con nombres de usuarios
async function enrichTransferenciasWithNames(transferencias) {
    if (!transferencias || transferencias.length === 0) return transferencias;
    
    // Obtener todos los emails únicos
    const emails = [...new Set(transferencias.map(t => t.subido_por).filter(e => e))];
    
    if (emails.length === 0) return transferencias;
    
    // Consultar usuarios_ferreteria para obtener nombres
    const { data: usuarios, error } = await supabase
        .from('usuarios_ferreteria')
        .select('email, nombres, apellidos')
        .in('email', emails);
    
    if (error) {
        console.error('Error al cargar nombres de usuarios:', error);
        return transferencias;
    }
    
    // Crear mapa de email -> nombre completo
    const emailToName = {};
    if (usuarios) {
        usuarios.forEach(u => {
            emailToName[u.email] = u.nombres + ' ' + u.apellidos;
        });
    }
    
    // Enriquecer transferencias
    return transferencias.map(t => ({
        ...t,
        subido_por_nombre: emailToName[t.subido_por] || t.subido_por || 'N/A'
    }));
}

async function loadTransferencias() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    
    try {
        const { data, error } = await supabase
            .from('transferencias')
            .select('*')
            .order('fechahora', { ascending: false });
        
        if (error) throw error;
        
        // Enriquecer con nombres
        allTransferencias = await enrichTransferenciasWithNames(data || []);
        calculateStats(allTransferencias);
        renderTransferencias(allTransferencias);
        
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Error al cargar transferencias: ' + error.message;
        errorMessage.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

async function loadTransferenciasDelDia() {
    loading.style.display = 'block';
    errorMessage.style.display = 'none';
    
    try {
        // Obtener fecha de hoy en zona horaria de Ecuador (UTC-5)
        const ahora = new Date();
        const ecuadorOffset = -5 * 60; // Ecuador está en UTC-5
        const localOffset = ahora.getTimezoneOffset();
        const diferenciaMinutos = ecuadorOffset - localOffset;
        
        const fechaEcuador = new Date(ahora.getTime() + diferenciaMinutos * 60000);
        fechaEcuador.setHours(0, 0, 0, 0);
        
        const inicioDia = fechaEcuador.toISOString();
        
        const { data, error } = await supabase
            .from('transferencias')
            .select('*')
            .gte('fechahora', inicioDia)
            .order('fechahora', { ascending: false });
        
        if (error) throw error;
        
        // Enriquecer con nombres
        allTransferencias = await enrichTransferenciasWithNames(data || []);
        calculateStatsDelDia(allTransferencias);
        renderTransferencias(allTransferencias);
        
    } catch (error) {
        console.error('Error:', error);
        errorMessage.textContent = 'Error al cargar transferencias: ' + error.message;
        errorMessage.style.display = 'block';
    } finally {
        loading.style.display = 'none';
    }
}

function calculateStats(data) {
    const totalIngresos = data
        .filter(t => t.caso === 'ingreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);
    
    const totalEgresos = data
        .filter(t => t.caso === 'egreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);
    
    document.getElementById('total-ingresos').textContent = '$' + totalIngresos.toFixed(2);
    document.getElementById('total-egresos').textContent = '$' + totalEgresos.toFixed(2);
    document.getElementById('total-transacciones').textContent = data.length;
}

function calculateStatsDelDia(data) {
    const totalIngresos = data
        .filter(t => t.caso === 'ingreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);
    
    const totalEgresos = data
        .filter(t => t.caso === 'egreso')
        .reduce((sum, t) => sum + parseFloat(t.monto || 0), 0);
    
    // Obtener fecha actual en Ecuador
    const fechaHoy = new Date();
    const opciones = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Guayaquil' };
    const fechaFormateada = fechaHoy.toLocaleDateString('es-EC', opciones);
    
    // Actualizar etiquetas para indicar que son del día con la fecha
    document.querySelector('.stat-card.ingreso .stat-label').innerHTML = 
        '<i class="fas fa-calendar-day"></i> Ingresos de Hoy<br><small style="font-size: 0.75em; opacity: 0.8;">' + fechaFormateada + '</small>';
    document.querySelector('.stat-card.egreso .stat-label').innerHTML = 
        '<i class="fas fa-calendar-day"></i> Egresos de Hoy<br><small style="font-size: 0.75em; opacity: 0.8;">' + fechaFormateada + '</small>';
    document.querySelector('.stat-card.total').style.display = 'none'; // Ocultar total de transacciones
    
    document.getElementById('total-ingresos').textContent = '$' + totalIngresos.toFixed(2);
    document.getElementById('total-egresos').textContent = '$' + totalEgresos.toFixed(2);
}

function renderTransferencias(data) {
    if (data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px; color: #999;">No hay transferencias registradas</td></tr>';
        return;
    }

    tbody.innerHTML = data.map((t, index) => {
        const fecha = new Date(t.fechahora);
        const fechaFormato = fecha.toLocaleDateString('es-ES');
        const horaFormato = fecha.toLocaleTimeString('es-ES', { 
            hour: '2-digit', 
            minute: '2-digit' 
        });
        
        const badgeIcon = t.caso === 'ingreso' ? 
            '<i class="fas fa-arrow-up"></i> Ingreso' : 
            '<i class="fas fa-arrow-down"></i> Egreso';
        
        const signo = t.caso === 'ingreso' ? '+' : '-';
        
        return '<tr class="transferencia-row" data-index="' + index + '" style="cursor: pointer;">' +
            '<td><div style="font-weight: 600;">' + fechaFormato + '</div><div style="font-size: 0.9em; color: #666;">' + horaFormato + '</div></td>' +
            '<td><span class="badge badge-' + t.caso + '">' + badgeIcon + '</span></td>' +
            '<td class="monto-' + t.caso + '">' + signo + '$' + parseFloat(t.monto).toFixed(2) + '</td>' +
            '<td>' + t.motivo + '</td>' +
            '<td><div style="font-size: 0.9em;"><i class="fas fa-user"></i> ' + (t.subido_por_nombre || t.subido_por || 'N/A') + '</div></td>' +
            '</tr>';
    }).join('');
    
    // Agregar event listeners a las filas
    document.querySelectorAll('.transferencia-row').forEach(row => {
        row.addEventListener('click', () => {
            const index = parseInt(row.dataset.index);
            mostrarModal(data[index]);
        });
    });
}

function filterTransferencias() {
    const searchTerm = searchInput.value.toLowerCase();
    const casoFilter = filterCaso.value;
    
    const filtered = allTransferencias.filter(t => {
        const matchesSearch = t.motivo.toLowerCase().includes(searchTerm);
        const matchesCaso = !casoFilter || t.caso === casoFilter;
        return matchesSearch && matchesCaso;
    });
    
    renderTransferencias(filtered);
}

// Manejar botones de tipo (ingreso/egreso)
document.querySelectorAll('.tipo-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remover active de todos
        document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
        // Agregar active al clickeado
        this.classList.add('active');
        // Actualizar el input hidden
        document.getElementById('caso').value = this.dataset.tipo;
    });
});

// Variables para manejo de foto
let currentPhoto = null;
let currentPhotoURL = null;

const btnCamara = document.getElementById('btn-camara');
const btnGaleria = document.getElementById('btn-galeria');
const camaraInput = document.getElementById('camara-input');
const fotoInput = document.getElementById('foto-input');
const fotoPreview = document.getElementById('foto-preview');
const previewImg = document.getElementById('preview-img');
const previewFilename = document.getElementById('preview-filename');

// Función para confirmar cambio de foto
async function confirmarCambioFoto() {
    if (currentPhoto) {
        return confirm('¿Estás seguro de que deseas cambiar la foto actual?');
    }
    return true;
}

// Botón cámara
btnCamara.addEventListener('click', async () => {
    if (await confirmarCambioFoto()) {
        camaraInput.click();
    }
});

// Botón galería
btnGaleria.addEventListener('click', async () => {
    if (await confirmarCambioFoto()) {
        fotoInput.click();
    }
});

// Manejar selección de foto (cámara o galería)
async function handlePhotoSelection(file) {
    if (!file) return;
    
    currentPhoto = file;
    
    // Mostrar preview
    const reader = new FileReader();
    reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewFilename.textContent = file.name;
        fotoPreview.style.display = 'block';
    };
    reader.readAsDataURL(file);
}

camaraInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handlePhotoSelection(e.target.files[0]);
    } else if (currentPhoto) {
        // Usuario canceló, mantener foto actual
        camaraInput.value = '';
    }
});

fotoInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handlePhotoSelection(e.target.files[0]);
    } else if (currentPhoto) {
        // Usuario canceló, mantener foto actual
        fotoInput.value = '';
    }
});

// Función para subir foto al webhook
async function uploadPhotoToWebhook(file, motivo) {
    const formData = new FormData();
    
    // Generar path y filename
    const ahora = new Date();
    const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                   'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
    const mes = meses[ahora.getMonth()];
    const dia = String(ahora.getDate()).padStart(2, '0');
    const hora = String(ahora.getHours()).padStart(2, '0') + String(ahora.getMinutes()).padStart(2, '0');
    
    const path = `/FERRESOLUCIONES/TRANSFERENCIAS/${mes}/`;
    const motivoLimpio = motivo.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    const filename = `${dia}_${hora}_${motivoLimpio}.PNG`;
    
    // Crear un nuevo archivo con el nombre correcto
    const renamedFile = new File([file], filename, { type: file.type });
    
    formData.append('file', renamedFile);
    formData.append('path', path);
    formData.append('filename', filename);
    
    console.log('Subiendo archivo:', filename, 'al path:', path);
    
    const response = await fetch('https://webhookn8n.manasakilla.com/webhook/87f1603e-86ad-4547-8a87-a5d9f9b02115', {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) {
        throw new Error('Error al subir la foto');
    }
    
    const data = await response.json();
    console.log('Respuesta del webhook:', data);
    
    // Verificar que la respuesta tenga el formato correcto
    if (Array.isArray(data) && data.length > 0 && data[0].finalurl) {
        return data[0].finalurl;
    } else if (Array.isArray(data) && data.length > 0 && data[0].url) {
        return data[0].url;
    } else if (data.finalurl) {
        return data.finalurl;
    } else if (data.url) {
        return data.url;
    } else {
        throw new Error('Respuesta del webhook inválida');
    }
}

// Función para validar campos y mostrar errores
function validarCampos() {
    let camposVacios = [];
    
    // Obtener elementos
    const montoInput = document.getElementById('monto');
    const motivoInput = document.getElementById('motivo');
    const fotoButtonsDiv = document.querySelector('.foto-buttons');
    
    // Remover clases de error previas
    document.querySelectorAll('.campo-error, .campo-error-foto').forEach(el => {
        el.classList.remove('campo-error', 'campo-error-foto');
    });
    
    // Validar monto
    if (!montoInput.value || parseFloat(montoInput.value) <= 0) {
        montoInput.classList.add('campo-error');
        camposVacios.push('Monto');
        setTimeout(() => montoInput.classList.remove('campo-error'), 1500);
    }
    
    // Validar motivo
    if (!motivoInput.value.trim()) {
        motivoInput.classList.add('campo-error');
        camposVacios.push('Motivo');
        setTimeout(() => motivoInput.classList.remove('campo-error'), 1500);
    }
    
    // Validar foto
    if (!currentPhoto) {
        if (fotoButtonsDiv) {
            const buttons = fotoButtonsDiv.querySelectorAll('.btn-foto');
            buttons.forEach(btn => {
                btn.classList.add('campo-error-foto');
                setTimeout(() => btn.classList.remove('campo-error-foto'), 1500);
            });
        }
        camposVacios.push('Fotografía');
    }
    
    return camposVacios;
}

document.getElementById('transferencia-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Validar campos
    const camposVacios = validarCampos();
    
    if (camposVacios.length > 0) {
        showMessage('Por favor completa todos los campos requeridos', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submit-btn');
    const originalText = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Subiendo foto...';
    
    try {
        const motivo = document.getElementById('motivo').value;
        
        // Primero subir la foto al webhook
        const fotoURL = await uploadPhotoToWebhook(currentPhoto, motivo);
        
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        
        // Obtener el nombre completo del usuario
        let nombreCompleto = currentUser.email;
        if (currentUserData && currentUserData.nombres && currentUserData.apellidos) {
            nombreCompleto = currentUserData.nombres + ' ' + currentUserData.apellidos;
        }
        
        const transferencia = {
            caso: document.getElementById('caso').value,
            monto: parseFloat(document.getElementById('monto').value),
            motivo: motivo,
            fotografia: fotoURL,
            user_id: currentUser.id,
            subido_por: nombreCompleto
        };
        
        const { data, error } = await supabase
            .from('transferencias')
            .insert([transferencia])
            .select();
        
        if (error) throw error;
        
        // Resetear formulario
        e.target.reset();
        
        // Resetear foto
        currentPhoto = null;
        currentPhotoURL = null;
        fotoPreview.style.display = 'none';
        previewImg.src = '';
        camaraInput.value = '';
        fotoInput.value = '';
        
        // Resetear botones a ingreso por defecto
        document.querySelectorAll('.tipo-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tipo-btn[data-tipo="ingreso"]').classList.add('active');
        document.getElementById('caso').value = 'ingreso';
        
        // Recargar según el rol
        if (currentUserData && (currentUserData.rol === 'admin' || currentUserData.rol === 'contador')) {
            loadSaldo();
            loadTransferencias();
        } else {
            loadTransferenciasDelDia();
        }
        
        // Mensaje de éxito
        showMessage('Transferencia guardada exitosamente', 'success');
        
    } catch (error) {
        console.error('Error:', error);
        showMessage('Error al guardar: ' + error.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
});

function showMessage(text, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'alert alert-' + type;
    messageDiv.style.cssText = 
        'position: fixed;' +
        'top: 80px;' +
        'right: 20px;' +
        'padding: 15px 20px;' +
        'background: ' + (type === 'success' ? '#4CAF50' : '#f44336') + ';' +
        'color: white;' +
        'border-radius: 8px;' +
        'box-shadow: 0 4px 12px rgba(0,0,0,0.15);' +
        'z-index: 1000;' +
        'animation: slideIn 0.3s ease-out;';
    messageDiv.textContent = text;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => messageDiv.remove(), 300);
    }, 3000);
}

// Funciones del modal
const modal = document.getElementById('modal-detalle');
const modalClose = document.querySelector('.modal-close');

function mostrarModal(transferencia) {
    const fecha = new Date(transferencia.fechahora);
    const fechaFormato = fecha.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    const tipoHTML = transferencia.caso === 'ingreso' ? 
        '<span class="badge badge-ingreso"><i class="fas fa-arrow-up"></i> Ingreso</span>' :
        '<span class="badge badge-egreso"><i class="fas fa-arrow-down"></i> Egreso</span>';
    
    const signo = transferencia.caso === 'ingreso' ? '+' : '-';
    
    document.getElementById('modal-fecha').textContent = fechaFormato;
    document.getElementById('modal-tipo').innerHTML = tipoHTML;
    document.getElementById('modal-monto').innerHTML = '<strong class="monto-' + transferencia.caso + '">' + signo + '$' + parseFloat(transferencia.monto).toFixed(2) + '</strong>';
    document.getElementById('modal-subido').textContent = transferencia.subido_por_nombre || transferencia.subido_por || 'N/A';
    document.getElementById('modal-motivo').textContent = transferencia.motivo;
    
    if (transferencia.fotografia) {
        document.getElementById('modal-img').src = transferencia.fotografia;
        document.getElementById('modal-img').style.display = 'block';
    } else {
        document.getElementById('modal-img').style.display = 'none';
    }
    
    modal.style.display = 'block';
}

modalClose.onclick = () => {
    modal.style.display = 'none';
};

window.onclick = (event) => {
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
        console.error('Error al cerrar sesión:', error);
    } else {
        // Limpiar caché al cerrar sesión
        localStorage.removeItem('userRole');
        localStorage.removeItem('userNombres');
        localStorage.removeItem('userApellidos');
        window.location.href = 'login.html';
    }
}

// Event listeners para filtros (solo si están disponibles)
if (searchInput) {
    searchInput.addEventListener('input', filterTransferencias);
}
if (filterCaso) {
    filterCaso.addEventListener('change', filterTransferencias);
}

// Inicializar: primero desde caché (instantáneo), luego verificar auth
setupViewFromCache();
checkAuth();

// Estilos para animaciones
const style = document.createElement('style');
style.textContent = 
    '@keyframes slideIn {' +
    '    from {' +
    '        transform: translateX(400px);' +
    '        opacity: 0;' +
    '    }' +
    '    to {' +
    '        transform: translateX(0);' +
    '        opacity: 1;' +
    '    }' +
    '}' +
    '@keyframes slideOut {' +
    '    from {' +
    '        transform: translateX(0);' +
    '        opacity: 1;' +
    '    }' +
    '    to {' +
    '        transform: translateX(400px);' +
    '        opacity: 0;' +
    '    }' +
    '}';
document.head.appendChild(style);
