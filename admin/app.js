// Configuration Supabase
const supabaseUrl = 'https://kmydbkaytrxtcequngnn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtteWRia2F5dHJ4dGNlcXVuZ25uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY3MTg3MzAsImV4cCI6MjA5MjI5NDczMH0.r2-XqflO75NbxVvqMfU7c-A367R9oKZ841To4uznhOA';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Variables pour stocker les graphiques Chart.js
let categoryChartInstance = null;
let userRatioChartInstance = null;

// Éléments DOM
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginForm = document.getElementById('login-form');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const logoutBtn = document.getElementById('logout-btn');
const refreshBtn = document.getElementById('refresh-btn');
const dateDisplay = document.getElementById('date-display');
const adminEmailDisplay = document.getElementById('admin-email-display');

// Afficher la date du jour
const options = { year: 'numeric', month: 'long', day: 'numeric' };
dateDisplay.textContent = new Date().toLocaleDateString('fr-FR', options);

// Vérifier la session au chargement de la page
window.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await _supabase.auth.getSession();
  handleAuthStateChange(session);
});

// Écouter les changements d'état d'authentification
_supabase.auth.onAuthStateChange((_event, session) => {
  handleAuthStateChange(session);
});

// Gérer l'état de connexion de l'utilisateur
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
      
      // Charger les données du dashboard
      loadDashboardData();
    } else {
      // Si l'utilisateur n'est pas admin, on le déconnecte immédiatement
      alert("Accès refusé. Ce tableau de bord est réservé aux administrateurs.");
      await _supabase.auth.signOut();
      showLoginForm();
    }
  } else {
    showLoginForm();
  }
}

// Afficher le formulaire de connexion
function showLoginForm() {
  appContainer.classList.add('hidden');
  authContainer.classList.remove('hidden');
  authContainer.classList.remove('opacity-0');
  authContainer.classList.add('opacity-100');
  
  // Réinitialiser le bouton de connexion
  loginBtn.disabled = false;
  loginBtn.innerHTML = '<span>Se connecter</span><i class="fa-solid fa-arrow-right text-xs"></i>';
}

// Connexion de l'utilisateur
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  
  loginBtn.disabled = true;
  loginBtn.innerHTML = '<i class="fa-solid fa-spinner animate-spin"></i><span>Connexion...</span>';
  loginError.classList.add('hidden');
  
  try {
    const { data, error } = await _supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    
    // Si la session est créée, elle sera interceptée par l'écouteur d'état d'authentification
  } catch (err) {
    console.error('Erreur connexion:', err);
    loginError.textContent = err.message || 'Une erreur est survenue lors de la connexion.';
    loginError.classList.remove('hidden');
    loginBtn.disabled = false;
    loginBtn.innerHTML = '<span>Se connecter</span><i class="fa-solid fa-arrow-right text-xs"></i>';
  }
});

// Déconnexion
logoutBtn.addEventListener('click', async () => {
  if (confirm("Voulez-vous vous déconnecter ?")) {
    await _supabase.auth.signOut();
    location.reload();
  }
});

// Rafraîchir les données
refreshBtn.addEventListener('click', () => {
  refreshBtn.classList.add('animate-spin');
  loadDashboardData().finally(() => {
    setTimeout(() => {
      refreshBtn.classList.remove('animate-spin');
    }, 600);
  });
});

// ================= CHARGEMENT DES DONNÉES =================

async function loadDashboardData() {
  try {
    // 1. Récupérer les utilisateurs
    const { data: users, error: usersError } = await _supabase
      .from('users')
      .select('*')
      .order('date_creation', { ascending: false });
      
    if (usersError) throw usersError;

    // 2. Récupérer les annonces
    const { data: annonces, error: annoncesError } = await _supabase
      .from('annonces')
      .select('*, users(prenom, nom)')
      .order('date_creation', { ascending: false });
      
    if (annoncesError) throw annoncesError;

    // 3. Mettre à jour les indicateurs clés (KPIs)
    updateKPIs(users, annonces);

    // 4. Rendre les graphiques
    renderCharts(users, annonces);

    // 5. Remplir les tables de données
    populateTables(users, annonces);

  } catch (err) {
    console.error('Erreur lors du chargement des données:', err);
    alert('Impossible de charger les données du dashboard : ' + err.message);
  }
}

// Calculer et afficher les KPI
function updateKPIs(users, annonces) {
  const totalUsers = users.length;
  const proUsers = users.filter(u => u.type_compte === 'professionnel').length;
  const totalAds = annonces.length;
  const soldAds = annonces.filter(a => a.statut === 'vendu').length;
  
  // Calcul du revenu: dépôt d'annonce payant (plat à 1000 FCFA pour chaque annonce payée)
  const paidAds = annonces.filter(a => a.est_payee === true);
  const totalRevenue = paidAds.length * 1000;

  document.getElementById('stat-total-users').textContent = totalUsers.toLocaleString('fr-FR');
  document.getElementById('stat-pro-users').textContent = proUsers.toLocaleString('fr-FR');
  document.getElementById('stat-total-ads').textContent = totalAds.toLocaleString('fr-FR');
  document.getElementById('stat-sold-ads').textContent = soldAds.toLocaleString('fr-FR');
  document.getElementById('stat-total-revenue').textContent = totalRevenue.toLocaleString('fr-FR') + ' FCFA';
}

// Rendre les diagrammes interactifs
function renderCharts(users, annonces) {
  const isDark = true; // Dashboard en dark mode par défaut
  
  // --- Graphique 1: Répartition des catégories ---
  const categoriesCount = {
    'telephonie_electronique': 0,
    'mode_beaute': 0,
    'maison_electromenager': 0,
    'voitures': 0,
    'motos': 0,
    'immobilier': 0,
    'alimentation': 0,
    'services': 0
  };
  
  annonces.forEach(a => {
    if (categoriesCount[a.categorie] !== undefined) {
      categoriesCount[a.categorie]++;
    }
  });

  const categoryLabels = {
    'telephonie_electronique': 'Électronique',
    'mode_beaute': 'Mode & Beauté',
    'maison_electromenager': 'Maison',
    'voitures': 'Voitures',
    'motos': 'Motos',
    'immobilier': 'Immobilier',
    'alimentation': 'Alimentation',
    'services': 'Services'
  };

  const chartLabels = Object.keys(categoriesCount).map(k => categoryLabels[k]);
  const chartData = Object.values(categoriesCount);

  if (categoryChartInstance) {
    categoryChartInstance.destroy();
  }

  const ctx1 = document.getElementById('categoryChart').getContext('2d');
  categoryChartInstance = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels: chartLabels,
      datasets: [{
        label: 'Nombre d\'annonces',
        data: chartData,
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
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#9ca3af', font: { family: 'Outfit' } }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: '#1e293b',
          borderWidth: 1,
          titleFont: { family: 'Outfit', weight: 'bold' },
          bodyFont: { family: 'Outfit' }
        }
      }
    }
  });

  // --- Graphique 2: Répartition des comptes (Particulier vs PRO) ---
  const proCount = users.filter(u => u.type_compte === 'professionnel').length;
  const particulCount = users.length - proCount;

  if (userRatioChartInstance) {
    userRatioChartInstance.destroy();
  }

  const ctx2 = document.getElementById('userRatioChart').getContext('2d');
  userRatioChartInstance = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: ['Particuliers', 'Professionnels (PRO)'],
      datasets: [{
        data: [particulCount, proCount],
        backgroundColor: [
          'rgba(148, 163, 184, 0.55)', // slate-400
          'rgba(59, 130, 246, 0.65)',  // blue-500
        ],
        borderColor: [
          '#64748b',
          '#3b82f6'
        ],
        borderWidth: 1.5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '70%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: '#9ca3af', padding: 20, font: { family: 'Outfit', size: 12 } }
        },
        tooltip: {
          backgroundColor: '#0f172a',
          titleColor: '#fff',
          bodyColor: '#cbd5e1',
          borderColor: '#1e293b',
          borderWidth: 1,
          titleFont: { family: 'Outfit', weight: 'bold' },
          bodyFont: { family: 'Outfit' }
        }
      }
    }
  });
}

// Remplir les tables d'activités récentes
function populateTables(users, annonces) {
  // --- 1. Remplir Table Utilisateurs ---
  const usersBody = document.getElementById('table-users-body');
  usersBody.innerHTML = '';
  
  const recentUsers = users.slice(0, 10);
  
  if (recentUsers.length === 0) {
    usersBody.innerHTML = '<tr><td colspan="4" class="py-4 text-center text-gray-500">Aucun utilisateur enregistré.</td></tr>';
  } else {
    recentUsers.forEach(u => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-800/40 hover:bg-gray-800/10 transition-colors';
      
      const creationDate = u.date_creation ? new Date(u.date_creation).toLocaleDateString('fr-FR') : '—';
      const phoneDisplay = u.num_telephone || '—';
      const accountBadge = u.type_compte === 'professionnel'
        ? '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">PRO</span>'
        : '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-gray-500/10 text-gray-400 border border-gray-500/20">Particulier</span>';
      
      row.innerHTML = `
        <td class="py-3.5 pl-2 font-semibold text-white">${u.prenom || ''} ${u.nom || ''}</td>
        <td class="py-3.5 text-gray-400">${phoneDisplay}</td>
        <td class="py-3.5">${accountBadge}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${creationDate}</td>
      `;
      usersBody.appendChild(row);
    });
  }

  // --- 2. Remplir Table Annonces ---
  const adsBody = document.getElementById('table-ads-body');
  adsBody.innerHTML = '';
  
  const recentAds = annonces.slice(0, 10);
  const categoryLabels = {
    'telephonie_electronique': 'Électronique',
    'mode_beaute': 'Mode & Beauté',
    'maison_electromenager': 'Maison',
    'voitures': 'Voitures',
    'motos': 'Motos',
    'immobilier': 'Immobilier',
    'alimentation': 'Alimentation',
    'services': 'Services'
  };

  if (recentAds.length === 0) {
    adsBody.innerHTML = '<tr><td colspan="5" class="py-4 text-center text-gray-500">Aucune annonce publiée.</td></tr>';
  } else {
    recentAds.forEach(a => {
      const row = document.createElement('tr');
      row.className = 'border-b border-gray-800/40 hover:bg-gray-800/10 transition-colors';
      
      const creationDate = a.date_creation ? new Date(a.date_creation).toLocaleDateString('fr-FR') : '—';
      const catLabel = categoryLabels[a.categorie] || a.categorie;
      const priceDisplay = a.prix ? a.prix.toLocaleString('fr-FR') + ' FCFA' : '0 FCFA';
      
      let statusBadge = '';
      if (a.statut === 'vendu') {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Vendu</span>';
      } else if (a.est_payee) {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Payé & Actif</span>';
      } else {
        statusBadge = '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">Attente</span>';
      }

      row.innerHTML = `
        <td class="py-3.5 pl-2 font-semibold text-white truncate max-w-[150px]" title="${a.titre}">${a.titre}</td>
        <td class="py-3.5 text-xs text-gray-400">${catLabel}</td>
        <td class="py-3.5 text-emerald-400 font-bold">${priceDisplay}</td>
        <td class="py-3.5">${statusBadge}</td>
        <td class="py-3.5 text-right pr-2 text-gray-500 text-xs">${creationDate}</td>
      `;
      adsBody.appendChild(row);
    });
  }
}
