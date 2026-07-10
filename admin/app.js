// ================= Configuration Supabase =================
const supabaseUrl = 'https://kmydbkaytrxtcequngnn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtteWRia2F5dHJ4dGNlcXVuZ25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTg3MzAsImV4cCI6MjA5MjI5NDczMH0.r2-XqflO75NbxVvqMfU7c-A367R9oKZ841To4uznhOA';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Barème des frais de dépôt par catégorie (miroir de CATEGORY_PRICES côté app).
// Sert UNIQUEMENT de repli pour les annonces dont le montant n'a pas été stocké
// (anciennes annonces). Le montant réel payé est lu depuis annonces.montant_depot.
const CATEGORY_FEES = {
  'telephonie_electronique': 250,
  'mode_beaute':             250,
  'maison_electromenager':   250,
  'voitures':                5000,
  'motos':                   1000,
  'immobilier':              2500,
  'alimentation':            500,
  'services':                500
};
const DEFAULT_FEE = 250;

// Frais réellement payé pour une annonce : montant stocké en base, sinon repli
// sur le barème de la catégorie.
function feeOf(a) {
  if (a && typeof a.montant_depot === 'number' && a.montant_depot > 0) return a.montant_depot;
  return CATEGORY_FEES[a?.categorie] ?? DEFAULT_FEE;
}

// Libellés des catégories (clé technique -> affichage)
const CATEGORY_LABELS = {
  'telephonie_electronique': 'Électronique',
  'mode_beaute': 'Mode & Beauté',
  'maison_electromenager': 'Maison',
  'voitures': 'Voitures',
  'motos': 'Motos',
  'immobilier': 'Immobilier',
  'alimentation': 'Alimentation',
  'services': 'Services'
};

// Métadonnées d'en-tête par page
const PAGE_META = {
  dashboard:    { title: 'Tableau de Bord', subtitle: "Vue d'ensemble et métriques en temps réel de votre plateforme" },
  users:        { title: 'Utilisateurs',    subtitle: "Liste complète des comptes inscrits sur Flash Market" },
  annonces:     { title: 'Annonces',        subtitle: "Tous les dépôts d'annonces publiés par vos vendeurs" },
  finances:     { title: 'Finances',        subtitle: "Revenus générés par les frais de dépôt d'annonces" },
  signalements: { title: 'Signalements',    subtitle: "Gérez les plaintes et signalements d'annonces ou de vendeurs" },
  parrainage:   { title: 'Parrainage',      subtitle: "Programme partenaire : activation des parrains, suivi des cycles et paiements Orange Money" }
};

// Instances Chart.js (pour pouvoir les détruire au rechargement)
let categoryChartInstance = null;
let userRatioChartInstance = null;
let revenueChartInstance = null;

// Données chargées en mémoire (servent à filtrer côté client)
let allUsers = [];
let allAnnonces = [];
let allSignalements = [];

// Données du module parrainage (null tant que la migration n'est pas en base)
let campagneSante = null;
let allParrains = [];
let allParrainages = [];
// Filtre "annonces d'un utilisateur" (bouton Voir annonces d'un parrain)
let annoncesUserFilter = null;

// ================= Éléments DOM =================
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const dateDisplay = document.getElementById('date-display');
const adminEmailDisplay = document.getElementById('admin-email-display');
const sectionTitle = document.getElementById('section-title');
const sectionSubtitle = document.getElementById('section-subtitle');

// Afficher la date du jour
dateDisplay.textContent = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

// ================= NAVIGATION (routeur de pages) =================
function navigateTo(page) {
  if (!PAGE_META[page]) page = 'dashboard';

  // Afficher / masquer les pages
  document.querySelectorAll('.page').forEach(el => el.classList.add('hidden'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.remove('hidden');

  // Mettre à jour l'état actif de la sidebar
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.page === page);
  });

  // Mettre à jour le titre de l'en-tête
  sectionTitle.textContent = PAGE_META[page].title;
  sectionSubtitle.textContent = PAGE_META[page].subtitle;

  // Remonter en haut de la zone de contenu
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Clic sur les items de la sidebar
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.page));
});

// Boutons « Voir tout » du dashboard
document.querySelectorAll('[data-goto]').forEach(btn => {
  btn.addEventListener('click', () => navigateTo(btn.dataset.goto));
});

// ================= AUTHENTIFICATION =================
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  handleAuthStateChange(session);
});

_supabase.auth.onAuthStateChange((_event, session) => {
  handleAuthStateChange(session);
});

async function handleAuthStateChange(session) {
  if (session && session.user) {
    const user = session.user;

    // Vérifier le statut admin EN BASE (RLS + fonction is_admin), pas via l'e-mail.
    let isAuthorized = false;
    try {
      const { data, error } = await _supabase.rpc('is_admin');
      if (error) throw error;
      isAuthorized = data === true;
    } catch (err) {
      console.error('Vérification admin échouée:', err);
      isAuthorized = false;
    }

    if (isAuthorized) {
      adminEmailDisplay.textContent = user.email;
      authContainer.classList.add('opacity-0');
      setTimeout(() => {
        authContainer.classList.add('hidden');
        appContainer.classList.remove('hidden');
        appContainer.classList.add('opacity-100');
      }, 300);

      navigateTo('dashboard');
      loadDashboardData();
    } else {
      alert("Accès refusé. Ce tableau de bord est réservé aux administrateurs.");
      await _supabase.auth.signOut();
      showLoginForm();
    }
  } else {
    showLoginForm();
  }
}

function showLoginForm() {
  appContainer.classList.add('hidden');
  authContainer.classList.remove('hidden');
  authContainer.classList.remove('opacity-0');
  authContainer.classList.add('opacity-100');

  loginBtn.disabled = false;
  loginBtn.innerHTML = '<span>Se connecter</span><i class="fa-solid fa-arrow-right text-xs"></i>';
}

loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i><span>Connexion...</span>';
  loginError.classList.add('hidden');

  try {
    const { error } = await _supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // La session sera interceptée par l'écouteur d'état d'authentification
  } catch (err) {
    console.error('Erreur connexion:', err);
    loginError.textContent = err.message || 'Une erreur est survenue lors de la connexion.';
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>Se connecter</span><i class="fa-solid fa-arrow-right text-xs"></i>';
  }
});

logoutBtn.addEventListener('click', async () => {
  if (confirm("Voulez-vous vous déconnecter ?")) {
    await _supabase.auth.signOut();
    location.reload();
  }
});

refreshBtn.addEventListener('click', () => {
  refreshBtn.firstElementChild?.classList.add('animate-spin');
  loadDashboardData().finally(() => {
    setTimeout(() => refreshBtn.firstElementChild?.classList.remove('animate-spin'), 600);
  });
});

// ================= CHARGEMENT DES DONNÉES =================
async function loadDashboardData() {
  try {
    const { data: users, error: usersError } = await _supabase
      .from('users')
      .select('*')
      .order('date_creation', { ascending: false });
    if (usersError) throw usersError;

    const { data: annonces, error: annoncesError } = await _supabase
      .from('annonces')
      .select('*, users(prenom, nom)')
      .order('date_creation', { ascending: false });
    if (annoncesError) throw annoncesError;

    const { data: signalements, error: sigError } = await _supabase
      .from('signalements')
      .select('*, annonces(titre, user_id), users!cible_user_id(prenom, nom)')
      .order('date_creation', { ascending: false });
    if (sigError) throw sigError;

    allUsers = users || [];
    allAnnonces = annonces || [];
    allSignalements = signalements || [];

    // Module parrainage : chargé à part pour ne pas casser le reste du
    // dashboard tant que migration_parrainage.sql n'est pas exécutée en base.
    try {
      const { data: sante, error: santeError } = await _supabase
        .from('v_campagne_sante')
        .select('*')
        .eq('active', true)
        .maybeSingle();
      if (santeError) throw santeError;

      const { data: parrains, error: parrainsError } = await _supabase
        .from('v_parrains_dashboard')
        .select('*')
        .order('date_autorisation', { ascending: true });
      if (parrainsError) throw parrainsError;

      const { data: parrainages, error: parrainagesError } = await _supabase
        .from('parrainages')
        .select('*, users(prenom, nom, num_telephone, date_creation)')
        .order('date_saisie_code', { ascending: false });
      if (parrainagesError) throw parrainagesError;

      campagneSante = sante;
      allParrains = parrains || [];
      allParrainages = parrainages || [];
    } catch (err) {
      console.warn('Module parrainage indisponible (migration non exécutée ?):', err.message);
      campagneSante = null;
      allParrains = [];
      allParrainages = [];
    }

    // Rendu de toutes les vues
    updateKPIs();
    renderCharts();
    renderRecentTables();
    renderUsersPage();
    renderAnnoncesPage();
    renderFinancesPage();
    renderSignalementsPage();
    renderParrainagePage();
  } catch (err) {
    console.error('Erreur lors du chargement des données:', err);
    alert('Impossible de charger les données du dashboard : ' + err.message);
  }
}

// Nombre d'éléments créés dans le mois calendaire courant
function countThisMonth(list) {
  const now = new Date();
  return list.filter(item => {
    if (!item.date_creation) return false;
    const d = new Date(item.date_creation);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
}

function fmt(n) { return Number(n || 0).toLocaleString('fr-FR'); }
function fullName(u) { return `${u?.prenom || ''} ${u?.nom || ''}`.trim() || '—'; }
function fmtDate(s) { return s ? new Date(s).toLocaleDateString('fr-FR') : '—'; }

// ================= KPIs (Dashboard) =================
function updateKPIs() {
  const totalUsers = allUsers.length;
  const proUsers = allUsers.filter(u => u.type_compte === 'professionnel').length;
  const totalAds = allAnnonces.length;
  const paidAds = allAnnonces.filter(a => a.est_payee === true);
  const totalRevenue = paidAds.reduce((sum, a) => sum + feeOf(a), 0);

  const newUsersMonth = countThisMonth(allUsers);
  const newAdsMonth = countThisMonth(allAnnonces);
  const proPct = totalUsers > 0 ? Math.round((proUsers / totalUsers) * 100) : 0;

  document.getElementById('stat-total-users').textContent = fmt(totalUsers);
  document.getElementById('stat-pro-users').textContent = fmt(proUsers);
  document.getElementById('stat-total-ads').textContent = fmt(totalAds);
  document.getElementById('stat-total-revenue').textContent = fmt(totalRevenue) + ' FCFA';

  document.getElementById('stat-users-trend').innerHTML = `<i class="fa-solid fa-arrow-trend-up mr-1"></i> ${fmt(newUsersMonth)} ce mois`;
  document.getElementById('stat-ads-trend').innerHTML = `<i class="fa-solid fa-arrow-trend-up mr-1"></i> ${fmt(newAdsMonth)} ce mois`;
  document.getElementById('stat-pro-trend').innerHTML = `<i class="fa-solid fa-store mr-1"></i> ${proPct}% des comptes`;
}

// ================= GRAPHIQUES (Dashboard) =================
function renderCharts() {
  // --- Graphique 1 : Répartition des catégories ---
  const counts = {};
  Object.keys(CATEGORY_LABELS).forEach(k => counts[k] = 0);
  allAnnonces.forEach(a => { if (counts[a.categorie] !== undefined) counts[a.categorie]++; });

  const labels = Object.keys(counts).map(k => CATEGORY_LABELS[k]);
  const data = Object.values(counts);

  if (categoryChartInstance) categoryChartInstance.destroy();
  categoryChartInstance = new Chart(document.getElementById('categoryChart').getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: "Nombre d'annonces",
        data,
        backgroundColor: 'rgba(16, 185, 129, 0.65)',
        borderColor: '#10b981',
        borderWidth: 1.5,
        borderRadius: 8,
        hoverBackgroundColor: '#10b981',
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.07)' }, ticks: { color: '#6b7280', font: { family: 'Outfit' }, precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#6b7280', font: { family: 'Outfit' } } }
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() }
    }
  });

  // --- Graphique 2 : Particulier vs PRO ---
  const proCount = allUsers.filter(u => u.type_compte === 'professionnel').length;
  const particulCount = allUsers.length - proCount;

  if (userRatioChartInstance) userRatioChartInstance.destroy();
  userRatioChartInstance = new Chart(document.getElementById('userRatioChart').getContext('2d'), {
    type: 'doughnut',
    data: {
      labels: ['Particuliers', 'Professionnels (PRO)'],
      datasets: [{
        data: [particulCount, proCount],
        backgroundColor: ['rgba(148,163,184,0.55)', 'rgba(59,130,246,0.65)'],
        borderColor: ['#64748b', '#3b82f6'],
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: { position: 'bottom', labels: { color: '#6b7280', padding: 20, font: { family: 'Outfit', size: 12 } } },
        tooltip: tooltipStyle()
      }
    }
  });
}

function tooltipStyle() {
  return {
    backgroundColor: '#0f172a', titleColor: '#fff', bodyColor: '#cbd5e1',
    borderColor: '#1e293b', borderWidth: 1,
    titleFont: { family: 'Outfit', weight: 'bold' }, bodyFont: { family: 'Outfit' }
  };
}

// ================= BADGES =================
function accountBadge(type) {
  return type === 'professionnel'
    ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">PRO</span>'
    : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">Particulier</span>';
}

function statusBadge(a) {
  if (a.statut === 'suspendu') {
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">Suspendue</span>';
  }
  if (a.est_payee) {
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">En ligne</span>';
  }
  return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Attente paiement</span>';
}

// ================= TABLES RÉCENTES (Dashboard) =================
function renderRecentTables() {
  const usersBody = document.getElementById('table-recent-users');
  const recentUsers = allUsers.slice(0, 5);
  usersBody.innerHTML = recentUsers.length === 0
    ? '<tr><td colspan="4" class="py-6 text-center text-gray-500">Aucun utilisateur.</td></tr>'
    : recentUsers.map(u => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-gray-900">${fullName(u)}</td>
        <td class="py-3.5 text-gray-400">${u.num_telephone || '—'}</td>
        <td class="py-3.5">${accountBadge(u.type_compte)}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(u.date_creation)}</td>
      </tr>`).join('');

  const adsBody = document.getElementById('table-recent-ads');
  const recentAds = allAnnonces.slice(0, 5);
  adsBody.innerHTML = recentAds.length === 0
    ? '<tr><td colspan="5" class="py-6 text-center text-gray-500">Aucune annonce.</td></tr>'
    : recentAds.map(a => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-gray-900 truncate max-w-[150px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-xs text-gray-400">${CATEGORY_LABELS[a.categorie] || a.categorie || '—'}</td>
        <td class="py-3.5 text-emerald-600 font-bold">${fmt(a.prix)} FCFA</td>
        <td class="py-3.5">${statusBadge(a)}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(a.date_creation)}</td>
      </tr>`).join('');
}

// ================= PAGE UTILISATEURS =================
function adsCountByUser(userId) {
  return allAnnonces.filter(a => a.user_id === userId).length;
}

function renderUsersPage() {
  const search = (document.getElementById('users-search').value || '').toLowerCase().trim();
  const filter = document.getElementById('users-filter').value;

  let list = allUsers;
  if (filter !== 'all') list = list.filter(u => u.type_compte === filter);
  if (search) {
    list = list.filter(u =>
      fullName(u).toLowerCase().includes(search) ||
      (u.num_telephone || '').toLowerCase().includes(search)
    );
  }

  document.getElementById('users-count').textContent = fmt(list.length);

  const body = document.getElementById('table-all-users');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="6" class="py-8 text-center text-gray-500">Aucun utilisateur ne correspond.</td></tr>'
    : list.map(u => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-gray-900">${fullName(u)}</td>
        <td class="py-3.5 text-gray-400">${u.num_telephone || '—'}</td>
        <td class="py-3.5">
          ${accountBadge(u.type_compte)}
          ${u.statut === 'suspendu' 
            ? '<span class="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">Suspendu</span>' 
            : '<span class="ml-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Actif</span>'
          }
        </td>
        <td class="py-3.5 text-center text-gray-700">${fmt(adsCountByUser(u.id))}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(u.date_creation)}</td>
        <td class="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">
          <button onclick="toggleUserStatus('${u.id}', '${u.statut || 'actif'}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${u.statut === 'suspendu' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'} transition-all">${u.statut === 'suspendu' ? 'Réactiver' : 'Suspendre'}</button>
          <button onclick="deleteUser('${u.id}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Supprimer</button>
        </td>
      </tr>`).join('');
}

document.getElementById('users-search').addEventListener('input', renderUsersPage);
document.getElementById('users-filter').addEventListener('change', renderUsersPage);

// ================= PAGE ANNONCES =================
function populateCategoryFilter() {
  const select = document.getElementById('annonces-cat-filter');
  const current = select.value;
  // Conserve l'option « Toutes catégories » + reconstruit la liste
  select.innerHTML = '<option value="all">Toutes catégories</option>' +
    Object.entries(CATEGORY_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  select.value = current || 'all';
}

function renderAnnoncesPage() {
  populateCategoryFilter();

  const search = (document.getElementById('annonces-search').value || '').toLowerCase().trim();
  const cat = document.getElementById('annonces-cat-filter').value;
  const status = document.getElementById('annonces-status-filter').value;

  let list = allAnnonces;
  if (annoncesUserFilter) list = list.filter(a => a.user_id === annoncesUserFilter.id);
  if (cat !== 'all') list = list.filter(a => a.categorie === cat);
  if (status === 'paid') list = list.filter(a => a.est_payee === true && a.statut !== 'suspendu');
  if (status === 'pending') list = list.filter(a => !a.est_payee);
  if (search) list = list.filter(a => (a.titre || '').toLowerCase().includes(search));

  // Chip du filtre utilisateur (activé depuis l'onglet Parrainage)
  const chip = document.getElementById('annonces-user-chip');
  if (annoncesUserFilter) {
    document.getElementById('annonces-user-chip-label').textContent = 'Annonces de ' + annoncesUserFilter.name + ' — retirer le filtre';
    chip.classList.remove('hidden');
  } else {
    chip.classList.add('hidden');
  }

  document.getElementById('annonces-count').textContent = fmt(list.length);

  const body = document.getElementById('table-all-annonces');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="7" class="py-8 text-center text-gray-500">Aucune annonce ne correspond.</td></tr>'
    : list.map(a => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-gray-900 truncate max-w-[180px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-gray-400 text-xs">${fullName(a.users)}</td>
        <td class="py-3.5 text-xs text-gray-400">${CATEGORY_LABELS[a.categorie] || a.categorie || '—'}</td>
        <td class="py-3.5 text-emerald-600 font-bold">${fmt(a.prix)} FCFA</td>
        <td class="py-3.5">${statusBadge(a)}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(a.date_creation)}</td>
        <td class="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">
          <button onclick="toggleAnnonceStatus('${a.id}', '${a.statut}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg border ${a.statut === 'suspendu' ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'} transition-all">${a.statut === 'suspendu' ? 'Réactiver' : 'Suspendre'}</button>
          <button onclick="deleteAnnonce('${a.id}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Supprimer</button>
        </td>
      </tr>`).join('');
}

document.getElementById('annonces-search').addEventListener('input', renderAnnoncesPage);
document.getElementById('annonces-cat-filter').addEventListener('change', renderAnnoncesPage);
document.getElementById('annonces-status-filter').addEventListener('change', renderAnnoncesPage);

// ================= PAGE FINANCES =================
function renderFinancesPage() {
  const paidAds = allAnnonces.filter(a => a.est_payee === true);
  const pendingAds = allAnnonces.filter(a => !a.est_payee);

  const totalRevenue = paidAds.reduce((sum, a) => sum + feeOf(a), 0);
  const pendingRevenue = pendingAds.reduce((sum, a) => sum + feeOf(a), 0);

  document.getElementById('fin-total-revenue').textContent = fmt(totalRevenue) + ' FCFA';
  document.getElementById('fin-paid-count').textContent = fmt(paidAds.length);
  document.getElementById('fin-pending-count').textContent = fmt(pendingAds.length);
  document.getElementById('fin-pending-revenue').textContent = fmt(pendingRevenue) + ' FCFA';

  // --- Graphique : revenus par mois (12 derniers mois) ---
  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }), total: 0 });
  }
  const monthIndex = {};
  months.forEach((m, i) => monthIndex[m.key] = i);

  paidAds.forEach(a => {
    if (!a.date_creation) return;
    const d = new Date(a.date_creation);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (monthIndex[key] !== undefined) months[monthIndex[key]].total += feeOf(a);
  });

  if (revenueChartInstance) revenueChartInstance.destroy();
  revenueChartInstance = new Chart(document.getElementById('revenueChart').getContext('2d'), {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Revenus de dépôt (FCFA)',
        data: months.map(m => m.total),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16,185,129,0.12)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#10b981',
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.07)' }, ticks: { color: '#6b7280', font: { family: 'Outfit' }, callback: v => fmt(v) } },
        x: { grid: { display: false }, ticks: { color: '#6b7280', font: { family: 'Outfit' } } }
      },
      plugins: { legend: { display: false }, tooltip: tooltipStyle() }
    }
  });

  // --- Table : derniers paiements ---
  const body = document.getElementById('table-finances');
  const recentPaid = paidAds.slice(0, 15);
  body.innerHTML = recentPaid.length === 0
    ? '<tr><td colspan="4" class="py-8 text-center text-gray-500">Aucun paiement enregistré.</td></tr>'
    : recentPaid.map(a => `
      <tr class="hover:bg-gray-50 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-gray-900 truncate max-w-[200px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-gray-400 text-xs">${fullName(a.users)}</td>
        <td class="py-3.5 text-emerald-600 font-bold">${fmt(feeOf(a))} FCFA</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(a.date_creation)}</td>
      </tr>`).join('');
}

// ================= PAGE SIGNALEMENTS =================
function renderSignalementsPage() {
  const filter = document.getElementById('signalements-filter').value;
  let list = allSignalements;

  if (filter === 'annonce') list = list.filter(s => s.annonce_id !== null);
  if (filter === 'vendeur') list = list.filter(s => s.cible_user_id !== null);

  document.getElementById('signalements-count').textContent = fmt(list.length);

  const body = document.getElementById('table-all-signalements');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="6" class="py-8 text-center text-gray-500">Aucun signalement actif.</td></tr>'
    : list.map(s => {
        const typeBadge = s.annonce_id 
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">Annonce</span>'
          : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">Vendeur</span>';
        
        let targetText = '—';
        let actionBtn = '';

        if (s.annonce_id) {
          targetText = `Annonce : <span class="font-semibold text-gray-900">${s.annonces?.titre || 'Annonce supprimée'}</span>`;
          if (s.annonce_id) {
            actionBtn = `<button onclick="toggleAnnonceStatus('${s.annonce_id}', 'active')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-amber-50 text-amber-600 border border-amber-200 hover:bg-amber-100 transition-all">Suspendre l'annonce</button>`;
          }
        } else if (s.cible_user_id) {
          const name = s.users ? `${s.users.prenom || ''} ${s.users.nom || ''}`.trim() : 'Vendeur supprimé';
          targetText = `Vendeur : <span class="font-semibold text-gray-900">${name}</span>`;
          actionBtn = `<button onclick="toggleUserStatus('${s.cible_user_id}', 'actif')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-purple-50 text-purple-600 border border-purple-200 hover:bg-purple-100 transition-all">Suspendre le vendeur</button>`;
        }

        return `
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="py-3.5 pl-2">${typeBadge}</td>
            <td class="py-3.5 text-xs text-gray-600">${targetText}</td>
            <td class="py-3.5 font-medium text-gray-900">${s.motif}</td>
            <td class="py-3.5 text-xs text-gray-400 max-w-[200px] truncate" title="${s.details || ''}">${s.details || '—'}</td>
            <td class="py-3.5 text-gray-500 text-xs">${fmtDate(s.date_creation)}</td>
            <td class="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">
              ${actionBtn}
              <button onclick="dismissSignalement('${s.id}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-all">Rejeter</button>
            </td>
          </tr>`;
      }).join('');
}

document.getElementById('signalements-filter').addEventListener('change', renderSignalementsPage);

// ================= MODÉRATION ACTIONS (WINDOW BINDINGS) =================
window.toggleUserStatus = async function(userId, currentStatus) {
  const newStatus = currentStatus === 'suspendu' ? 'actif' : 'suspendu';
  const label = newStatus === 'suspendu' ? 'suspendre' : 'réactiver';
  
  if (confirm(`Voulez-vous vraiment ${label} cet utilisateur ?`)) {
    try {
      const { error } = await _supabase
        .from('users')
        .update({ statut: newStatus })
        .eq('id', userId);
      
      if (error) throw error;
      alert(`Utilisateur mis à jour avec succès (statut : ${newStatus}).`);
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la modération de l\'utilisateur: ' + err.message);
    }
  }
};

window.deleteUser = async function(userId) {
  if (confirm("Voulez-vous vraiment SUPPRIMER définitivement cet utilisateur et TOUTES ses annonces ? Cette action est irréversible.")) {
    try {
      const { error } = await _supabase
        .from('users')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      alert("Utilisateur supprimé avec succès.");
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression de l\'utilisateur: ' + err.message);
    }
  }
};

window.toggleAnnonceStatus = async function(annonceId, currentStatus) {
  const newStatus = currentStatus === 'suspendu' ? 'active' : 'suspendu';
  const label = newStatus === 'suspendu' ? 'suspendre' : 'remettre en ligne';

  if (confirm(`Voulez-vous vraiment ${label} cette annonce ?`)) {
    try {
      const { error } = await _supabase
        .from('annonces')
        .update({ statut: newStatus })
        .eq('id', annonceId);
      
      if (error) throw error;
      alert(`Annonce mise à jour avec succès (statut : ${newStatus}).`);
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la modération de l\'annonce: ' + err.message);
    }
  }
};

window.deleteAnnonce = async function(annonceId) {
  if (confirm("Voulez-vous vraiment SUPPRIMER définitivement cette annonce ? Cette action est irréversible.")) {
    try {
      const { error } = await _supabase
        .from('annonces')
        .delete()
        .eq('id', annonceId);
      
      if (error) throw error;
      alert("Annonce supprimée avec succès.");
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression de l\'annonce: ' + err.message);
    }
  }
};

// ================= PAGE PARRAINAGE =================
const PARRAINAGE_STATUS_BADGES = {
  en_attente: '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-100 text-gray-600 border border-gray-200">En attente</span>',
  valide:     '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">À payer</span>',
  paye:       '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Payé</span>',
  rejete:     '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-700 border border-red-200">Rejeté</span>'
};

function renderParrainagePage() {
  const notReady = document.getElementById('parrainage-not-ready');
  const content = document.getElementById('parrainage-content');

  if (!campagneSante) {
    notReady.classList.remove('hidden');
    content.classList.add('hidden');
    return;
  }
  notReady.classList.add('hidden');
  content.classList.remove('hidden');

  // --- KPIs ---
  const s = campagneSante;
  const aPayes = Number(s.cycles_payes || 0);
  const aPayer = Number(s.cycles_a_payer || 0);
  document.getElementById('par-parrains-count').textContent = `${fmt(s.parrains_actives)} / ${fmt(s.max_parrains)}`;
  document.getElementById('par-codes-generes').textContent = fmt(s.codes_generes);
  document.getElementById('par-eligibles').textContent = fmt(s.parrains_eligibles);
  document.getElementById('par-budget-engage').textContent = fmt(s.budget_engage) + ' FCFA';
  document.getElementById('par-budget-restant').textContent = fmt(s.budget_restant) + ' FCFA';
  document.getElementById('par-budget-total').textContent = fmt(s.budget_total) + ' FCFA';
  document.getElementById('par-a-payer-count').textContent = fmt(aPayer);
  document.getElementById('par-a-payer-montant').textContent = fmt(aPayer * s.recompense) + ' FCFA';
  document.getElementById('par-payes-count').textContent = fmt(aPayes);
  document.getElementById('par-payes-montant').textContent = fmt(aPayes * s.recompense) + ' FCFA';
  const pct = s.budget_total > 0 ? Math.min(100, Math.round((s.budget_engage / s.budget_total) * 100)) : 0;
  const bar = document.getElementById('par-budget-bar');
  bar.style.width = pct + '%';
  bar.classList.toggle('bg-amber-500', pct >= 80 && pct < 100);
  bar.classList.toggle('bg-red-500', pct >= 100);
  bar.classList.toggle('bg-emerald-500', pct < 80);

  // --- Table des parrains ---
  document.getElementById('parrains-table-count').textContent = fmt(allParrains.length);
  const parrainsBody = document.getElementById('table-parrains');
  parrainsBody.innerHTML = allParrains.length === 0
    ? '<tr><td colspan="7" class="py-8 text-center text-gray-400">Aucun parrain activé.</td></tr>'
    : allParrains.map(p => {
        const name = `${p.prenom || ''} ${p.nom || ''}`.trim() || '—';
        const codeCell = p.code
          ? `<span class="font-mono font-bold text-gray-900 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">${p.code}</span>`
          : '<span class="text-xs text-gray-400 italic">Pas encore généré</span>';
        const omCell = p.om_numero
          ? `<span class="font-semibold text-gray-900">${p.om_numero}</span><br><span class="text-xs text-gray-400">${p.om_titulaire || ''}</span>`
          : '<span class="text-xs text-gray-400 italic">Non renseigné</span>';
        const annoncesCell = p.eligible
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Éligible ✓</span>'
          : `<span class="text-gray-700 font-semibold">${fmt(p.annonces_valides)} / ${fmt(p.annonces_requises)}</span>`;
        return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="py-3.5 pl-2">
            <span class="font-semibold text-gray-900">${name}</span><br>
            <span class="text-xs text-gray-400">${p.num_telephone || p.email || ''}</span>
          </td>
          <td class="py-3.5">${codeCell}</td>
          <td class="py-3.5">${omCell}</td>
          <td class="py-3.5 text-center">${annoncesCell}</td>
          <td class="py-3.5 text-center text-gray-700 font-semibold">${fmt(p.filleuls_inscrits)} / <span class="text-amber-600">${fmt(p.filleuls_valides)}</span> / <span class="text-emerald-600">${fmt(p.filleuls_payes)}</span></td>
          <td class="py-3.5 text-right font-bold ${p.montant_du > 0 ? 'text-amber-600' : 'text-gray-400'}">${fmt(p.montant_du)} F</td>
          <td class="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">
            <button onclick="voirAnnoncesParrain('${p.user_id}', '${name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-all">Voir annonces</button>
            <button onclick="retirerParrain('${p.user_id}', '${name.replace(/'/g, "\\'")}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Retirer</button>
          </td>
        </tr>`;
      }).join('');

  // --- Table des parrainages ---
  const filter = document.getElementById('parrainages-filter').value;
  let list = allParrainages;
  if (filter !== 'all') list = list.filter(g => g.statut === filter);

  document.getElementById('parrainages-table-count').textContent = fmt(list.length);
  const parrainagesBody = document.getElementById('table-parrainages');
  const parrainById = {};
  allParrains.forEach(p => parrainById[p.user_id] = p);

  parrainagesBody.innerHTML = list.length === 0
    ? '<tr><td colspan="7" class="py-8 text-center text-gray-400">Aucun parrainage.</td></tr>'
    : list.map(g => {
        const filleulName = fullName(g.users);
        const parrain = parrainById[g.parrain_id];
        const parrainName = parrain ? (`${parrain.prenom || ''} ${parrain.nom || ''}`.trim() || '—') : '—';
        let actions = '';
        if (g.statut === 'valide') {
          actions += `<button onclick="marquerParrainagePaye('${g.id}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-all">Marquer payé</button> `;
        }
        if (g.statut === 'en_attente' || g.statut === 'valide') {
          actions += `<button onclick="rejeterParrainage('${g.id}')" class="px-2.5 py-1 text-xs font-semibold rounded-lg bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all">Rejeter</button>`;
        }
        return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="py-3.5 pl-2">
            <span class="font-semibold text-gray-900">${filleulName}</span><br>
            <span class="text-xs text-gray-400">${g.users?.num_telephone || ''}</span>
          </td>
          <td class="py-3.5 text-xs text-gray-500">${fmtDate(g.users?.date_creation)}</td>
          <td class="py-3.5 text-xs text-gray-700 font-semibold">${parrainName}${parrain?.code ? ` <span class="font-mono text-gray-400">(${parrain.code})</span>` : ''}</td>
          <td class="py-3.5 text-xs text-gray-500">${fmtDate(g.date_saisie_code)}</td>
          <td class="py-3.5">${PARRAINAGE_STATUS_BADGES[g.statut] || g.statut}</td>
          <td class="py-3.5 text-xs text-gray-500">${fmtDate(g.date_validation)}</td>
          <td class="py-3.5 text-right pr-2 space-x-1 whitespace-nowrap">${actions || '<span class="text-xs text-gray-300">—</span>'}</td>
        </tr>`;
      }).join('');

  renderParrainSearchResults();
}

document.getElementById('parrainages-filter').addEventListener('change', renderParrainagePage);

// --- Recherche + activation d'un parrain ---
function renderParrainSearchResults() {
  const search = (document.getElementById('parrain-search').value || '').toLowerCase().trim();
  const resultsBox = document.getElementById('parrain-search-results');

  if (search.length < 2) {
    resultsBox.innerHTML = '';
    return;
  }

  const dejaParrain = new Set(allParrains.map(p => p.user_id));
  const matches = allUsers.filter(u =>
    fullName(u).toLowerCase().includes(search) ||
    (u.num_telephone || '').toLowerCase().includes(search)
  ).slice(0, 5);

  resultsBox.innerHTML = matches.length === 0
    ? '<p class="text-xs text-gray-400 italic">Aucun utilisateur trouvé.</p>'
    : matches.map(u => `
      <div class="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5">
        <div>
          <span class="font-semibold text-sm text-gray-900">${fullName(u)}</span>
          <span class="text-xs text-gray-400 ml-2">${u.num_telephone || u.email || ''}</span>
          <span class="text-xs text-gray-400 ml-2">inscrit le ${fmtDate(u.date_creation)}</span>
        </div>
        ${dejaParrain.has(u.id)
          ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Déjà parrain</span>'
          : `<button onclick="activerParrain('${u.id}', '${fullName(u).replace(/'/g, "\\'")}')" class="px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 transition-all">Activer</button>`
        }
      </div>`).join('');
}

document.getElementById('parrain-search').addEventListener('input', renderParrainSearchResults);

// --- Actions parrainage ---
window.activerParrain = async function(userId, name) {
  if (!confirm(`Activer ${name} comme parrain ? La personne recevra une notification et pourra générer son code.`)) return;
  try {
    const { data, error } = await _supabase.rpc('activer_parrain', { p_user_id: userId });
    if (error) throw error;
    if (!data.ok) { alert(data.message); return; }
    alert(`${name} est maintenant parrain (${data.parrains_actives}/${data.max_parrains}).`);
    document.getElementById('parrain-search').value = '';
    loadDashboardData();
  } catch (err) {
    console.error(err);
    alert("Erreur lors de l'activation : " + err.message);
  }
};

window.marquerParrainagePaye = async function(parrainageId) {
  if (!confirm("Confirmer : vous avez bien ENVOYÉ le paiement Orange Money au parrain ? Le cycle sera marqué payé et le parrain notifié.")) return;
  try {
    const { data, error } = await _supabase.rpc('marquer_parrainage_paye', { p_parrainage_id: parrainageId });
    if (error) throw error;
    if (!data.ok) { alert(data.message); return; }
    loadDashboardData();
  } catch (err) {
    console.error(err);
    alert('Erreur : ' + err.message);
  }
};

window.rejeterParrainage = async function(parrainageId) {
  if (!confirm("Rejeter ce parrainage (fraude / annonces non crédibles) ? Il ne sera pas payé.")) return;
  try {
    const { error } = await _supabase
      .from('parrainages')
      .update({ statut: 'rejete' })
      .eq('id', parrainageId);
    if (error) throw error;
    loadDashboardData();
  } catch (err) {
    console.error(err);
    alert('Erreur : ' + err.message);
  }
};

window.retirerParrain = async function(userId, name) {
  if (!confirm(`Retirer ${name} du programme ? Son code sera désactivé et ses parrainages supprimés. Action irréversible.`)) return;
  try {
    const { error } = await _supabase
      .from('parrains')
      .delete()
      .eq('user_id', userId);
    if (error) throw error;
    loadDashboardData();
  } catch (err) {
    console.error(err);
    alert('Erreur : ' + err.message);
  }
};

window.voirAnnoncesParrain = function(userId, name) {
  annoncesUserFilter = { id: userId, name };
  navigateTo('annonces');
  renderAnnoncesPage();
};

window.clearAnnoncesUserFilter = function() {
  annoncesUserFilter = null;
  renderAnnoncesPage();
};

window.dismissSignalement = async function(sigId) {
  if (confirm("Voulez-vous rejeter ce signalement ? L'annonce/vendeur restera en ligne et le signalement sera effacé.")) {
    try {
      const { error } = await _supabase
        .from('signalements')
        .delete()
        .eq('id', sigId);
      
      if (error) throw error;
      alert("Signalement rejeté.");
      loadDashboardData();
    } catch (err) {
      console.error(err);
      alert('Erreur lors du rejet du signalement: ' + err.message);
    }
  }
};
