/**
 * Plagueo en Piña - Core Application Logic
 * Basado en la PWA de Plagueo en Arroz, adaptado a cultivo de piña en Costa Rica.
 */

const APP_STATE = {
    currentView: 'dashboard',
    user: JSON.parse(localStorage.getItem('abc_pine_user') || 'null'),
    collections: {
        fincas: JSON.parse(localStorage.getItem('abc_pine_fincas') || '[]'),
        lotes: JSON.parse(localStorage.getItem('abc_pine_lotes') || '[]'),
        ciclos: JSON.parse(localStorage.getItem('abc_pine_ciclos') || '[]'),
        lotesHistoricos: JSON.parse(localStorage.getItem('abc_pine_lotes_historicos') || '[]'),
    },
    monitoring: {
        coords: null,
        header: {
            finca: null,
            lote: null,
            ciclo: null,
            edad: 0,
            variedad: "",
            area: "",
            plaguero: ""
        },
        pests: {},
        diseases: {},
        weeds: {},
        growth: {
            poblacion: 0,
            altura: 0,
            lamina: 0,
            fenologia: 0
        }
    },
    deferredPrompt: null,
    editingRecordIdx: null
};

function saveData() {
    localStorage.setItem('abc_pine_fincas', JSON.stringify(APP_STATE.collections.fincas));
    localStorage.setItem('abc_pine_lotes', JSON.stringify(APP_STATE.collections.lotes));
    localStorage.setItem('abc_pine_ciclos', JSON.stringify(APP_STATE.collections.ciclos));
    localStorage.setItem('abc_pine_lotes_historicos', JSON.stringify(APP_STATE.collections.lotesHistoricos));
}

// Catálogos específicos para piña
const PEST_DB = {
    invertebrates: [
        { id: "cochinilla_harinosa", name: "Cochinilla harinosa (Dysmicoccus brevipes)" },
        { id: "cochinilla_raiz",    name: "Cochinilla de raíz" },
        { id: "acaro_planta",       name: "Ácaro de la planta" },
        { id: "acaro_falso_rojo",   name: "Ácaro falso rojo" },
        { id: "nematodo_raiz",      name: "Nematodos de raíz" },
        { id: "gusano_alambre",     name: "Gusanos de alambre" },
        { id: "larvas_suelo",       name: "Larvas de suelo (coleópteros)" }
    ],
    vertebrates: [
        { id: "roedores",  name: "Roedores" },
        { id: "pajaros",   name: "Aves (daño en frutos)" }
    ],
    beneficials: [
        { id: "crisopas",   name: "Crisopas" },
        { id: "mariquitas", name: "Mariquitas" },
        { id: "aranas",     name: "Arañas depredadoras" },
        { id: "avispas",    name: "Avispas parasitoides" },
        { id: "hongos_bio", name: "Hongos entomopatógenos" }
    ]
};

const DISEASE_DB = [
    { id: "fusariosis",        name: "Fusariosis (Fusarium guttiforme)",      scale: 3 },
    { id: "pudricion_corazon", name: "Pudrición del corazón (Phytophthora)", scale: 3 },
    { id: "pudricion_raiz",    name: "Pudrición de raíz",                    scale: 9 },
    { id: "pudricion_fruto",   name: "Pudriciones de fruto",                 scale: 3 },
    { id: "mancha_folia",      name: "Manchas foliares",                     scale: 3 },
    { id: "amarillamiento",    name: "Síndromes de amarillamiento",         scale: 3 }
];

const WEED_DB = [
    "Cizaña",
    "Caminadora",
    "Coquito (Cyperus spp.)",
    "Pasto Guinea",
    "Pasto Estrella",
    "Pasto Johnson",
    "Rottboellia",
    "Amaranthus",
    "Commelina",
    "Bidens pilosa",
    "Conyza (paja peluda)",
    "Hiedra terrestre",
    "Mata ratón (Crotalaria spp.)"
];

const THRESHOLDS_DATA = {
    // PLAGAS
    cochinilla_harinosa: {
        name: "Cochinilla harinosa",
        rows: [
            { cond: "Plántula – 6 meses", n1: "<= 5% plantas con colonias", n2: "5–15%", n3: "> 15%", obs: "Revisar base de planta y raíz" },
            { cond: "6 meses – prefloración", n1: "<= 10%", n2: "10–20%", n3: "> 20%", obs: "Vigilar parcelas con estrés hídrico" }
        ]
    },
    cochinilla_raiz: {
        name: "Cochinilla de raíz",
        rows: [
            { cond: "Crecimiento vegetativo", n1: "<= 5% plantas afectadas", n2: "5–10%", n3: "> 10%", obs: "" }
        ]
    },
    acaro_planta: {
        name: "Ácaro de la planta",
        rows: [
            { cond: "Síntomas en hojas jóvenes", n1: "<= 5% hojas con daño", n2: "5–15%", n3: "> 15%", obs: "" }
        ]
    },
    acaro_falso_rojo: {
        name: "Ácaro falso rojo",
        rows: [
            { cond: "Hojas con bronceado", n1: "<= 5%", n2: "5–15%", n3: "> 15%", obs: "" }
        ]
    },
    nematodo_raiz: {
        name: "Nematodos de raíz",
        rows: [
            { cond: "Plantas con síntomas de decaimiento", n1: "<= 2%", n2: "2–5%", n3: "> 5%", obs: "Confirmar con análisis de raíz/suelo" }
        ]
    },
    gusano_alambre: {
        name: "Gusanos de alambre",
        rows: [
            { cond: "Daño en raíces/plántulas", n1: "<= 2%", n2: "2–5%", n3: "> 5%", obs: "" }
        ]
    },
    larvas_suelo: {
        name: "Larvas de suelo",
        rows: [
            { cond: "Larvas por m²", n1: "<= 1", n2: "2–3", n3: ">= 4", obs: "" }
        ]
    },

    // VERTEBRADOS
    roedores: {
        name: "Roedores",
        rows: [
            { cond: "Plantas/frutos dañados", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "" }
        ]
    },
    pajaros: {
        name: "Aves (frutos)", 
        rows: [
            { cond: "Frutos dañados", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "" }
        ]
    },

    // BENÉFICOS (invertidos)
    crisopas: {
        name: "Crisopas",
        isInverted: true,
        rows: [{ cond: "Control natural", n1: "<= 1", n2: "2–3", n3: ">= 4", obs: "Adultos/larvas por m²" }]
    },
    mariquitas: {
        name: "Mariquitas",
        isInverted: true,
        rows: [{ cond: "Control natural", n1: "<= 1", n2: "2–3", n3: ">= 4", obs: "Adultos/larvas por m²" }]
    },
    aranas: {
        name: "Arañas depredadoras",
        isInverted: true,
        rows: [{ cond: "Control natural", n1: "<= 1", n2: "2–3", n3: ">= 4", obs: "Arañas por m²" }]
    },
    avispas: {
        name: "Avispas parasitoides",
        isInverted: true,
        rows: [{ cond: "Control natural", n1: "<= 1", n2: "2–3", n3: ">= 4", obs: "Nidos o adultos por planta" }]
    },
    hongos_bio: {
        name: "Hongos entomopatógenos",
        isInverted: true,
        rows: [{ cond: "Presencia en focos", n1: "Escasa", n2: "Media", n3: "Abundante", obs: "" }]
    },

    // ENFERMEDADES
    fusariosis: {
        name: "Fusariosis",
        rows: [
            { cond: "Plantas con síntomas", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "Eliminar focos y plantas enfermas" }
        ]
    },
    pudricion_corazon: {
        name: "Pudrición del corazón",
        rows: [
            { cond: "Plantas afectadas", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "Asociado a drenaje y exceso de humedad" }
        ]
    },
    pudricion_raiz: {
        name: "Pudrición de raíz",
        rows: [
            { cond: "Plantas con síntomas", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "" }
        ]
    },
    pudricion_fruto: {
        name: "Pudriciones de fruto",
        rows: [
            { cond: "Frutos con pudrición", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "" }
        ]
    },
    mancha_folia: {
        name: "Manchas foliares",
        rows: [
            { cond: "Área foliar afectada", n1: "<= 1%", n2: "1–5%", n3: "> 5%", obs: "" }
        ]
    },
    amarillamiento: {
        name: "Síndromes de amarillamiento",
        rows: [
            { cond: "Plantas afectadas", n1: "<= 1%", n2: "1–3%", n3: "> 3%", obs: "" }
        ]
    },

    // MALEZAS
    malezas_grid: {
        name: "Malezas / m²",
        isGrid: true,
        header: ["Tamaño", "<=0.5", ">0.5 y <3", ">=3", "Referencia"],
        rows: [
            ["Grandes", "3", "6", "9", "Altamente competitivas (ej. cizaña, caminadora)"],
            ["Medianas", "2", "5", "8", "Cobertura media del entrecalle"],
            ["Pequeñas", "1", "4", "7", "Plántulas emergiendo"]
        ]
    },
    malezas_grandes:  { alias: "malezas_grid" },
    malezas_medianas: { alias: "malezas_grid" },
    malezas_pequenas: { alias: "malezas_grid" },

    // CRECIMIENTO
    poblacion: {
        name: "Población",
        rows: [
            { cond: "Plántula a cierre de surco", n1: "Medir", n2: "Medir", n3: "Medir", obs: "Plantas/ha o plantas/m de surco" }
        ]
    },
    altura: {
        name: "Altura planta",
        rows: [
            { cond: "Corona a base", n1: "cm", n2: "cm", n3: "cm", obs: "Altura promedio de follaje" }
        ]
    },
    lamina: {
        name: "Humedad del suelo",
        rows: [
            { cond: "Condición general del lote", n1: "Seco", n2: "Óptimo", n3: "Encharcado", obs: "Relacionar con riesgo de pudriciones" }
        ]
    }
};

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    renderView('dashboard');
    startSparkAnimation();
});

/**
 * Animación del destello (spark) perimetral mediante JS para máxima compatibilidad móvil.
 * Reemplaza la API @property de CSS que falla en algunos Android/WebViews.
 */
function startSparkAnimation() {
    let angle = 0;
    const updateAngle = () => {
        angle = (angle + 1.25) % 360; // 1.25deg por frame aprox (~5.5s ciclo)
        document.documentElement.style.setProperty('--spark-angle', `${angle}deg`);
        requestAnimationFrame(updateAngle);
    };
    requestAnimationFrame(updateAngle);
}

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    APP_STATE.deferredPrompt = e;
    renderView(APP_STATE.currentView);
});

window.addEventListener('appinstalled', () => {
    console.log('PWA piña instalado con éxito');
    APP_STATE.deferredPrompt = null;
});

function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const view = item.getAttribute('data-view');
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            APP_STATE.currentView = view;
            renderView(view);
            window.scrollTo(0, 0);
        });
    });
}

function renderView(viewName, preserveScroll) {
    const mainContent = document.getElementById('main-content');
    const bottomNav = document.querySelector('.bottom-nav');
    if (!mainContent) return;
    const savedScroll = preserveScroll ? (document.documentElement.scrollTop || document.body.scrollTop) : 0;

    if (!APP_STATE.user && viewName !== 'registration') {
        APP_STATE.currentView = 'registration';
        mainContent.innerHTML = renderRegistration();
        if (bottomNav) bottomNav.style.display = 'none';
        if (window.lucide) window.lucide.createIcons();
        return;
    }

    if (bottomNav) bottomNav.style.display = 'flex';
    APP_STATE.currentView = viewName;

    switch (viewName) {
        case 'registration':
            mainContent.innerHTML = renderRegistration();
            if (bottomNav) bottomNav.style.display = 'none';
            break;
        case 'dashboard':
            mainContent.innerHTML = renderDashboard();
            break;
        case 'admin':
            mainContent.innerHTML = renderAdmin();
            break;
        case 'admin_ciclos':
            mainContent.innerHTML = renderAdminCiclos();
            break;
        case 'admin_fincas':
            mainContent.innerHTML = renderAdminFincas();
            break;
        case 'admin_lotes':
            mainContent.innerHTML = renderAdminLotes();
            break;
        case 'records':
            mainContent.innerHTML = renderRecords();
            break;
        case 'monitor_header':
            mainContent.innerHTML = renderMonitorHeader();
            break;
        case 'monitor_pests':
            mainContent.innerHTML = renderMonitorPests();
            break;
        case 'monitor_diseases':
            mainContent.innerHTML = renderMonitorDiseases();
            break;
        case 'monitor_weeds':
            mainContent.innerHTML = renderMonitorWeeds();
            break;
        case 'monitor_growth':
            mainContent.innerHTML = renderMonitorGrowth();
            break;
        default:
            mainContent.innerHTML = `<div class="card"><h2>${viewName}</h2><p>En desarrollo...</p></div>`;
    }

    if (preserveScroll) {
        window.scrollTo(0, savedScroll);
    } else {
        window.scrollTo(0, 0);
    }

    if (viewName === 'admin_lotes' && typeof updateLotesSugeridos === 'function') {
        updateLotesSugeridos();
    }

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderDashboard() {
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    const pending = records.filter(r => !r.synced).length;
    const userName = APP_STATE.user?.name?.split(' ')[0] || 'Usuario';

    const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
    const isIOS = /iPad|iPhone|iPod/i.test(ua) && !window.MSStream;
    const isAndroid = /Android/i.test(ua);
    const installInstructions = isIOS
        ? 'En iPhone (Safari): pulsa el botón compartir (cuadrado con flecha) → “Agregar a pantalla de inicio”.'
        : (isAndroid
            ? 'En Android (Chrome): menú ⋮ → “Instalar app”.'
            : 'En tu navegador: busca “Instalar app” o “Agregar a pantalla de inicio”.');

    return `
        <div class="dashboard-hero">
            <div class="card welcome-card">
                <h1 class="hero-title">Sistema de Monitoreo de Plagas en Piña</h1>
                <p class="hero-greeting"><span class="emoji-rice">🍍</span> Hola, ${userName} 👋</p>
            </div>
            
            <div class="card action-container">
                <div class="action-main" onclick="startMonitoring()">
                    <div class="action-icon-rocket">🚀</div>
                    <span class="action-label">INICIAR MONITOREO</span>
                </div>
                
                <div class="status-pill ${pending > 0 ? 'has-pending' : ''}">
                    <div class="status-icon"><i data-lucide="cloud-upload"></i></div>
                    <div class="status-info">
                        <strong>${pending} REGISTROS PENDIENTES</strong>
                        <span>Listos para sincronizar</span>
                    </div>
                </div>
            </div>

            <div class="config-link-row">
                <a href="#" class="config-link" onclick="localStorage.removeItem('abc_pine_sync_url'); alert('URL borrada. Presione Sincronizar para pegar la nueva.'); renderView('dashboard'); return false;">
                    Configurar URL de Script
                </a>
            </div>

            <div class="sync-section">
                <button id="sync-btn" class="btn btn-sync-neon" onclick="syncWithGoogleSheets()">
                    <i data-lucide="cloud-upload"></i> SINCRONIZAR AHORA
                </button>
            </div>

            <div id="pwa-install-container">
                <div class="card install-card">
                    <p class="install-hint">
                        📲 Instale la App para acceso rápido.
                        ${APP_STATE.deferredPrompt
                            ? ' También puede usar el botón para el prompt de instalación.'
                            : ` ${installInstructions}`}
                    </p>
                    <button
                        id="install-btn"
                        class="btn btn-primary btn-small"
                        onclick="installPWA()"
                    >
                        INSTALAR APP
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderAdmin() {
    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="settings"></i></div>
                <h2 class="view-title">Administración</h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('dashboard')" style="max-width: 100px;">
                <i data-lucide="arrow-left"></i> VOLVER
            </button>
        </div>
        
        <div class="card admin-menu-card" role="button" tabindex="0" onclick="renderView('admin_ciclos')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();renderView('admin_ciclos');}">
            <div class="admin-icon-wrap admin-icon--ciclos">
                <i data-lucide="refresh-cw"></i>
            </div>
            <div class="admin-text">
                <h3>Ciclos Agrícolas</h3>
                <p>${APP_STATE.collections.ciclos.length} registrados</p>
            </div>
            <i data-lucide="chevron-right" class="admin-chevron" aria-hidden="true"></i>
        </div>
        
        <div class="card admin-menu-card" role="button" tabindex="0" onclick="renderView('admin_fincas')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();renderView('admin_fincas');}">
            <div class="admin-icon-wrap admin-icon--fincas">
                <i data-lucide="home"></i>
            </div>
            <div class="admin-text">
                <h3>Fincas</h3>
                <p>${APP_STATE.collections.fincas.length} registradas</p>
            </div>
            <i data-lucide="chevron-right" class="admin-chevron" aria-hidden="true"></i>
        </div>
        
        <div class="card admin-menu-card" role="button" tabindex="0" onclick="renderView('admin_lotes')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();renderView('admin_lotes');}">
            <div class="admin-icon-wrap admin-icon--lotes">
                <i data-lucide="layers"></i>
            </div>
            <div class="admin-text">
                <h3>Lotes / Parcelas</h3>
                <p>${APP_STATE.collections.lotes.length} registrados</p>
            </div>
            <i data-lucide="chevron-right" class="admin-chevron" aria-hidden="true"></i>
        </div>

        <div class="card admin-menu-card admin-menu-card--danger" role="button" tabindex="0" onclick="confirmDeleteSynced()" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();confirmDeleteSynced();}">
            <div class="admin-icon-wrap admin-icon--limpieza">
                <i data-lucide="trash-2"></i>
            </div>
            <div class="admin-text">
                <h3>Limpieza de Datos</h3>
                <p>Borrar registros sincronizados</p>
            </div>
            <i data-lucide="chevron-right" class="admin-chevron" aria-hidden="true"></i>
        </div>

        <div class="card user-profile-card">
            <div class="user-info-section">
                <div class="user-avatar">
                    <i data-lucide="user"></i>
                </div>
                <div class="user-details">
                    <h4>${APP_STATE.user?.name || 'Usuario'}</h4>
                    <p>${APP_STATE.user?.email || 'No registrado'}</p>
                </div>
            </div>
            <button class="btn btn-secondary btn-small" style="width: 100%;" onclick="localStorage.removeItem('abc_pine_user'); location.reload();">
                CAMBIAR USUARIO
            </button>
        </div>
    `;
}

function renderAdminCiclos() {
    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="refresh-cw"></i></div>
                <h2 class="view-title">Ciclos</h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('admin')" style="max-width: 100px;">
                <i data-lucide="arrow-left"></i> VOLVER
            </button>
        </div>
        
        <div class="card add-item-card">
            <h3 class="card-subtitle">Agregar Nuevo Ciclo</h3>
            <div class="field-group">
                <input type="text" id="new-ciclo-nombre" class="input-modern" placeholder="Ej: Piña 2026">
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="addItemCiclo()">
                <i data-lucide="plus"></i> AÑADIR CICLO
            </button>
        </div>

        <div class="list-container">
            ${APP_STATE.collections.ciclos.map(c => `
                <div class="card list-item-card">
                    <span class="item-name">${c.nombre}</span>
                    <button class="btn-icon-only delete" onclick="deleteItem('ciclos', '${c.id}', 'admin_ciclos')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `).join('') || '<p class="empty-list-msg">No hay ciclos registrados.</p>'}
        </div>
    `;
}

function renderAdminFincas() {
    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="building-2"></i></div>
                <h2 class="view-title">Fincas</h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('admin')" style="max-width: 100px;">
                <i data-lucide="arrow-left"></i> VOLVER
            </button>
        </div>
        
        <div class="card add-item-card">
            <h3 class="card-subtitle">Agregar Nueva Finca</h3>
            <div class="field-group">
                <input type="text" id="new-finca-nombre" class="input-modern" placeholder="Ej: Finca Piñera Norte">
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="addItemFinca()">
                <i data-lucide="plus"></i> AÑADIR FINCA
            </button>
        </div>

        <div class="list-container">
            ${APP_STATE.collections.fincas.map(f => `
                <div class="card list-item-card">
                    <span class="item-name">${f.nombre}</span>
                    <button class="btn-icon-only delete" onclick="deleteItem('fincas', '${f.id}', 'admin_fincas')">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            `).join('') || '<p class="empty-list-msg">No hay fincas registradas.</p>'}
        </div>
    `;
}

function renderAdminLotes() {
    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="layers"></i></div>
                <h2 class="view-title">Lotes</h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('admin')" style="max-width: 100px;">
                <i data-lucide="arrow-left"></i> VOLVER
            </button>
        </div>
        
        <div class="card add-item-card">
            <h3 class="card-subtitle">Agregar Nuevo Lote</h3>
            <div class="grid-2">
                <div class="field-group">
                    <label>Ciclo</label>
                    <select id="new-lote-ciclo" class="input-modern">
                        ${APP_STATE.collections.ciclos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="field-group">
                    <label>Finca</label>
                    <select id="new-lote-finca" class="input-modern" onchange="updateLotesSugeridos()">
                        ${APP_STATE.collections.fincas.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="field-group">
                <label>Nombre del Lote</label>
                <input type="text" id="new-lote-nombre" class="input-modern" placeholder="Ej: Bloque 3 - Sur" list="lotes-historicos" autocomplete="off">
                <datalist id="lotes-historicos"></datalist>
            </div>
            <div class="grid-2">
                <div class="field-group">
                    <label>Variedad</label>
                    <input type="text" id="new-lote-variedad" class="input-modern" placeholder="Ej: MD-2">
                </div>
                <div class="field-group">
                    <label>Área (Ha)</label>
                    <input type="number" id="new-lote-area" class="input-modern" placeholder="Ej: 8.5">
                </div>
            </div>
            <button class="btn btn-primary" style="width: 100%;" onclick="addItemLote()">
                <i data-lucide="plus"></i> AÑADIR LOTE
            </button>
        </div>

        <div class="list-container">
            ${APP_STATE.collections.lotes.slice().reverse().map(l => {
        const ciclo = APP_STATE.collections.ciclos.find(c => c.id === l.cicloId)?.nombre || '---';
        const finca = APP_STATE.collections.fincas.find(f => f.id === l.fincaId)?.nombre || '---';
        return `
                <div class="card list-item-nested-card">
                    <div class="item-header">
                        <span class="item-name">${l.nombre}</span>
                        <button class="btn-icon-only delete" onclick="deleteItem('lotes', '${l.id}', 'admin_lotes')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    </div>
                    <div class="item-details-grid">
                        <div class="detail-row"><span>Ciclo:</span> <strong>${ciclo}</strong></div>
                        <div class="detail-row"><span>Finca:</span> <strong>${finca}</strong></div>
                        <div class="detail-row"><span>Var:</span> <strong>${l.variedad || '-'}</strong> | <span>Área:</span> <strong>${l.area || '-'} Ha</strong></div>
                    </div>
                </div>
            `;
    }).join('') || '<p class="empty-list-msg">No hay lotes registrados.</p>'}
        </div>
        <script>
            setTimeout(() => { if (typeof updateLotesSugeridos === "function") updateLotesSugeridos(); }, 0);
        </script>
    `;
}

function updateLotesSugeridos() {
    const fincaSelect = document.getElementById('new-lote-finca');
    const datalist = document.getElementById('lotes-historicos');
    if (!fincaSelect || !datalist) return;

    const fincaId = fincaSelect.value;
    if (!fincaId) {
        datalist.innerHTML = '';
        return;
    }

    const lotesHistoricoFinca = APP_STATE.collections.lotesHistoricos.filter(l => l.fincaId === fincaId);
    const nombresUnicos = [...new Set(lotesHistoricoFinca.map(l => l.nombre))].sort();
    datalist.innerHTML = nombresUnicos.map(nombre => `<option value="${nombre}">`).join('');
}

function addItemCiclo() {
    const nombreInput = document.getElementById('new-ciclo-nombre');
    if (!nombreInput || !nombreInput.value.trim()) {
        alert('Por favor ingrese un nombre para el ciclo.');
        return;
    }

    APP_STATE.collections.ciclos.push({
        id: Date.now().toString(),
        nombre: nombreInput.value.trim()
    });
    saveData();
    renderView('admin_ciclos');
}

function addItemFinca() {
    const nombreInput = document.getElementById('new-finca-nombre');
    if (!nombreInput || !nombreInput.value.trim()) {
        alert('Por favor ingrese un nombre para la finca.');
        return;
    }

    APP_STATE.collections.fincas.push({
        id: Date.now().toString(),
        nombre: nombreInput.value.trim()
    });
    saveData();
    renderView('admin_fincas');
}

function addItemLote() {
    const nombreInput = document.getElementById('new-lote-nombre');
    const cicloInput = document.getElementById('new-lote-ciclo');
    const fincaInput = document.getElementById('new-lote-finca');
    const areaInput = document.getElementById('new-lote-area');
    const variedadInput = document.getElementById('new-lote-variedad');

    if (!nombreInput || !nombreInput.value || !cicloInput.value || !fincaInput.value) return;

    const loteNombreTrimmed = nombreInput.value.trim();

    const isDuplicate = APP_STATE.collections.lotes.some(
        l => l.nombre.toLowerCase() === loteNombreTrimmed.toLowerCase() && 
             l.cicloId === cicloInput.value && 
             l.fincaId === fincaInput.value
    );

    if (isDuplicate) {
        alert("ALERTA: Este lote ya se encuentra registrado para esta Finca en este Ciclo. No se puede duplicar.");
        return;
    }

    APP_STATE.collections.lotes.push({
        id: Date.now().toString(),
        nombre: loteNombreTrimmed,
        cicloId: cicloInput.value,
        fincaId: fincaInput.value,
        area: areaInput.value,
        variedad: variedadInput.value
    });

    const isHistoric = APP_STATE.collections.lotesHistoricos.some(
        h => h.nombre.toLowerCase() === loteNombreTrimmed.toLowerCase() && 
             h.fincaId === fincaInput.value
    );

    if (!isHistoric) {
        APP_STATE.collections.lotesHistoricos.push({
            nombre: loteNombreTrimmed,
            fincaId: fincaInput.value
        });
    }

    saveData();
    renderView('admin_lotes');
}

function deleteItem(collection, id, view) {
    APP_STATE.collections[collection] = APP_STATE.collections[collection].filter(i => i.id !== id);
    saveData();
    renderView(view);
}

function confirmDeleteSynced() {
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    const syncedCount = records.filter(r => r.synced).length;
    
    if (syncedCount === 0) {
        alert("No hay registros sincronizados para borrar.");
        return;
    }

    if (confirm(`¿Desea borrar permanentemente los ${syncedCount} registros que ya fueron sincronizados al Excel?`)) {
        const remaining = records.filter(r => !r.synced);
        localStorage.setItem('abc_pine_monitoring_records', JSON.stringify(remaining));
        if (remaining.length === 0) {
            localStorage.setItem('abc_pine_record_counter', '0');
        }
        alert(`✅ Se han borrado ${syncedCount} registros.`);
        renderView('admin');
    }
}

function renderRecords() {
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    const pending = records.filter(r => !r.synced).length;

    const list = records.slice().reverse().map((r, idx) => {
        const date = new Date(r.timestamp);
        const dateStr = date.toLocaleDateString();
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const originalIdx = records.length - 1 - idx;
        const recNum = r.num ? `<span style="font-size:0.6rem;font-weight:900;padding:0.15rem 0.5rem;border-radius:99px;background:rgba(255,255,255,0.07);color:var(--text-secondary);border:1px solid var(--glass-border);margin-right:0.4rem;">#${r.num}</span>` : '';

        const h = r.header || {};
        const coords = r.coords || {};

        const chipStyle = (valStr, maxScale, isInverted) => {
            const val = parseInt(valStr, 10);
            let cat = 'high';
            if (maxScale === 9) {
                if (val <= 3) cat = 'low';
                else if (val <= 6) cat = 'medium';
            } else if (maxScale === 3) {
                if (val === 1) cat = 'low';
                else if (val === 2) cat = 'medium';
            } else {
                const pct = val / maxScale;
                if (pct <= 0.34) cat = 'low';
                else if (pct <= 0.67) cat = 'medium';
            }
            if (isInverted) {
                if (cat === 'low') cat = 'high';
                else if (cat === 'high') cat = 'low';
            }
            if (cat === 'low') return 'background:rgba(16,185,129,0.2);border:1px solid rgba(16,185,129,0.5);color:#10b981;';
            if (cat === 'medium') return 'background:rgba(245,158,11,0.2);border:1px solid rgba(245,158,11,0.5);color:#f59e0b;';
            return 'background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.5);color:#ef4444;';
        };
        const chip = (label, val, maxScale, isInverted) =>
            `<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.18rem 0.5rem;border-radius:99px;${chipStyle(val,maxScale,isInverted)}font-size:0.65rem;font-weight:700;margin:0.15rem;">${label}&nbsp;<strong>${val}</strong></span>`;

        const allPestNames = {};
        const beneficialIds = new Set((PEST_DB.beneficials||[]).map(p => p.id));
        [...(PEST_DB.invertebrates||[]),...(PEST_DB.vertebrates||[]),...(PEST_DB.beneficials||[])].forEach(p=>allPestNames[p.id]=p.name);
        const pestChips = Object.entries(r.pests||{}).filter(([,v])=>v>0)
            .map(([id,val])=>chip(allPestNames[id]||id, val, 3, beneficialIds.has(id))).join('');

        const allDiseaseInfo = {};
        (DISEASE_DB||[]).forEach(d=>allDiseaseInfo[d.id]={name:d.name,scale:d.scale||3});
        const diseaseChips = Object.entries(r.diseases||{}).filter(([,v])=>v>0)
            .map(([id,val])=>{ const i=allDiseaseInfo[id]||{name:id,scale:9}; return chip(i.name, val, i.scale); }).join('');

        const weedChips = Object.entries(r.weeds||{}).filter(([,v])=>v>0)
            .map(([name,val])=>chip(name, val, 9)).join('');

        const g = r.growth || {};
        const blueChip = (label) => `<span style="padding:0.18rem 0.5rem;border-radius:99px;background:rgba(59,130,246,0.18);border:1px solid rgba(59,130,246,0.4);color:#60a5fa;font-size:0.65rem;font-weight:700;margin:0.15rem;">${label}</span>`;
        const purpleChip = (label) => `<span style="padding:0.18rem 0.5rem;border-radius:99px;background:rgba(139,92,246,0.18);border:1px solid rgba(139,92,246,0.4);color:#a78bfa;font-size:0.65rem;font-weight:700;margin:0.15rem;">${label}</span>`;
        const growthChips = [
            g.poblacion ? blueChip(`👥 ${g.poblacion} pl/ha?`) : '',
            g.altura    ? blueChip(`📏 ${g.altura} cm`) : '',
            g.agua      ? blueChip(`💧 ${g.agua}`) : '',
            g.fenologia ? purpleChip(`🍍 ${g.fenologia}`) : ''
        ].filter(Boolean).join('');

        const section = (emoji, label, chips) => chips ? `
            <div class="record-detail-section">
                <div class="record-detail-label">${emoji} ${label}</div>
                <div class="record-detail-chips">${chips}</div>
            </div>` : '';

        const details = [
            section('🐛', 'Plagas', pestChips),
            section('🦠', 'Enfermedades', diseaseChips),
            section('🌿', 'Malezas', weedChips),
            section('📈', 'Crecimiento', growthChips)
        ].filter(Boolean).join('');

        return `
            <div class="card record-card ${r.synced ? 'synced' : 'pending'}">
                <div class="record-header">
                    <div class="record-info">
                        <div class="record-icon-wrap">
                            <i data-lucide="map-pin"></i>
                        </div>
                        <div class="record-text">
                            <div class="record-title">${recNum}${h.lote_name || 'Lote Descon.'}</div>
                            <div class="record-meta">
                                <i data-lucide="calendar"></i>
                                <span>${dateStr} • ${timeStr}</span>
                            </div>
                        </div>
                    </div>
                    <div class="record-status-badge ${r.synced ? 'synced' : 'pending'}">
                        ${r.synced ? 'SINC' : 'PEND'}
                    </div>
                </div>

                <div class="record-grid">
                    <div class="grid-item"><strong>Ciclo:</strong> ${h.ciclo_name || '-'}</div>
                    <div class="grid-item"><strong>Variedad:</strong> ${h.variedad || '-'}</div>
                    <div class="grid-item"><strong>Plaguero:</strong> ${h.plaguero || '-'}</div>
                    <div class="grid-item"><strong>Área:</strong> ${h.area || '-'} Ha</div>
                </div>

                <div class="record-coords">
                    <i data-lucide="navigation"></i>
                    <span>${coords.lat?.toFixed(5) || '?'}, ${coords.lon?.toFixed(5) || '?'}</span>
                </div>

                ${details ? `<div class="record-details">${details}</div>` : ''}

                <div class="record-actions">
                    ${!r.synced ? `<button class="btn btn-secondary btn-small" onclick="editRecord(${originalIdx})"><i data-lucide="edit-3"></i> EDITAR</button>` : ''}
                    <button class="btn btn-secondary btn-small delete-btn" onclick="deleteRecord(${originalIdx})"><i data-lucide="trash-2"></i> ELIMINAR</button>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="history"></i></div>
                <h2 class="view-title">Registros</h2>
            </div>
            <div class="header-count">${records.length} TOTAL</div>
        </div>

        ${pending > 0 ? `
            <div class="card pending-summary-card">
                <p>Tienes <span class="neon-text">${pending}</span> registros pendientes</p>
                <button class="btn btn-primary sync-all-btn" onclick="syncWithGoogleSheets()">
                    <i data-lucide="cloud-upload"></i> SINCRONIZAR TODO
                </button>
            </div>
        ` : ''}

        <div class="monitoring-scroll">
            ${list || `
                <div class="empty-state">
                    <i data-lucide="inbox"></i>
                    <p>No hay registros locales.</p>
                </div>
            `}
        </div>
    `;
}

function deleteRecord(index) {
    if (!confirm('¿Está seguro de eliminar este registro local?')) return;
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    records.splice(index, 1);
    localStorage.setItem('abc_pine_monitoring_records', JSON.stringify(records));
    if (records.length === 0) {
        localStorage.setItem('abc_pine_record_counter', '0');
    }
    renderView('records');
}

function editRecord(index) {
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    const rec = records[index];
    if (!rec) return;

    APP_STATE.editingRecordIdx = index;
    APP_STATE.monitoring.coords  = rec.coords  || null;
    APP_STATE.monitoring.header  = rec.header  || {};
    APP_STATE.monitoring.pests   = rec.pests   || {};
    APP_STATE.monitoring.diseases = rec.diseases || {};
    APP_STATE.monitoring.weeds   = rec.weeds   || {};
    APP_STATE.monitoring.growth  = rec.growth  || { poblacion:0, altura:0, lamina:0, fenologia:0 };

    PEST_DB.invertebrates.forEach(p => { if (!(p.id in APP_STATE.monitoring.pests))   APP_STATE.monitoring.pests[p.id] = 0; });
    PEST_DB.vertebrates.forEach(p   => { if (!(p.id in APP_STATE.monitoring.pests))   APP_STATE.monitoring.pests[p.id] = 0; });
    PEST_DB.beneficials.forEach(p   => { if (!(p.id in APP_STATE.monitoring.pests))   APP_STATE.monitoring.pests[p.id] = 0; });
    DISEASE_DB.forEach(d => { if (!(d.id in APP_STATE.monitoring.diseases)) APP_STATE.monitoring.diseases[d.id] = 0; });
    WEED_DB.forEach(w    => { if (!(w    in APP_STATE.monitoring.weeds))    APP_STATE.monitoring.weeds[w] = 0; });

    renderView('monitor_pests');
}

function startMonitoring() {
    APP_STATE.editingRecordIdx = null;

    APP_STATE.monitoring.pests = {};
    PEST_DB.invertebrates.forEach(p => APP_STATE.monitoring.pests[p.id] = 0);
    PEST_DB.vertebrates.forEach(p => APP_STATE.monitoring.pests[p.id] = 0);
    PEST_DB.beneficials.forEach(p => APP_STATE.monitoring.pests[p.id] = 0);

    APP_STATE.monitoring.diseases = {};
    DISEASE_DB.forEach(d => APP_STATE.monitoring.diseases[d.id] = 0);

    APP_STATE.monitoring.weeds = {};
    WEED_DB.forEach(w => APP_STATE.monitoring.weeds[w] = 0);

    if (!("geolocation" in navigator)) {
        alert("Su dispositivo no soporta geolocalización. Imposible continuar sin coordenadas.");
        return;
    }

    const gpsLabel = document.getElementById('gps-status');
    if (gpsLabel) {
        gpsLabel.innerHTML = "📡 Buscando GPS...";
        gpsLabel.style.color = 'var(--text-secondary)';
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            APP_STATE.monitoring.coords = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                alt: position.coords.altitude,
                acc: position.coords.accuracy
            };
            if (gpsLabel) {
                gpsLabel.innerHTML = `📡 Lat: ${position.coords.latitude.toFixed(5)}, Lon: ${position.coords.longitude.toFixed(5)} `;
                gpsLabel.style.color = 'var(--accent-emerald)';
            }
            renderView('monitor_header');
        },
        (error) => {
            console.error("Error capturing GPS", error);
            if (gpsLabel) {
                gpsLabel.innerHTML = "❌ Error GPS";
                gpsLabel.style.color = 'var(--accent-red)';
            }
            
            let errorMsg = "No se pudo obtener la ubicación. Por favor revise que el GPS esté encendido en su dispositivo y tenga permisos.";
            if (error.code === error.PERMISSION_DENIED) errorMsg = "Permiso de ubicación denegado. Debe autorizar el GPS para esta app.";
            else if (error.code === error.POSITION_UNAVAILABLE) errorMsg = "Información de ubicación no disponible. Encienda o acerque el dispositivo al aire libre.";
            else if (error.code === error.TIMEOUT) errorMsg = "Tiempo de espera agotado buscando señal GPS. Asegúrese de tener el GPS encendido.";
            
            alert(`⚠️ ALERTA GPS: ${errorMsg}`);
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

function renderMonitorHeader() {
    const fincasOptions = APP_STATE.collections.fincas.map(f => `<option value="${f.id}">${f.nombre}</option>`).join('');
    const ciclosOptions = `<option value="">Seleccione Ciclo...</option>` + APP_STATE.collections.ciclos.map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="file-text"></i></div>
                <h2 class="view-title">Encabezado</h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('dashboard')">
                <i data-lucide="x"></i> CANCELAR
            </button>
        </div>
        
        <div class="card">
            <div class="field-group">
                <label>Ciclo Agrícola</label>
                <div style="position: relative;">
                    <i data-lucide="refresh-cw" style="position: absolute; left: 1rem; top: 1.1rem; width: 18px; color: var(--text-secondary);"></i>
                    <select id="mon-ciclo" class="input-modern" style="padding-left: 3rem;" onchange="updateLotesDropdown()">${ciclosOptions}</select>
                </div>
            </div>
            <div class="field-group">
                <label>Finca</label>
                <div style="position: relative;">
                    <i data-lucide="building-2" style="position: absolute; left: 1rem; top: 1.1rem; width: 18px; color: var(--text-secondary);"></i>
                    <select id="mon-finca" class="input-modern" style="padding-left: 3rem;" onchange="updateLotesDropdown()">${fincasOptions}</select>
                </div>
            </div>
            <div class="field-group">
                <label>Lote (Parcela)</label>
                <div style="position: relative;">
                    <i data-lucide="grid-3x3" style="position: absolute; left: 1rem; top: 1.1rem; width: 18px; color: var(--text-secondary);"></i>
                    <select id="mon-lote" class="input-modern" style="padding-left: 3rem;" onchange="autofillLoteData(this.value)">
                        <option value="">Seleccione Ciclo y Finca primero...</option>
                    </select>
                </div>
            </div>
        </div>

        <div class="card">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="field-group">
                    <label>Edad (meses)</label>
                    <input type="number" id="mon-edad" class="input-modern" placeholder="Meses">
                </div>
                <div class="field-group">
                    <label>Plaguero</label>
                    <input type="text" id="mon-plaguero" class="input-modern" placeholder="Nombre" value="${APP_STATE.user?.name || ''}">
                </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="field-group">
                    <label>Variedad</label>
                    <input type="text" id="mon-variedad" class="input-modern" readonly style="opacity: 0.7;">
                </div>
                <div class="field-group">
                    <label>Área (Ha)</label>
                    <input type="text" id="mon-area" class="input-modern" readonly style="opacity: 0.7;">
                </div>
            </div>
        </div>
        
        <div class="sticky-footer">
            <button class="btn btn-primary" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="saveHeaderAndNext()">
                EMPEZAR MONITOREO <i data-lucide="chevron-right" style="width: 18px; height: 18px;"></i>
            </button>
        </div>
`;
}

function updateLotesDropdown() {
    const cicloId = document.getElementById('mon-ciclo').value;
    const fincaId = document.getElementById('mon-finca').value;
    const selector = document.getElementById('mon-lote');

    if (!selector) return;

    if (!cicloId || !fincaId) {
        selector.innerHTML = '<option value="">Seleccione Ciclo y Finca...</option>';
        return;
    }

    const lotes = APP_STATE.collections.lotes.filter(l => l.cicloId === cicloId && l.fincaId === fincaId);
    if (lotes.length === 0) {
        selector.innerHTML = '<option value="">No hay lotes coincidentes</option>';
    } else {
        selector.innerHTML = '<option value="">Seleccione Lote...</option>' + lotes.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('');
    }
}

function autofillLoteData(loteId) {
    const lote = APP_STATE.collections.lotes.find(l => l.id === loteId);
    if (lote) {
        document.getElementById('mon-variedad').value = lote.variedad || '';
        document.getElementById('mon-area').value = lote.area || '';
    }
}

function saveHeaderAndNext() {
    const cicloId = document.getElementById('mon-ciclo').value;
    const fincaId = document.getElementById('mon-finca').value;
    const loteId = document.getElementById('mon-lote').value;
    const edad = document.getElementById('mon-edad').value;
    const plaguero = document.getElementById('mon-plaguero').value;

    if (!cicloId || !fincaId || !loteId || !edad || !plaguero) {
        alert('⚠️ Por favor complete todos los datos del encabezado (Ciclo, Finca, Lote, Edad y Plaguero) para continuar.');
        return;
    }

    const cicloName = APP_STATE.collections.ciclos.find(c => c.id === cicloId)?.nombre || '';
    const fincaName = APP_STATE.collections.fincas.find(f => f.id === fincaId)?.nombre || '';
    const loteName = APP_STATE.collections.lotes.find(l => l.id === loteId)?.nombre || '';

    APP_STATE.monitoring.header = {
        ciclo: cicloId,
        ciclo_name: cicloName,
        finca: fincaId,
        finca_name: fincaName,
        lote: loteId,
        lote_name: loteName,
        edad: edad,
        variedad: document.getElementById('mon-variedad').value,
        area: document.getElementById('mon-area').value,
        plaguero: plaguero
    };
    renderView('monitor_pests');
}

function renderMonitorNav(activeView) {
    const steps = [
        { id: 'monitor_pests',    emoji: '🐛', label: 'Plagas' },
        { id: 'monitor_diseases', emoji: '🦠', label: 'Enfer.' },
        { id: 'monitor_weeds',    emoji: '🌿', label: 'Malezas' },
        { id: 'monitor_growth',   emoji: '📈', label: 'Crecim.' }
    ];

    return `
        <div class="monitor-steps">
            ${steps.map(step => `
                <div class="step-item ${activeView === step.id ? 'active' : ''}" onclick="window.scrollTo(0,0); renderView('${step.id}')">
                    <span class="step-emoji">${step.emoji}</span>
                    <span class="step-label">${step.label}</span>
                </div>
            `).join('')}
        </div>
    `;
}

function renderMonitorPests() {
    let pestsHtml = '';

    const navHtml = renderMonitorNav('monitor_pests');

    const pestIconMap = {
        cochinilla_harinosa: { emoji: '🪳', bg: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'rgba(124,58,237,0.3)' },
        cochinilla_raiz:     { emoji: '🪳', bg: 'linear-gradient(135deg,#7c3aed,#6d28d9)', border: 'rgba(124,58,237,0.3)' },
        acaro_planta:        { emoji: '🕷️', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'rgba(220,38,38,0.3)' },
        acaro_falso_rojo:    { emoji: '🕸️', bg: 'linear-gradient(135deg,#ef4444,#b91c1c)', border: 'rgba(239,68,68,0.3)' },
        nematodo_raiz:       { emoji: '🪱', bg: 'linear-gradient(135deg,#854d0e,#713f12)', border: 'rgba(133,77,14,0.3)' },
        gusano_alambre:      { emoji: '🪱', bg: 'linear-gradient(135deg,#c2410c,#9a3412)', border: 'rgba(194,65,12,0.3)' },
        larvas_suelo:        { emoji: '🦗', bg: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'rgba(22,163,74,0.3)' },
        roedores:            { emoji: '🐀', bg: 'linear-gradient(135deg,#475569,#334155)', border: 'rgba(71,85,105,0.4)' },
        pajaros:             { emoji: '🐦', bg: 'linear-gradient(135deg,#0ea5e9,#0284c7)', border: 'rgba(14,165,233,0.3)' },
        crisopas:            { emoji: '🦗', bg: 'linear-gradient(135deg,#16a34a,#15803d)', border: 'rgba(22,163,74,0.3)' },
        mariquitas:          { emoji: '🐞', bg: 'linear-gradient(135deg,#dc2626,#b91c1c)', border: 'rgba(220,38,38,0.3)' },
        aranas:              { emoji: '🕷️', bg: 'linear-gradient(135deg,#9f1239,#881337)', border: 'rgba(159,18,57,0.3)' },
        avispas:             { emoji: '🐝', bg: 'linear-gradient(135deg,#d97706,#b45309)', border: 'rgba(217,119,6,0.3)' },
        hongos_bio:          { emoji: '🍄', bg: 'linear-gradient(135deg,#22c55e,#16a34a)', border: 'rgba(34,197,94,0.3)' }
    };

    ['invertebrates', 'vertebrates', 'beneficials'].forEach(type => {
        const sectionColors = {
            invertebrates: { label: 'PLAGAS INVERTEBRADAS', accent: '#ef4444' },
            vertebrates:   { label: 'PLAGAS VERTEBRADAS',   accent: '#3b82f6' },
            beneficials:   { label: 'BENÉFICOS',            accent: '#10b981' }
        }[type];
        pestsHtml += `<div style="display:flex;align-items:center;gap:0.5rem;margin:1.5rem 0 0.75rem;">
            <div style="width:3px;height:14px;border-radius:2px;background:${sectionColors.accent};"></div>
            <h3 style="color:${sectionColors.accent};font-size:0.72rem;letter-spacing:1.5px;font-weight:800;">${sectionColors.label}</h3>
        </div>`;

        PEST_DB[type].forEach(pest => {
            const currentLevel = APP_STATE.monitoring.pests[pest.id] || 0;
            const isLow = currentLevel > 0;
            const isMed = currentLevel > 1;
            const isHigh = currentLevel > 2;
            const iconInfo = pestIconMap[pest.id] || {
                emoji: type === 'beneficials' ? '🌿' : '🐛',
                bg: type === 'beneficials' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#dc2626,#b91c1c)',
                border: type === 'beneficials' ? 'rgba(5,150,105,0.3)' : 'rgba(220,38,38,0.3)'
            };

            pestsHtml += `
                <div id="pest-${pest.id}" class="card">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div class="pest-icon-badge" style="background:${iconInfo.bg}; border:1px solid ${iconInfo.border};" onclick="showThreshold('${pest.id}')">
                                ${iconInfo.emoji}
                            </div>
                            <div>
                                <span style="font-weight: 700; font-size: 1rem; letter-spacing: -0.5px; display:block;">${pest.name}</span>
                                <span style="font-size:0.65rem; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.5px;">Nivel de Población</span>
                            </div>
                        </div>
                        <div class="threshold-indicator" style="margin-bottom: 0;">
                            <div class="threshold-dot ${type === 'beneficials' ? 'red' : 'green'} ${isLow ? 'active' : ''}"></div>
                            <div class="threshold-dot yellow ${isMed ? 'active' : ''}"></div>
                            <div class="threshold-dot ${type === 'beneficials' ? 'green' : 'red'} ${isHigh ? 'active' : ''}"></div>
                        </div>
                    </div>

                    <div class="level-selector-premium ${type === 'beneficials' ? 'inverted-levels' : ''}">
                        <div class="level-card nulo ${currentLevel == 0 ? 'active' : ''}" onclick="setPestLevel('${pest.id}', 0)">
                            <div class="level-icon-wrap">🚫</div>
                            <span>NULO</span>
                            <small>0%</small>
                        </div>
                        <div class="level-card bajo ${currentLevel == 1 ? 'active' : ''}" onclick="setPestLevel('${pest.id}', 1)">
                            <div class="level-icon-wrap">🌿</div>
                            <span>BAJO</span>
                            <small>25%</small>
                        </div>
                        <div class="level-card medio ${currentLevel == 2 ? 'active' : ''}" onclick="setPestLevel('${pest.id}', 2)">
                            <div class="level-icon-wrap">✋</div>
                            <span>MEDIO</span>
                            <small>50%</small>
                        </div>
                        <div class="level-card alto ${currentLevel == 3 ? 'active' : ''}" onclick="setPestLevel('${pest.id}', 3)">
                            <div class="level-icon-wrap">🔥</div>
                            <span>ALTO</span>
                            <small>75%+</small>
                        </div>
                    </div>
                </div>
            `;
        });
    });

    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="bug"></i></div>
                <h2 class="view-title">Plagas <span class="step-indicator">1/5</span></h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('monitor_header')">
                <i data-lucide="chevron-left"></i> ATRÁS
            </button>
        </div>
        
        ${navHtml}
        
        <div class="monitoring-scroll">
            ${pestsHtml}
        </div>
        
        <div class="sticky-footer">
            <button class="btn btn-primary" style="width: 100%;" onclick="renderView('monitor_diseases')">
                CONTINUAR <i data-lucide="arrow-right"></i>
            </button>
        </div>
`;
}

function setPestLevel(id, level) {
    APP_STATE.monitoring.pests[id] = level;
    renderView('monitor_pests', true);
}

function renderMonitorDiseases() {
    let diseaseHtml = '';
    DISEASE_DB.forEach(d => {
        const currentLevel = APP_STATE.monitoring.diseases[d.id] || 0;
        const scale = d.scale || 3;
        const isAdvancedScale = scale === 9;

        let buttons = '';
        if (isAdvancedScale) {
            buttons += `<button class="level-btn level-btn-zero ${currentLevel == 0 ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', 0)">0</button>`;
            [1, 4, 7].forEach(i => {
                buttons += `<button class="level-btn btn-green ${currentLevel == i ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', ${i})">${i}</button>`;
            });
            [2, 5, 8].forEach(i => {
                buttons += `<button class="level-btn btn-yellow ${currentLevel == i ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', ${i})">${i}</button>`;
            });
            [3, 6, 9].forEach(i => {
                buttons += `<button class="level-btn btn-red ${currentLevel == i ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', ${i})">${i}</button>`;
            });
        } else {
            for (let i = 0; i <= scale; i++) {
                buttons += `<button class="level-btn ${currentLevel == i ? 'active' : ''}" data-level="${i}" onclick="setDiseaseLevel('${d.id}', ${i})">${i}</button>`;
            }
        }
        const isLow = currentLevel > 0;
        const isMed = isAdvancedScale ? currentLevel > 3 : currentLevel > 1;
        const isHigh = isAdvancedScale ? currentLevel > 6 : currentLevel > 2;

        const diseaseIconMap_local = {
            fusariosis: '🍄',
            pudricion_corazon: '💧',
            pudricion_raiz: '🌱',
            pudricion_fruto: '🍍',
            mancha_folia: '🌿',
            amarillamiento: '🟡'
        };
        const dEmoji = diseaseIconMap_local[d.id] || '🦠';

        diseaseHtml += `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <div class="disease-icon-badge" onclick="showThreshold('${d.id}')">${dEmoji}</div>
                        <div>
                            <span style="font-weight: 700; font-size: 1rem; letter-spacing: -0.5px; display:block;">${d.name}</span>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">
                                ${isAdvancedScale ? 'Escala 0-9' : 'Escala 0-3'}
                            </div>
                        </div>
                    </div>
                    <div class="threshold-indicator" style="margin-bottom: 0;">
                        <div class="threshold-dot green ${isLow ? 'active' : ''}"></div>
                        <div class="threshold-dot yellow ${isMed ? 'active' : ''}"></div>
                        <div class="threshold-dot red ${isHigh ? 'active' : ''}"></div>
                    </div>
                </div>
                
                ${isAdvancedScale ? `
                    <div class="grid-0-9">
                        ${buttons}
                    </div>
                ` : `
                    <div class="level-selector-premium">
                        <div class="level-card nulo ${currentLevel == 0 ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', 0)">
                            <div class="level-icon-wrap">🚫</div>
                            <span>NULO</span>
                            <small>0%</small>
                        </div>
                        <div class="level-card bajo ${currentLevel == 1 ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', 1)">
                            <div class="level-icon-wrap">🌿</div>
                            <span>BAJO</span>
                            <small>25%</small>
                        </div>
                        <div class="level-card medio ${currentLevel == 2 ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', 2)">
                            <div class="level-icon-wrap">✋</div>
                            <span>MEDIO</span>
                            <small>50%</small>
                        </div>
                        <div class="level-card alto ${currentLevel == 3 ? 'active' : ''}" onclick="setDiseaseLevel('${d.id}', 3)">
                            <div class="level-icon-wrap">🔥</div>
                            <span>ALTO</span>
                            <small>75%+</small>
                        </div>
                    </div>
                `}
            </div>
        `;
    });

    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="microscope"></i></div>
                <h2 class="view-title">Enfermedades <span class="step-indicator">2/5</span></h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('monitor_pests')">
                <i data-lucide="chevron-left"></i> ATRÁS
            </button>
        </div>
        
        ${renderMonitorNav('monitor_diseases')}
        
        <div class="monitoring-scroll">
            ${diseaseHtml}
        </div>
        
        <div class="sticky-footer">
            <button class="btn btn-primary" style="width: 100%;" onclick="renderView('monitor_weeds')">
                CONTINUAR <i data-lucide="arrow-right"></i>
            </button>
        </div>
    `;
}

function setDiseaseLevel(id, level) {
    APP_STATE.monitoring.diseases[id] = level;
    renderView('monitor_diseases', true);
}

function renderMonitorWeeds() {
    let selectedHtml = '';
    WEED_DB.forEach(wName => {
        const currentLevel = APP_STATE.monitoring.weeds[wName] || 0;

        const isLow = currentLevel > 0;
        const isMed = currentLevel > 3;
        const isHigh = currentLevel > 6;

        let buttons = '';
        buttons += `<button class="level-btn level-btn-zero ${currentLevel == 0 ? 'active' : ''}" onclick="setWeedLevel('${wName}', 0)">0</button>`;
        for (let i = 1; i <= 3; i++) buttons += `<button class="level-btn btn-green ${currentLevel == i ? 'active' : ''}" onclick="setWeedLevel('${wName}', ${i})">${i}</button>`;
        for (let i = 4; i <= 6; i++) buttons += `<button class="level-btn btn-yellow ${currentLevel == i ? 'active' : ''}" onclick="setWeedLevel('${wName}', ${i})">${i}</button>`;
        for (let i = 7; i <= 9; i++) buttons += `<button class="level-btn btn-red ${currentLevel == i ? 'active' : ''}" onclick="setWeedLevel('${wName}', ${i})">${i}</button>`;

        const weedEmojiMap = {
            'Cizaña':'🌾','Caminadora':'🌱','Coquito (Cyperus spp.)':'🌿',
            'Pasto Guinea':'🌾','Pasto Estrella':'🌾','Pasto Johnson':'🌾',
            'Rottboellia':'🌱','Amaranthus':'🌱','Commelina':'🍃','Bidens pilosa':'🌼',
            'Conyza (paja peluda)':'🌾','Hiedra terrestre':'🌿','Mata ratón (Crotalaria spp.)':'🌸'
        };
        const wEmoji = weedEmojiMap[wName] || '🌿';

        selectedHtml += `
            <div class="card">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                    <div style="display: flex; gap: 0.75rem; align-items: center;">
                        <div class="weed-icon-badge" onclick="showThreshold('malezas_${currentLevel >= 7 ? 'grandes' : (currentLevel >= 4 ? 'medianas' : 'pequenas')}')">${wEmoji}</div>
                        <div>
                            <span style="font-weight: 700; font-size: 1rem; letter-spacing: -0.5px; display:block;">${wName}</span>
                            <div style="font-size: 0.65rem; color: var(--text-secondary); text-transform: uppercase; letter-spacing: 0.5px;">Densidad (0-9)</div>
                        </div>
                    </div>
                    <div class="threshold-indicator" style="margin-bottom: 0;">
                        <div class="threshold-dot green ${isLow ? 'active' : ''}"></div>
                        <div class="threshold-dot yellow ${isMed ? 'active' : ''}"></div>
                        <div class="threshold-dot red ${isHigh ? 'active' : ''}"></div>
                    </div>
                </div>

                <div class="grid-0-9">
                    ${buttons}
                </div>
            </div>
        `;
    });

    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="sprout"></i></div>
                <h2 class="view-title">Malezas <span class="step-indicator">3/5</span></h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('monitor_diseases')">
                <i data-lucide="chevron-left"></i> ATRÁS
            </button>
        </div>
        
        ${renderMonitorNav('monitor_weeds')}
        
        <div class="monitoring-scroll">
            ${selectedHtml}
        </div>
        
        <div class="sticky-footer">
            <button class="btn btn-primary" style="width: 100%;" onclick="renderView('monitor_growth')">
                CONTINUAR <i data-lucide="arrow-right"></i>
            </button>
        </div>
    `;
}

function setWeedLevel(wName, level) {
    APP_STATE.monitoring.weeds[wName] = parseInt(level);
    renderView('monitor_weeds', true);
}

function renderMonitorGrowth() {
    return `
        <div class="view-header">
            <div class="header-main">
                <div class="card-icon"><i data-lucide="line-chart"></i></div>
                <h2 class="view-title">Crecimiento <span class="step-indicator">4/5</span></h2>
            </div>
            <button class="btn btn-secondary btn-small" onclick="renderView('monitor_weeds')">
                <i data-lucide="chevron-left"></i> ATRÁS
            </button>
        </div>

        ${renderMonitorNav('monitor_growth')}
        
        <div class="monitoring-scroll">
            <div class="card">
                <div class="field-group">
                    <label onclick="showThreshold('poblacion')" style="cursor:pointer; text-decoration:underline;">Población (plantas/ha o por surco) ℹ️</label>
                    <input type="number" id="mon-poblacion" class="input-modern" value="${APP_STATE.monitoring.growth.poblacion || ''}" placeholder="Ej: 60000">
                </div>
                <div class="field-group">
                    <label onclick="showThreshold('altura')" style="cursor:pointer; text-decoration:underline;">Altura Planta (cm) ℹ️</label>
                    <input type="number" id="mon-altura" class="input-modern" value="${APP_STATE.monitoring.growth.altura || ''}" placeholder="Ej: 80">
                </div>
                <div class="field-group">
                    <label onclick="showThreshold('lamina')" style="cursor:pointer; text-decoration:underline;">Humedad del suelo ℹ️</label>
                    <select id="mon-lamina" class="input-modern">
                        <option value="Seco" ${APP_STATE.monitoring.growth.lamina === 'Seco' ? 'selected' : ''}>Seco</option>
                        <option value="Óptimo" ${APP_STATE.monitoring.growth.lamina === 'Óptimo' ? 'selected' : ''}>Óptimo</option>
                        <option value="Encharcado" ${APP_STATE.monitoring.growth.lamina === 'Encharcado' ? 'selected' : ''}>Encharcado</option>
                    </select>
                </div>
                <div class="field-group">
                    <label>Estado Fenológico</label>
                    <select id="mon-fenologia" class="input-modern">
                        <option value="Establecimiento" ${APP_STATE.monitoring.growth.fenologia === 'Establecimiento' ? 'selected' : ''}>Establecimiento / plántula</option>
                        <option value="Desarrollo vegetativo" ${APP_STATE.monitoring.growth.fenologia === 'Desarrollo vegetativo' ? 'selected' : ''}>Desarrollo vegetativo</option>
                        <option value="Induccion-floracion" ${APP_STATE.monitoring.growth.fenologia === 'Induccion-floracion' ? 'selected' : ''}>Inducción y floración</option>
                        <option value="Llenado-fruto" ${APP_STATE.monitoring.growth.fenologia === 'Llenado-fruto' ? 'selected' : ''}>Llenado de fruto</option>
                        <option value="Pre-cosecha" ${APP_STATE.monitoring.growth.fenologia === 'Pre-cosecha' ? 'selected' : ''}>Pre-cosecha / cosecha</option>
                    </select>
                </div>
            </div>
        </div>
        
        <div class="sticky-footer">
            <button class="btn btn-primary" style="width: 100%;" onclick="saveAndFinish()">
                <i data-lucide="check-circle"></i>
                FINALIZAR MONITOREO
            </button>
        </div>
`;
}

function saveAndFinish() {
    const poblacion = document.getElementById('mon-poblacion')?.value;
    const altura = document.getElementById('mon-altura')?.value;
    const agua = document.getElementById('mon-lamina')?.value;
    const fenologia = document.getElementById('mon-fenologia')?.value;

    if (!poblacion || !altura || !agua || !fenologia) {
        alert('⚠️ Por favor complete todos los parámetros de crecimiento (Población, Altura, Humedad y Fenología) antes de finalizar.');
        return;
    }

    APP_STATE.monitoring.growth = { poblacion, altura, lamina: agua, fenologia };

    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');

    if (APP_STATE.editingRecordIdx !== null) {
        const existing = records[APP_STATE.editingRecordIdx] || {};
        records[APP_STATE.editingRecordIdx] = {
            id:        existing.id,
            num:       existing.num,
            timestamp: existing.timestamp,
            editedAt:  new Date().toISOString(),
            synced:    false,
            coords:    APP_STATE.monitoring.coords || existing.coords,
            user:      APP_STATE.user,
            header:    APP_STATE.monitoring.header,
            pests:     APP_STATE.monitoring.pests,
            diseases:  APP_STATE.monitoring.diseases,
            weeds:     APP_STATE.monitoring.weeds,
            growth:    APP_STATE.monitoring.growth
        };
        localStorage.setItem('abc_pine_monitoring_records', JSON.stringify(records));
        alert(`✅ Registro #${existing.num || ''} actualizado correctamente.`);
    } else {
        if (records.length === 0) {
            localStorage.setItem('abc_pine_record_counter', '0');
        }
        let counter = parseInt(localStorage.getItem('abc_pine_record_counter') || '0') + 1;
        localStorage.setItem('abc_pine_record_counter', counter.toString());

        records.push({
            id: Date.now().toString(),
            num: counter,
            timestamp: new Date().toISOString(),
            coords: APP_STATE.monitoring.coords,
            user: APP_STATE.user,
            ...APP_STATE.monitoring
        });
        localStorage.setItem('abc_pine_monitoring_records', JSON.stringify(records));
        alert(`✅ Registro #${counter} guardado exitosamente.`);
    }

    APP_STATE.editingRecordIdx = null;
    APP_STATE.monitoring = {
        coords: null,
        header: null,
        pests: {},
        diseases: {},
        weeds: {},
        growth: { poblacion: 0, altura: 0, lamina: 0, fenologia: 0 }
    };

    window.scrollTo(0, 0);
    renderView('records');
}

async function syncWithGoogleSheets() {
    const records = JSON.parse(localStorage.getItem('abc_pine_monitoring_records') || '[]');
    const toSync = records.filter(r => !r.synced);

    if (toSync.length === 0) {
        alert('No hay registros nuevos para sincronizar.');
        return;
    }

    const btn = document.getElementById('sync-btn') || document.getElementById('sync-btn-all');
    const originalText = btn ? btn.innerHTML : 'Sincronizar';
    if (btn) {
        btn.innerHTML = '⏳ Transfiriendo...';
        btn.disabled = true;
    }

    let scriptURL = localStorage.getItem('abc_pine_sync_url');
    if (!scriptURL || scriptURL === 'null') {
        scriptURL = prompt('Por favor, ingrese la URL de su Google Apps Script (Aplicación Web) para piña:');
        if (scriptURL && scriptURL.trim() !== '') {
            localStorage.setItem('abc_pine_sync_url', scriptURL.trim());
        } else {
            if (btn) {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
            return;
        }
    }

    try {
        console.log('Iniciando sincronización piña...', toSync.length, 'registros');
        if (!scriptURL.includes('/exec')) {
            alert('⚠️ ADVERTENCIA: La URL no parece ser de una "Aplicación Web" (debe terminar en /exec). Por favor, use el enlace "Cambiar URL" para corregirla.');
        }

        await fetch(scriptURL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify(toSync.map(r => ({
                ...r,
                user: r.user || APP_STATE.user
            })))
        });

        toSync.forEach(ts => {
            const index = records.findIndex(r => r.id === ts.id);
            if (index !== -1) {
                records[index].synced = true;
                records[index].syncedAt = new Date().toISOString();
            }
        });
        localStorage.setItem('abc_pine_monitoring_records', JSON.stringify(records));

        alert(`✅ Sincronización enviada: ${toSync.length} registros procesados.`);
        renderView('records');
    } catch (error) {
        console.error('Error en sincronización (piña):', error);
        alert('No se pudo conectar con el servidor. Verifique que el script esté publicado correctamente como "Cualquier persona".');
    } finally {
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
        renderView(APP_STATE.currentView);
    }
}

async function installPWA() {
    if (!APP_STATE.deferredPrompt) {
        const ua = (navigator && navigator.userAgent) ? navigator.userAgent : '';
        const isIOS = /iPad|iPhone|iPod/i.test(ua) && !window.MSStream;
        const isAndroid = /Android/i.test(ua);
        const msg = isIOS
            ? 'En iPhone (Safari): pulsa el botón compartir (cuadrado con flecha) → “Agregar a pantalla de inicio”.'
            : (isAndroid
                ? 'En Android (Chrome): menú ⋮ → “Instalar app”.'
                : 'En tu navegador: busca “Instalar app” o “Agregar a pantalla de inicio”.');
        alert(msg);
        return;
    }
    APP_STATE.deferredPrompt.prompt();
    const { outcome } = await APP_STATE.deferredPrompt.userChoice;
    console.log(`User response to the install prompt (piña): ${outcome} `);
    APP_STATE.deferredPrompt = null;
    renderView(APP_STATE.currentView);
}

function renderRegistration() {
    return `
        <div class="card registration-card">
            <div class="registration-header">
                <div class="registration-icon-wrap">
                    <i data-lucide="user-plus"></i>
                </div>
                <h2 class="view-title">Registro de Dispositivo</h2>
                <p class="view-subtitle">Complete sus datos para habilitar el uso de la aplicación de piña.</p>
            </div>

            <div class="field-group">
                <label>Nombre Completo</label>
                <div class="input-with-icon">
                    <i data-lucide="user"></i>
                    <input type="text" id="reg-name" class="input-modern" placeholder="Ej: Técnico Piñero">
                </div>
            </div>

            <div class="field-group">
                <label>Correo Electrónico</label>
                <div class="input-with-icon">
                    <i data-lucide="mail"></i>
                    <input type="email" id="reg-email" class="input-modern" placeholder="Ej: tecnico@empresa.com">
                </div>
            </div>

            <button class="btn btn-primary registration-btn" onclick="saveRegistration()">
                REGISTRAR DISPOSITIVO
            </button>
            <p style="font-size: 0.75rem; color: var(--text-secondary); text-align: center; margin-top: 1.5rem; line-height: 1.4;">
                La contraseña y validación de seguridad se habilitarán en una fase posterior.
            </p>
        </div>
    `;
}

function saveRegistration() {
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;

    if (!name || !email || !email.includes('@')) {
        alert('Por favor, ingrese un nombre y correo electrónico válido.');
        return;
    }

    const userData = { name, email, registeredAt: new Date().toISOString() };
    APP_STATE.user = userData;
    localStorage.setItem('abc_pine_user', JSON.stringify(userData));

    alert('¡Dispositivo registrado con éxito!');
    renderView('dashboard');
}

function showThreshold(id) {
    let data = THRESHOLDS_DATA[id];
    if (data && data.alias) data = THRESHOLDS_DATA[data.alias];
    if (!data) return;

    const existing = document.getElementById('threshold-modal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'threshold-modal';
    modal.className = 'threshold-modal-overlay';
    
    let bodyHtml = '';
    
    if (data.isGrid) {
        let tableRows = data.rows.map(row => `
            <tr>
                <td style="font-weight:700; color:#fff; background: rgba(255,255,255,0.05);">${row[0]}</td>
                <td style="background: rgba(16, 185, 129, 0.4); color: #fff; font-weight: 800; text-align:center;">${row[1]}</td>
                <td style="background: rgba(245, 158, 11, 0.4); color: #fff; font-weight: 800; text-align:center;">${row[2]}</td>
                <td style="background: rgba(239, 68, 68, 0.4); color: #fff; font-weight: 800; text-align:center;">${row[3]}</td>
                <td style="font-size: 0.7rem; opacity: 0.8; line-height: 1.1; vertical-align: middle;">${row[4]}</td>
            </tr>
        `).join('');

        bodyHtml = `
            <table class="threshold-table weed-grid">
                <thead>
                    <tr>
                        <th style="background:#1e293b;">${data.header[0]}</th>
                        <th style="background:#10b981; color:#fff; text-align:center;">${data.header[1]}</th>
                        <th style="background:#f59e0b; color:#fff; text-align:center;">${data.header[2]}</th>
                        <th style="background:#ef4444; color:#fff; text-align:center;">${data.header[3]}</th>
                        <th style="background:#1e293b;">${data.header[4]}</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        `;
    } else {
        const c1 = data.isInverted ? 'rgba(239, 68, 68, 0.4)' : 'rgba(16, 185, 129, 0.15)';
        const t1 = data.isInverted ? '#ef4444' : '#10b981';
        const c3 = data.isInverted ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.15)';
        const t3 = data.isInverted ? '#10b981' : '#ef4444';

        let rowsHtml = data.rows.map(row => `
            <tr>
                <td>${row.cond}</td>
                <td style="background: ${c1}; color: ${t1}; font-weight: 700;">${row.n1}</td>
                <td style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-weight: 700;">${row.n2}</td>
                <td style="background: ${c3}; color: ${t3}; font-weight: 700;">${row.n3}</td>
                <td style="font-size: 0.75rem; opacity: 0.8;">${row.obs}</td>
            </tr>
        `).join('');
        
        bodyHtml = `
            <table class="threshold-table">
                <thead>
                    <tr>
                        <th>Condición</th>
                        <th>Nivel 1</th>
                        <th>Nivel 2</th>
                        <th>Nivel 3</th>
                        <th>Obs.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        `;
    }

    modal.innerHTML = `
        <div class="threshold-modal-card">
            <div class="threshold-header">
                <div>
                    <h3 style="margin:0; font-size:1.1rem; color:#fff;">Umbrales: ${data.name}</h3>
                    <p style="margin:0; font-size:0.8rem; color:#94a3b8;">Guía de niveles para el control</p>
                </div>
                <button class="close-modal" onclick="hideThreshold()">×</button>
            </div>
            <div class="threshold-body">
                <div style="overflow-x: auto; -webkit-overflow-scrolling: touch;">
                    ${bodyHtml}
                </div>
            </div>
            <div class="threshold-footer">
                <button class="btn btn-primary" style="width: 100%;" onclick="hideThreshold()">ENTENDIDO</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
}

function hideThreshold() {
    const modal = document.getElementById('threshold-modal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => modal.remove(), 300);
    }
}

if (!document.getElementById('threshold-styles')) {
    const styles = document.createElement('style');
    styles.id = 'threshold-styles';
    styles.innerHTML = `
        .pest-icon-badge, .disease-icon-badge, .weed-icon-badge {
            cursor: pointer;
            position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .pest-icon-badge:hover, .disease-icon-badge:hover, .weed-icon-badge:hover {
            transform: scale(1.05);
            box-shadow: 0 0 15px rgba(255,255,255,0.2);
        }
        .pest-icon-badge::after, .disease-icon-badge::after, .weed-icon-badge::after {
            content: "\\2139\\FE0F";
            position: absolute;
            top: -5px;
            right: -5px;
            font-size: 10px;
            background: #1e293b;
            border-radius: 50%;
            width: 14px;
            height: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid rgba(255,255,255,0.2);
            pointer-events: none;
        }
        .threshold-modal-overlay {
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
            display: flex; align-items: center; justify-content: center;
            z-index: 10000; opacity: 0; transition: opacity 0.3s;
            padding: 1rem;
        }
        .threshold-modal-overlay.active { opacity: 1; }
        .threshold-modal-card {
            background: #1e293b; border: 1px solid rgba(255,255,255,0.1);
            border-radius: 20px; width: 100%; max-width: 600px;
            overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
            transform: translateY(20px); transition: transform 0.3s;
            max-height: 90vh; display: flex; flex-direction: column;
        }
        .threshold-modal-overlay.active .threshold-modal-card { transform: translateY(0); }
        .threshold-header {
            padding: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05);
            display: flex; justify-content: space-between; align-items: center;
            flex-shrink: 0;
        }
        .close-modal {
            background: rgba(255,255,255,0.05); border: none; color: #fff;
            width: 32px; height: 32px; border-radius: 50%; display: flex;
            align-items: center; justify-content: center; font-size: 1.2rem;
            cursor: pointer;
        }
        .threshold-body { 
            padding: 0; 
            overflow-y: auto;
            flex-grow: 1;
        }
        .threshold-table {
            width: 100%; border-collapse: collapse; min-width: 450px;
        }
        .threshold-table th {
            text-align: left; padding: 1rem; font-size: 0.7rem;
            text-transform: uppercase; letter-spacing: 1px; color: #64748b;
            border-bottom: 1px solid rgba(255,255,255,0.05);
            position: sticky; top: 0; background: #1e293b;
        }
        .threshold-table td {
            padding: 0.85rem 1rem; font-size: 0.85rem; color: #cbd5e1;
            border-bottom: 1px solid rgba(255,255,255,0.02);
        }
        .threshold-footer { padding: 1.25rem; border-top: 1px solid rgba(255,255,255,0.05); flex-shrink: 0; }
    `;
    document.head.appendChild(styles);
}

console.log('Sistema de Plagueo en Piña cargado.');

