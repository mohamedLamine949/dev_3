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
  dashboard: { title: 'Tableau de Bord', subtitle: "Vue d'ensemble et métriques en temps réel de votre plateforme" },
  users:     { title: 'Utilisateurs',    subtitle: "Liste complète des comptes inscrits sur Flash Market" },
  annonces:  { title: 'Annonces',        subtitle: "Tous les dépôts d'annonces publiés par vos vendeurs" },
  finances:  { title: 'Finances',        subtitle: "Revenus générés par les frais de dépôt d'annonces" }
};

// Instances Chart.js (pour pouvoir les détruire au rechargement)
let categoryChartInstance = null;
let userRatioChartInstance = null;
let revenueChartInstance = null;

// Données chargées en mémoire (servent à filtrer côté client)
let allUsers = [];
let allAnnonces = [];

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

    allUsers = users || [];
    allAnnonces = annonces || [];

    // Rendu de toutes les vues
    updateKPIs();
    renderCharts();
    renderRecentTables();
    renderUsersPage();
    renderAnnoncesPage();
    renderFinancesPage();
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
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' }, precision: 0 } },
        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
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
        legend: { position: 'bottom', labels: { color: '#9ca3af', padding: 20, font: { family: 'Outfit', size: 12 } } },
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
    ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">PRO</span>'
    : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">Particulier</span>';
}

function statusBadge(a) {
  if (a.est_payee) {
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">En ligne</span>';
  }
  return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Attente paiement</span>';
}

// ================= TABLES RÉCENTES (Dashboard) =================
function renderRecentTables() {
  const usersBody = document.getElementById('table-recent-users');
  const recentUsers = allUsers.slice(0, 5);
  usersBody.innerHTML = recentUsers.length === 0
    ? '<tr><td colspan="4" class="py-6 text-center text-gray-500">Aucun utilisateur.</td></tr>'
    : recentUsers.map(u => `
      <tr class="hover:bg-gray-800/10 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-white">${fullName(u)}</td>
        <td class="py-3.5 text-gray-400">${u.num_telephone || '—'}</td>
        <td class="py-3.5">${accountBadge(u.type_compte)}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(u.date_creation)}</td>
      </tr>`).join('');

  const adsBody = document.getElementById('table-recent-ads');
  const recentAds = allAnnonces.slice(0, 5);
  adsBody.innerHTML = recentAds.length === 0
    ? '<tr><td colspan="5" class="py-6 text-center text-gray-500">Aucune annonce.</td></tr>'
    : recentAds.map(a => `
      <tr class="hover:bg-gray-800/10 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-white truncate max-w-[150px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-xs text-gray-400">${CATEGORY_LABELS[a.categorie] || a.categorie || '—'}</td>
        <td class="py-3.5 text-emerald-400 font-bold">${fmt(a.prix)} FCFA</td>
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
    ? '<tr><td colspan="5" class="py-8 text-center text-gray-500">Aucun utilisateur ne correspond.</td></tr>'
    : list.map(u => `
      <tr class="hover:bg-gray-800/10 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-white">${fullName(u)}</td>
        <td class="py-3.5 text-gray-400">${u.num_telephone || '—'}</td>
        <td class="py-3.5">${accountBadge(u.type_compte)}</td>
        <td class="py-3.5 text-center text-gray-300">${fmt(adsCountByUser(u.id))}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(u.date_creation)}</td>
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
  if (cat !== 'all') list = list.filter(a => a.categorie === cat);
  if (status === 'paid') list = list.filter(a => a.est_payee === true);
  if (status === 'pending') list = list.filter(a => !a.est_payee);
  if (search) list = list.filter(a => (a.titre || '').toLowerCase().includes(search));

  document.getElementById('annonces-count').textContent = fmt(list.length);

  const body = document.getElementById('table-all-annonces');
  body.innerHTML = list.length === 0
    ? '<tr><td colspan="6" class="py-8 text-center text-gray-500">Aucune annonce ne correspond.</td></tr>'
    : list.map(a => `
      <tr class="hover:bg-gray-800/10 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-white truncate max-w-[180px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-gray-400 text-xs">${fullName(a.users)}</td>
        <td class="py-3.5 text-xs text-gray-400">${CATEGORY_LABELS[a.categorie] || a.categorie || '—'}</td>
        <td class="py-3.5 text-emerald-400 font-bold">${fmt(a.prix)} FCFA</td>
        <td class="py-3.5">${statusBadge(a)}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(a.date_creation)}</td>
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
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#9ca3af', font: { family: 'Outfit' }, callback: v => fmt(v) } },
        x: { grid: { display: false }, ticks: { color: '#9ca3af', font: { family: 'Outfit' } } }
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
      <tr class="hover:bg-gray-800/10 transition-colors">
        <td class="py-3.5 pl-2 font-semibold text-white truncate max-w-[200px]" title="${a.titre || ''}">${a.titre || '—'}</td>
        <td class="py-3.5 text-gray-400 text-xs">${fullName(a.users)}</td>
        <td class="py-3.5 text-emerald-400 font-bold">${fmt(feeOf(a))} FCFA</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${fmtDate(a.date_creation)}</td>
      </tr>`).join('');
}
