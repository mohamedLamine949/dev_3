import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { navigationRef } from './navigationRef';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { COLORS, FONTS, RADIUS, SHADOWS } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnreadCount } from '../hooks/useChat';
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
import LinkEmailScreen from '../screens/LinkEmailScreen';
import MesAnnoncesScreen from '../screens/MesAnnoncesScreen';
import EditAnnonceScreen from '../screens/EditAnnonceScreen';
import HistoriquePaiementsScreen from '../screens/HistoriquePaiementsScreen';
import FavorisScreen from '../screens/FavorisScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import VendeurProfileScreen from '../screens/VendeurProfileScreen';
import LegalScreen from '../screens/LegalScreen';
import TermsModal from '../components/TermsModal';
import NotificationManager from '../components/NotificationManager';
import DeepLinkHandler from '../components/DeepLinkHandler';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();


// Stack pour l'onglet Accueil
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

// Stack pour l'onglet Recherche
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

// Stack pour l'onglet Messages
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

// Stack pour l'onglet Profil
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

// Barre de navigation principale (Tabs)
function MainTabs() {
  const { session } = useAuth();
  const unreadCount = useUnreadCount(session?.user?.id);
  const { theme } = useTheme();
  // Zone occupée par la barre système Android (boutons de navigation ou barre de gestes).
  // Indispensable avec edgeToEdgeEnabled: sans ça, la tab bar passe SOUS les boutons Android.
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === 'android' ? insets.bottom : 0;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';

          if (route.name === 'Accueil') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Recherche') {
            iconName = focused ? 'search' : 'search-outline';
          } else if (route.name === 'Publier') {
            iconName = focused ? 'add-circle' : 'add-circle-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profil') {
            iconName = focused ? 'person' : 'person-outline';
          }

          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarLabelStyle: {
          fontSize: FONTS.xs,
          fontWeight: FONTS.medium,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          height: (Platform.OS === 'ios' ? 88 : 65) + bottomInset,
          paddingBottom: (Platform.OS === 'ios' ? 28 : 10) + bottomInset,
          paddingTop: 8,
          ...SHADOWS.md,
        },
      })}
    >
      <Tab.Screen name="Accueil" component={HomeStack} />
      <Tab.Screen name="Recherche" component={SearchStack} />
      <Tab.Screen
        name="Publier"
        component={PostAnnonceScreen}
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.publishButton, { backgroundColor: theme.primary }]}>
              <Ionicons name="add" size={28} color={theme.textInverse} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: theme.primary,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
        }}
      />
      <Tab.Screen name="Profil" component={ProfileStack} />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  const { isDark } = useTheme();
  
  const MyDarkTheme = {
    ...DarkTheme,
    colors: {
      ...DarkTheme.colors,
      background: '#0F172A',
      card: '#1E293B',
      text: '#F8FAFC',
      border: '#334155',
      primary: '#16a34a',
    },
  };

  const MyDefaultTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: '#FAFBFD',
      card: '#FFFFFF',
      text: '#1A1D26',
      border: '#E8ECF1',
      primary: '#15803d',
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={isDark ? MyDarkTheme : MyDefaultTheme}>
      <NotificationManager />
      <DeepLinkHandler />
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
          name="LinkEmail"
          component={LinkEmailScreen}
          options={{ animation: 'slide_from_right' }}
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
        <Stack.Screen
          name="Legal"
          component={LegalScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="ResetPassword"
          component={ResetPasswordScreen}
          options={{ animation: 'slide_from_right', gestureEnabled: false }}
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
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  publishButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -15,
    ...SHADOWS.colored,
  },
});
