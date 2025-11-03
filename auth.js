const SUPABASE_URL = 'https://lpsupabase.manasakilla.com';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.ElbNIiT2JsqJkVxUx4bRasL7GpN-Y1A1-5h09fsgpW8';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let isLogin = true;

const authForm = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nombresInput = document.getElementById('nombres');
const apellidosInput = document.getElementById('apellidos');
const nombresGroup = document.getElementById('nombres-group');
const apellidosGroup = document.getElementById('apellidos-group');
const authBtn = document.getElementById('auth-btn');
const toggleLink = document.getElementById('toggle-link');
const toggleText = document.getElementById('toggle-text');
const authSubtitle = document.getElementById('auth-subtitle');
const messageDiv = document.getElementById('message');

authForm.addEventListener('submit', handleAuth);
toggleLink.addEventListener('click', toggleAuthMode);

async function handleAuth(e) {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    authBtn.disabled = true;
    authBtn.textContent = 'Procesando...';

    try {
        if (isLogin) {
            await loginUser(email, password);
        } else {
            await registerUser(email, password);
        }
    } catch (error) {
        showMessage(error.message, 'error');
        authBtn.disabled = false;
        authBtn.textContent = isLogin ? 'Iniciar Sesión' : 'Registrarse';
    }
}

async function loginUser(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
    });

    if (error) throw error;

    // Obtener el rol del usuario inmediatamente después del login
    const { data: userData, error: userError } = await supabase
        .from('usuarios_ferreteria')
        .select('rol, nombres, apellidos')
        .eq('user_id', data.user.id)
        .maybeSingle();

    if (userData) {
        // Guardar rol y datos en localStorage para carga instantánea
        localStorage.setItem('userRole', userData.rol);
        localStorage.setItem('userNombres', userData.nombres);
        localStorage.setItem('userApellidos', userData.apellidos);
    } else {
        // Usuario sin rol definido, por defecto 'usuario'
        localStorage.setItem('userRole', 'usuario');
    }

    showMessage('Inicio de sesión exitoso', 'success');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

async function registerUser(email, password) {
    const nombres = nombresInput.value.trim();
    const apellidos = apellidosInput.value.trim();

    if (!nombres || !apellidos) {
        throw new Error('Por favor completa todos los campos');
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: {
                nombres: nombres,
                apellidos: apellidos,
                rol: 'usuario'
            }
        }
    });

    if (error) throw error;

    showMessage('Registro exitoso. Revisa tu correo para confirmar tu cuenta.', 'success');
    authBtn.disabled = false;
    authBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrarse';
}

function toggleAuthMode(e) {
    e.preventDefault();
    isLogin = !isLogin;

    if (isLogin) {
        authSubtitle.innerHTML = '<i class="fas fa-exchange-alt"></i> Gestión de Transferencias';
        authBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Iniciar Sesión';
        toggleText.textContent = '¿No tienes cuenta? ';
        toggleLink.textContent = 'Regístrate aquí';
        nombresGroup.style.display = 'none';
        apellidosGroup.style.display = 'none';
        nombresInput.required = false;
        apellidosInput.required = false;
    } else {
        authSubtitle.innerHTML = '<i class="fas fa-user-plus"></i> Crea una nueva cuenta';
        authBtn.innerHTML = '<i class="fas fa-user-plus"></i> Registrarse';
        toggleText.textContent = '¿Ya tienes cuenta? ';
        toggleLink.textContent = 'Inicia sesión aquí';
        nombresGroup.style.display = 'block';
        apellidosGroup.style.display = 'block';
        nombresInput.required = true;
        apellidosInput.required = true;
    }

    messageDiv.style.display = 'none';
}

function showMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.style.display = 'block';
}

document.addEventListener('DOMContentLoaded', async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
        window.location.href = 'index.html';
    }
});
