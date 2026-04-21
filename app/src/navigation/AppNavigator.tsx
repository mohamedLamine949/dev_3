import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform } from 'react-native';

import { COLORS, FONTS, RADIUS, SHADOWS } from '../constants/theme';

// Screens
import HomeScreen from '../screens/HomeScreen';
import SearchScreen from '../screens/SearchScreen';
import AnnonceDetailScreen from '../screens/AnnonceDetailScreen';
import PostAnnonceScreen from '../screens/PostAnnonceScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ChatConversationScreen from '../screens/ChatConversationScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LoginScreen from '../screens/LoginScreen';

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

// Barre de navigation principale (Tabs)
function MainTabs() {
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
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: {
          fontSize: FONTS.xs,
          fontWeight: FONTS.medium,
          marginTop: -2,
        },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: 0,
          height: Platform.OS === 'ios' ? 88 : 65,
          paddingBottom: Platform.OS === 'ios' ? 28 : 10,
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
            <View style={styles.publishButton}>
              <Ionicons name="add" size={28} color={COLORS.textInverse} />
            </View>
          ),
          tabBarLabel: () => null,
        }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesStack}
        options={{
          tabBarBadge: 3,
          tabBarBadgeStyle: {
            backgroundColor: COLORS.primary,
            fontSize: 10,
            fontWeight: '700',
            minWidth: 18,
            height: 18,
            lineHeight: 18,
          },
        }}
      />
      <Tab.Screen name="Profil" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

// Root Navigator
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {/* Pour l'instant, on affiche directement les tabs (démo) */}
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
        {/* Le chat peut aussi être ouvert depuis le détail */}
        <Stack.Screen
          name="ChatConversation"
          component={ChatConversationScreen}
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
