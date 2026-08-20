import React from 'react';
import { NavigationContainer, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Animated,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { COLORS, FONTS, RADIUS, SHADOWS, SPACING } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnreadCount } from '../hooks/useChat';
import { useTabBarBottomPadding } from '../hooks/useTabBarSpace';
import { DefaultTheme, DarkTheme } from '@react-navigation/native';

// Screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import AnnonceDetailScreen from '../screens/AnnonceDetailScreen';
import PostAnnonceScreen from '../screens/PostAnnonceScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatConversationScreen from '../screens/ChatConversationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import CompleteProfileScreen from '../screens/CompleteProfileScreen';
import MesAnnoncesScreen from '../screens/MesAnnoncesScreen';
import EditAnnonceScreen from '../screens/EditAnnonceScreen';
import HistoriquePaiementsScreen from '../screens/HistoriquePaiementsScreen';
import FavorisScreen from '../screens/FavorisScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import VendeurProfileScreen from '../screens/VendeurProfileScreen';
import LegalScreen from '../screens/LegalScreen';
import DevenirPartenaireScreen from '../screens/DevenirPartenaireScreen';
import SaisirCodeParrainageScreen from '../screens/SaisirCodeParrainageScreen';
import MaBoutiqueScreen from '../screens/MaBoutiqueScreen';
import BoutiqueScreen from '../screens/BoutiqueScreen';
import DecouverteProScreen from '../screens/DecouverteProScreen';
import DecouverteProShopListScreen from '../screens/DecouverteProShopListScreen';
import AjouterProduitScreen from '../screens/AjouterProduitScreen';
import CommandesScreen from '../screens/CommandesScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import AdminModerationScreen from '../screens/AdminModerationScreen';
import PublierActionSheet, { OPTION_ANNONCE, OPTION_PRODUIT, OPTION_PRESTATION, ChoixPublication } from '../components/PublierActionSheet';
import TermsModal from '../components/TermsModal';
import NotificationManager from '../components/NotificationManager';
import DeviceIdSync from '../components/DeviceIdSync';

import { hapticLight, hapticMedium } from '../lib/haptics';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─────────────────────────────────────────────
// Stack Navigators (inchangés)
// ─────────────────────────────────────────────

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen
        name="AnnonceDetail"
        component={AnnonceDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

function SearchStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="SearchMain" component={SearchScreen} />
      <Stack.Screen
        name="AnnonceDetail"
        component={AnnonceDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

function MessagesStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MessagesMain" component={MessagesScreen} />
      <Stack.Screen
        name="ChatConversation"
        component={ChatConversationScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="MesAnnonces"
        component={MesAnnoncesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Favoris"
        component={FavorisScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="Placeholder"
        component={PlaceholderScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name="AnnonceDetail"
        component={AnnonceDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
    </Stack.Navigator>
  );
}

// ─────────────────────────────────────────────
// 🎯 Custom Floating Tab Bar
// ─────────────────────────────────────────────

interface TabConfig {
  name: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  isFAB?: boolean;
}

const TAB_CONFIG: TabConfig[] = [
  { name: 'Accueil', iconActive: 'home', iconInactive: 'home-outline' },
  { name: 'Recherche', iconActive: 'search', iconInactive: 'search-outline' },
  { name: 'Publier', iconActive: 'add', iconInactive: 'add', isFAB: true },
  { name: 'Messages', iconActive: 'chatbubbles', iconInactive: 'chatbubbles-outline' },
  { name: 'Compte', iconActive: 'person', iconInactive: 'person-outline' },
];

// Ecrans plein ecran ayant leur propre barre d'action collee en bas :
// la tab bar flottante la recouvrirait (CTA "Contacter le vendeur", champ de saisie du chat).
const HIDE_TAB_BAR_ON = ['AnnonceDetail', 'ChatConversation'];

function FloatingTabBar({ state, descriptors, navigation }: any) {
  const { theme, isDark } = useTheme();
  const { session } = useAuth();
  const unreadCount = useUnreadCount(session?.user?.id);

  // Animations de scale pour chaque tab
  const scaleValues = React.useRef(
    TAB_CONFIG.map(() => new Animated.Value(1))
  ).current;

  const handlePressIn = (index: number) => {
    hapticLight();
    Animated.spring(scaleValues[index], {
      toValue: 0.85,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = (index: number) => {
    Animated.spring(scaleValues[index], {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 8,
    }).start();
  };

  const bottomPadding = useTabBarBottomPadding();

  // Masquer la barre sur les ecrans qui ont deja un CTA colle en bas
  const focusedRoute = state.routes[state.index];
  const nestedRouteName = getFocusedRouteNameFromRoute(focusedRoute);
  if (nestedRouteName && HIDE_TAB_BAR_ON.includes(nestedRouteName)) {
    return null;
  }

  return (
    <View
      style={[
        styles.floatingBarContainer,
        { paddingBottom: bottomPadding },
      ]}
    >
      <View style={[
        styles.floatingBar,
        {
          backgroundColor: isDark
            ? 'rgba(20, 27, 45, 0.92)'
            : 'rgba(255, 255, 255, 0.92)',
          borderColor: isDark
            ? 'rgba(30, 41, 59, 0.5)'
            : 'rgba(229, 231, 235, 0.5)',
        },
      ]}>
        {/* Tab items */}
        <View style={styles.floatingBarContent}>
          {state.routes.map((route: any, index: number) => {
            const config = TAB_CONFIG[index];
            if (!config) return null;

            const isFocused = state.index === index;
            const isFAB = config.isFAB;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name, route.params);
              }
            };

            // Badge pour les messages non lus
            const showBadge = config.name === 'Messages' && unreadCount > 0;

            if (isFAB) {
              return (
                <Animated.View
                  key={route.key}
                  style={[
                    styles.fabWrapper,
                    { transform: [{ scale: scaleValues[index] }] },
                  ]}
                >
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={onPress}
                    onPressIn={() => handlePressIn(index)}
                    onPressOut={() => handlePressOut(index)}
                    style={[styles.fabButton, { backgroundColor: theme.primary }]}
                  >
                    <Ionicons name="add" size={28} color="#FFFFFF" />
                  </TouchableOpacity>
                </Animated.View>
              );
            }

            return (
              <Animated.View
                key={route.key}
                style={{ transform: [{ scale: scaleValues[index] }] }}
              >
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={onPress}
                  onPressIn={() => handlePressIn(index)}
                  onPressOut={() => handlePressOut(index)}
                  style={styles.tabItem}
                >
                  <View style={styles.tabIconContainer}>
                    <Ionicons
                      name={isFocused ? config.iconActive : config.iconInactive}
                      size={22}
                      color={isFocused ? theme.primary : theme.textMuted}
                    />
                    {/* Dot indicator pour le tab actif */}
                    {isFocused && (
                      <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
                    )}
                    {/* Badge notifications */}
                    {showBadge && (
                      <View style={[styles.badge, { backgroundColor: theme.error }]}>
                        {/* Dot minimaliste (pas de nombre) */}
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

// ─────────────────────────────────────────────
// Barre de navigation principale (Tabs)
// ─────────────────────────────────────────────

function MainTabs() {
  const { user } = useAuth();
  const [choixVisible, setChoixVisible] = React.useState(false);

  // Un compte professionnel peut publier deux choses differentes : on le lui
  // DEMANDE au lieu de le rediriger en silence (§6.2). Un particulier n'a
  // qu'une option : lui imposer une feuille intermediaire serait de la
  // friction pure, on ouvre directement le formulaire.
  const estPro = user?.type_compte === 'professionnel';
  const activite = user?.type_activite || 'produits';

  // La feuille ne propose que ce que ce compte peut reellement publier.
  const optionsPublication = React.useMemo(() => {
    if (!estPro) return [];
    const options = [];
    if (activite === 'produits' || activite === 'mixte') options.push(OPTION_PRODUIT);
    if (activite === 'services' || activite === 'mixte') options.push(OPTION_PRESTATION);
    options.push(OPTION_ANNONCE);
    return options;
  }, [estPro, activite]);

  const aPlusieursChoix = optionsPublication.length > 1;

  const allerVers = (cle: ChoixPublication) => {
    setChoixVisible(false);
    if (!navigationRef.isReady()) return;
    if (cle === 'annonce') {
      navigationRef.navigate('Publier' as never);
      return;
    }
    (navigationRef.navigate as any)('AjouterProduit', { kind: cle });
  };

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Accueil" component={HomeStack} />
        <Tab.Screen name="Recherche" component={SearchStack} />
        <Tab.Screen
          name="Publier"
          component={PostAnnonceScreen}
          listeners={() => ({
            tabPress: (e) => {
              if (aPlusieursChoix) {
                e.preventDefault();
                setChoixVisible(true);
              }
            },
          })}
        />
        <Tab.Screen name="Messages" component={MessagesStack} />
        <Tab.Screen name="Compte" component={ProfileStack} />
      </Tab.Navigator>

      <PublierActionSheet
        visible={choixVisible}
        options={optionsPublication}
        onChoisir={allerVers}
        onFermer={() => setChoixVisible(false)}
      />
    </>
  );
}

// ─────────────────────────────────────────────
// Root Navigator
// ─────────────────────────────────────────────

export default function AppNavigator() {
  const { isDark } = useTheme();
  const { session, isLoading } = useAuth();

  React.useEffect(() => {
    if (isLoading) return;
    
    // Si l'utilisateur est déjà connecté, pas besoin d'afficher l'écran de connexion
    if (session) return;

    const checkFirstLaunch = async () => {
      try {
        const hasLaunched = await AsyncStorage.getItem('has_launched_before');
        if (!hasLaunched) {
          // Premier lancement : on enregistre le flag et on redirige vers l'écran Login
          await AsyncStorage.setItem('has_launched_before', 'true');
          
          if (navigationRef.isReady()) {
            navigationRef.navigate('Login');
          } else {
            const interval = setInterval(() => {
              if (navigationRef.isReady()) {
                navigationRef.navigate('Login');
                clearInterval(interval);
              }
            }, 100);
            // Sécurité : arrêt automatique après 2 secondes si navigationRef ne devient jamais prêt
            setTimeout(() => clearInterval(interval), 2000);
          }
        }
      } catch (err) {
        console.error('[FirstLaunch] Error checking launch status:', err);
      }
    };

    checkFirstLaunch();
  }, [isLoading, session]);
  
  const MyDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0A0F1A',
      card: '#141B2D',
      text: '#F9FAFB',
      border: '#1E293B',
      primary: '#34D399',
    },
  };

  const MyDefaultTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#FAFBFC',
      card: '#FFFFFF',
      text: '#111827',
      border: '#E5E7EB',
      primary: '#059669',
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={isDark ? MyDarkTheme : MyDefaultTheme}>
      <NotificationManager />
      <DeviceIdSync />
      <TermsModal />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Pour l'instant, on affiche directement les tabs (démo) */}
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="CompleteProfile"
          component={CompleteProfileScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
        />
        <Stack.Screen
          name="ChatConversation"
          component={ChatConversationScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="VendeurProfile"
          component={VendeurProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        {/* Nécessaire au niveau racine : VendeurProfile (racine) navigue vers AnnonceDetail */}
        <Stack.Screen
          name="AnnonceDetail"
          component={AnnonceDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="EditAnnonce"
          component={EditAnnonceScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="HistoriquePaiements"
          component={HistoriquePaiementsScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DevenirPartenaire"
          component={DevenirPartenaireScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="SaisirCodeParrainage"
          component={SaisirCodeParrainageScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="MaBoutique"
          component={MaBoutiqueScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Boutique"
          component={BoutiqueScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DecouvertePro"
          component={DecouverteProScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="DecouverteProShopList"
          component={DecouverteProShopListScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AjouterProduit"
          component={AjouterProduitScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="Commandes"
          component={CommandesScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Subscription"
          component={SubscriptionScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        <Stack.Screen
          name="AdminModeration"
          component={AdminModerationScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// ─────────────────────────────────────────────
// 🎨 Styles
// ─────────────────────────────────────────────

const styles = StyleSheet.create({
  // Floating Tab Bar
  floatingBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
  },
  floatingBar: {
    width: '100%',
    maxWidth: 400,
    borderRadius: RADIUS.xl,
    // 'visible' : le FAB deborde vers le haut, il ne doit pas etre rogne
    overflow: 'visible',
    borderWidth: 1,
    ...SHADOWS.lg,
  },
  floatingBarContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.xs,
  },

  // Tab items
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minWidth: 48,
    minHeight: 48,
  },
  tabIconContainer: {
    position: 'relative',
    alignItems: 'center',
  },
  activeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 4,
  },

  // Badge
  badge: {
    position: 'absolute',
    top: -3,
    right: -6,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },

  // FAB (Floating Action Button)
  fabWrapper: {
    marginTop: -22,
    alignItems: 'center',
    zIndex: 10,
    elevation: 10,
  },
  fabButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.colored,
  },
});
